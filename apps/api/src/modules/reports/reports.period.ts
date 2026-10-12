import { AppError } from "../../lib/errors.js";

const TIME_ZONE = "America/Sao_Paulo";
/** Brasília não tem horário de verão desde 2019: o deslocamento é fixo. */
const OFFSET = "-03:00";
const DAY_MS = 86_400_000;
const MAX_DAYS = 366;

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE });

/** Data (AAAA-MM-DD) de um instante no horário de Brasília. */
export const dayKey = (date: Date) => dayFormat.format(date);

export function addDays(key: string, days: number) {
  return dayKey(new Date(new Date(`${key}T12:00:00${OFFSET}`).getTime() + days * DAY_MS));
}

/** Início do dia (00:00 de Brasília) como instante UTC. */
export const startOfDay = (key: string) => new Date(`${key}T00:00:00${OFFSET}`);

export interface Period {
  from: string;
  to: string;
  days: string[];
  /** Início inclusivo e fim exclusivo, para consultas ao banco. */
  start: Date;
  end: Date;
}

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00${OFFSET}`).getTime());

/** Período em dias de Brasília, ambos inclusivos. Sem parâmetros: os últimos 30 dias, até hoje. */
export function parsePeriod(from?: string, to?: string, now = new Date()): Period {
  const last = to ?? dayKey(now);
  const first = from ?? addDays(last, -29);
  if (!isDay(first) || !isDay(last)) throw new AppError("Datas inválidas. Use o formato AAAA-MM-DD.", 400);
  if (first > last) throw new AppError("A data inicial deve ser anterior à final.", 400);
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    days.push(d);
    if (days.length > MAX_DAYS) throw new AppError(`O período máximo é de ${MAX_DAYS} dias.`, 400);
  }
  return { from: first, to: last, days, start: startOfDay(first), end: startOfDay(addDays(last, 1)) };
}

/** Período imediatamente anterior, com a mesma duração (para comparar). */
export function previousPeriod(period: Period): Period {
  const length = period.days.length;
  return parsePeriod(addDays(period.from, -length), addDays(period.from, -1));
}
