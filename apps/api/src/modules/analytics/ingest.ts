import { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { EVENT_BY_NAME, TYPED_FIELDS, type TypedField } from "./registry.js";
import { cleanInt, cleanNumber, cleanText, deviceFromWidth, isUuid, normalizePath, propsOf, redactSearchTerm } from "./sanitize.js";

export const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** Linha pronta para gravar em analytics.events (na ordem de COLUMNS). */
export interface EventRow {
  occurred_at: Date;
  schema_v: number;
  event: string;
  anonymous_id: string;
  session_id: string;
  profile_id: string | null;
  path: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  viewport_w: number | null;
  product_id: string | null;
  variant_id: string | null;
  list_name: string | null;
  list_position: number | null;
  price: number | null;
  quantity: number | null;
  cart_value: number | null;
  items_count: number | null;
  search_term: string | null;
  results_count: number | null;
  value_num: number | null;
  error_code: string | null;
  props: Record<string, unknown>;
}

const COLUMNS = [
  "occurred_at", "schema_v", "event", "anonymous_id", "session_id", "profile_id", "path", "referrer_host", "utm_source", "utm_medium", "utm_campaign",
  "device_type", "browser", "os", "viewport_w", "product_id", "variant_id", "list_name", "list_position", "price", "quantity", "cart_value",
  "items_count", "search_term", "results_count", "value_num", "error_code", "props",
] as const satisfies readonly (keyof EventRow)[];

export interface BatchContext {
  /** Momento em que a API recebeu o lote. */
  receivedAt: Date;
  /** Relógio do aparelho no envio (ms); serve para corrigir o horário dos eventos. */
  sentAt: number | null;
  browser: string | null;
  os: string | null;
}

const MAX_AGE_MS = 48 * 3600_000;

/** Corrige o relógio do aparelho: idade do evento = (envio − evento) no relógio dele; vale a idade, não a hora. */
export function occurredAt(ts: unknown, ctx: BatchContext): Date {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ctx.sentAt === null) return ctx.receivedAt;
  const age = ctx.sentAt - ts;
  if (age < 0 || age > MAX_AGE_MS) return ctx.receivedAt;
  return new Date(ctx.receivedAt.getTime() - age);
}

