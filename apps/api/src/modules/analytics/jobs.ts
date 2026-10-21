import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { setIngestAvailable, startIngest, stopIngest } from "./ingest.js";

/** Hora (fuso de Brasília) em que roda a manutenção diária: partições, retenção, resumos do dia anterior e retrato de preços. */
const MAINTENANCE_HOUR_BRT = 3;
const CHECK_EVERY_MS = 60_000;
/** O dia corrente é refeito a cada 15 minutos para os painéis do dia ficarem quase ao vivo. */
const TODAY_EVERY_MS = 15 * 60_000;

let timer: NodeJS.Timeout | null = null;
let lastRunDay: string | null = null;
let lastToday = 0;

const brtNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Partições do mês, retenção, resumos de ontem e de hoje e retrato de preços. Idempotente: pode rodar de novo à vontade. */
export async function runMaintenance(): Promise<{ partitions: number; dropped: number; days: string[]; priced: number }> {
  const now = brtNow();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const made = (await prisma.$queryRaw<{ made: number }[]>`SELECT analytics.ensure_event_partitions(2) AS made`)[0]?.made ?? 0;
  const dropped = (await prisma.$queryRaw<{ dropped: number }[]>`SELECT analytics.drop_old_event_partitions(${env.ANALYTICS_RETENTION_MONTHS}::int) AS dropped`)[0]?.dropped ?? 0;
  const days = [ymd(yesterday), ymd(now)];
  for (const d of days) await prisma.$executeRaw`SELECT analytics.refresh_daily(${d}::date)`;
  const priced = (await prisma.$queryRaw<{ priced: number }[]>`SELECT analytics.snapshot_prices() AS priced`)[0]?.priced ?? 0;
  return { partitions: Number(made), dropped: Number(dropped), days, priced: Number(priced) };
}

async function tick() {
  if (Date.now() - lastToday >= TODAY_EVERY_MS) {
    lastToday = Date.now();
    try {
      await prisma.$executeRaw`SELECT analytics.refresh_daily(${ymd(brtNow())}::date)`;
    } catch (error) {
      console.error("[analytics] resumo de hoje falhou:", (error as Error).message.split("\n").slice(-1)[0]);
    }
  }
  const now = brtNow();
  const today = ymd(now);
  if (lastRunDay === today || now.getHours() < MAINTENANCE_HOUR_BRT) return;
  lastRunDay = today;
  try {
    const r = await runMaintenance();
    console.log(`[analytics] manutenção: ${r.partitions} partição(ões) criada(s), ${r.dropped} removida(s), resumos de ${r.days.join(" e ")}, ${r.priced} preço(s)`);
  } catch (error) {
    lastRunDay = null; // tenta de novo no próximo minuto
    console.error("[analytics] manutenção falhou:", (error as Error).message.split("\n").slice(-1)[0]);
  }
}

export function startAnalytics(): void {
  if (!env.ANALYTICS_ENABLED) {
    console.log("[analytics] desligado (ANALYTICS_ENABLED=false)");
    return;
  }
  // migrations da medição ainda não aplicadas (API subiu antes do banco): fica desligada, sem erro, até a próxima reinicialização
  void prisma
    .$queryRaw<{ ok: boolean }[]>`SELECT to_regclass('analytics.events') IS NOT NULL AS ok`
    .then(([row]) => {
      if (!row?.ok) {
        setIngestAvailable(false);
        console.warn("[analytics] esquema analytics não encontrado: aplique as migrations (docs/analytics/OPERATIONS.md). Medição desligada até reiniciar.");
        return;
      }
      startIngest();
      // ao subir: garante as partições e refaz ontem e hoje (a API pode ter ficado fora do ar na madrugada)
      void runMaintenance().catch((error) => console.error("[analytics] preparo inicial falhou:", (error as Error).message.split("\n").slice(-1)[0]));
      timer = setInterval(() => void tick(), CHECK_EVERY_MS);
      timer.unref();
    })
    .catch((error) => {
      setIngestAvailable(false);
      console.error("[analytics] não consegui verificar o banco; medição desligada:", (error as Error).message.split("\n").slice(-1)[0]);
    });
}

export async function stopAnalytics(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await stopIngest();
}