/** Valida um evento vindo do navegador; devolve null se não for aceito (nome fora do registro, evento só do servidor, ids inválidos…). */
export function rowFromClient(raw: unknown, ctx: BatchContext): EventRow | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const def = typeof e.event === "string" ? EVENT_BY_NAME.get(e.event) : undefined;
  if (!def || def.serverOnly) return null;
  if (!isUuid(e.anonymous_id) || !isUuid(e.session_id)) return null;

  const typed: Partial<Record<TypedField, string | number | null>> = {
    product_id: cleanText(e.product_id, 64),
    variant_id: cleanText(e.variant_id, 64),
    list_name: cleanText(e.list_name, 60),
    list_position: cleanInt(e.list_position, 1, 1000),
    price: cleanNumber(e.price, 0, 1_000_000),
    quantity: cleanInt(e.quantity, 0, 999),
    cart_value: cleanNumber(e.cart_value, 0, 10_000_000),
    items_count: cleanInt(e.items_count, 0, 999),
    search_term: redactSearchTerm(e.search_term),
    results_count: cleanInt(e.results_count, 0, 100_000),
    value_num: cleanNumber(e.value_num, -1e9, 1e9),
    error_code: cleanText(e.error_code, 120),
  };
  // só as colunas que o evento declara; o resto do que veio é ignorado
  for (const f of TYPED_FIELDS) if (!def.fields.includes(f)) typed[f] = null;
  for (const f of def.required ?? []) if (typed[f] === null || typed[f] === undefined) return null;

  const viewport = cleanInt(e.viewport_w, 200, 10_000);
  const path = normalizePath(e.path);
  if (def.name === "page_view" && path === null) return null;

  return {
    occurred_at: occurredAt(e.ts, ctx),
    schema_v: 1,
    event: def.name,
    anonymous_id: e.anonymous_id.toLowerCase(),
    session_id: e.session_id.toLowerCase(),
    profile_id: null,
    path,
    referrer_host: cleanText(e.referrer_host, 100),
    utm_source: cleanText(e.utm_source, 100),
    utm_medium: cleanText(e.utm_medium, 100),
    utm_campaign: cleanText(e.utm_campaign, 100),
    device_type: deviceFromWidth(viewport),
    browser: ctx.browser,
    os: ctx.os,
    viewport_w: viewport,
    product_id: (typed.product_id as string | null) ?? null,
    variant_id: (typed.variant_id as string | null) ?? null,
    list_name: (typed.list_name as string | null) ?? null,
    list_position: (typed.list_position as number | null) ?? null,
    price: (typed.price as number | null) ?? null,
    quantity: (typed.quantity as number | null) ?? null,
    cart_value: (typed.cart_value as number | null) ?? null,
    items_count: (typed.items_count as number | null) ?? null,
    search_term: (typed.search_term as string | null) ?? null,
    results_count: (typed.results_count as number | null) ?? null,
    value_num: (typed.value_num as number | null) ?? null,
    error_code: (typed.error_code as string | null) ?? null,
    props: propsOf(e.props),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Buffer: o banco é remoto (~0,2 s por ida e volta), então os eventos são juntados e gravados em lote.
// ---------------------------------------------------------------------------------------------------------------------
const MAX_BUFFER = 5000;
const CHUNK = 200;
const FLUSH_EVERY_MS = 5000;

let buffer: EventRow[] = [];
let timer: NodeJS.Timeout | null = null;
let flushing: Promise<void> = Promise.resolve();
export const stats = { received: 0, stored: 0, dropped: 0, failed: 0 };

export const analyticsEnabled = () => env.ANALYTICS_ENABLED;

/** Falso quando as migrations da medição ainda não foram aplicadas no banco: nada é guardado e nada falha (a API sobe antes do banco sem dar erro). */
let available = true;
export const setIngestAvailable = (value: boolean) => {
  available = value;
};

/** Entrega linhas já validadas ao buffer (descarta o excedente se o buffer encher). */
export function enqueue(rows: EventRow[]): void {
  if (!env.ANALYTICS_ENABLED || !available || rows.length === 0) return;
  stats.received += rows.length;
  const room = MAX_BUFFER - buffer.length;
  if (rows.length > room) stats.dropped += rows.length - Math.max(room, 0);
  buffer.push(...rows.slice(0, Math.max(room, 0)));
  if (buffer.length >= CHUNK) void flush();
}

function insertQuery(rows: EventRow[]) {
  // Datas vão como texto ISO com "Z": uma data "pelada" seria lida no fuso da sessão do banco e deslocaria o horário.
  const cell = (r: EventRow, c: (typeof COLUMNS)[number]) =>
    c === "props" ? Prisma.sql`${JSON.stringify(r.props)}::jsonb` : c === "occurred_at" ? Prisma.sql`${r.occurred_at.toISOString()}::timestamptz` : Prisma.sql`${r[c]}`;
  const values = rows.map((r) => Prisma.sql`(${Prisma.join(COLUMNS.map((c) => cell(r, c)))})`);
  return Prisma.sql`INSERT INTO analytics.events (${Prisma.raw(COLUMNS.join(", "))}) VALUES ${Prisma.join(values)}`;
}

async function writeChunk(rows: EventRow[]): Promise<void> {
  try {
    await prisma.$executeRaw(insertQuery(rows));
    stats.stored += rows.length;
  } catch (error) {
    // partição do mês ainda não criada: cria e tenta uma vez de novo
    if (/no partition of relation/i.test(String((error as Error).message))) {
      try {
        await prisma.$queryRaw`SELECT analytics.ensure_event_partitions(2)`;
        await prisma.$executeRaw(insertQuery(rows));
        stats.stored += rows.length;
        return;
      } catch (retry) {
        error = retry;
      }
    }
    stats.failed += rows.length;
    console.error("[analytics] falha ao gravar eventos:", (error as Error).message.split("\n").slice(-1)[0]);
  }
}

/** Grava o que está no buffer (uma gravação por vez, para não sobrecarregar o banco). */
export function flush(): Promise<void> {
  flushing = flushing.then(async () => {
    while (buffer.length > 0) {
      const rows = buffer.splice(0, CHUNK);
      await writeChunk(rows);
    }
  });
  return flushing;
}

export function startIngest(): void {
  if (timer || !env.ANALYTICS_ENABLED) return;
  timer = setInterval(() => void flush(), FLUSH_EVERY_MS);
  timer.unref();
}

export async function stopIngest(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await flush();
}

/** Para testes: esvazia o estado do módulo. */
export function resetIngest(): void {
  buffer = [];
  stats.received = stats.stored = stats.dropped = stats.failed = 0;
}
export const bufferSize = () => buffer.length;
