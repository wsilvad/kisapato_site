import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { metricsDb } from "../../lib/metrics-db.js";
import { METRIC_BY_NAME, METRICS, type MetricDef } from "./metrics.js";
import { MAX_ROWS, checkReadOnlySql } from "./sql-guard.js";

export interface ColumnInfo {
  name: string;
  type: string;
  description: string | null;
}

const COLUMN_CACHE_MS = 5 * 60_000;
const columnCache = new Map<string, { at: number; columns: ColumnInfo[]; viewComment: string | null }>();

/** Colunas e comentários de uma view do esquema bi (do próprio banco). */
export async function describeView(view: string): Promise<{ columns: ColumnInfo[]; viewComment: string | null }> {
  const hit = columnCache.get(view);
  if (hit && Date.now() - hit.at < COLUMN_CACHE_MS) return hit;
  const relname = view.replace(/^bi\./, "");
  const db = metricsDb();
  const rows = await db.$queryRaw<{ name: string; type: string; description: string | null }[]>`
    SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, col_description(c.oid, a.attnum) AS description
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'bi' AND c.relname = ${relname} AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`;
  const comment = await db.$queryRaw<{ c: string | null }[]>`
    SELECT obj_description(c.oid, 'pg_class') AS c FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'bi' AND c.relname = ${relname}`;
  const value = { at: Date.now(), columns: rows, viewComment: comment[0]?.c ?? null };
  columnCache.set(view, value);
  return value;
}

export async function listMetrics() {
  return METRICS.map((m) => ({
    name: m.name, title: m.title, question: m.question, grain: m.grain, view: m.view, date_column: m.dateColumn ?? null,
    additive_columns: m.additive, non_additive_columns: m.nonAdditive, caveats: m.caveats, example_sql: m.exampleSql,
  }));
}

export async function describeMetric(name: string) {
  const m = metric(name);
  const { columns, viewComment } = await describeView(m.view);
  return {
    name: m.name, title: m.title, question: m.question, grain: m.grain, view: m.view, date_column: m.dateColumn ?? null, description: viewComment,
    columns: columns.map((c) => ({ ...c, additive: m.additive.includes(c.name), non_additive_reason: m.nonAdditive[c.name] ?? null })),
    caveats: m.caveats, example_sql: m.exampleSql,
  };
}

function metric(name: string): MetricDef {
  const m = METRIC_BY_NAME.get(name);
  if (!m) throw new AppError(`Métrica desconhecida: ${name}. Veja GET /api/metrics/v1/metrics.`, 404, "UNKNOWN_METRIC");
  return m;
}

export interface QueryOptions {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  /** Coluna de ordenação; prefixo "-" = decrescente. */
  order?: string;
  /** Filtros de igualdade: coluna → valor. */
  filters?: Record<string, string>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Converte o que o banco devolve (bigint, numeric como texto, datas) em JSON simples. */
function plain(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return type === "date" ? value.toISOString().slice(0, 10) : value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "string" && /^(numeric|double|real|decimal)/.test(type) && value.trim() !== "") return Number(value);
  return value;
}

export async function queryMetric(name: string, options: QueryOptions = {}) {
  const m = metric(name);
  const { columns } = await describeView(m.view);
  const byName = new Map(columns.map((c) => [c.name, c]));
  const where: Prisma.Sql[] = [];

  if (options.from || options.to) {
    if (!m.dateColumn) throw new AppError(`A métrica ${m.name} é um retrato atual e não aceita from/to.`, 400, "NO_DATE_COLUMN");
    for (const d of [options.from, options.to]) if (d && !DAY.test(d)) throw new AppError("Datas no formato AAAA-MM-DD.", 400, "BAD_DATE");
    if (options.from) where.push(Prisma.sql`${Prisma.raw(`"${m.dateColumn}"`)} >= ${options.from}::date`);
    if (options.to) where.push(Prisma.sql`${Prisma.raw(`"${m.dateColumn}"`)} <= ${options.to}::date`);
  }
  for (const [col, value] of Object.entries(options.filters ?? {})) {
    const info = byName.get(col);
    if (!info) throw new AppError(`Coluna desconhecida em ${m.name}: ${col}.`, 400, "UNKNOWN_COLUMN");
    where.push(Prisma.sql`${Prisma.raw(`"${col}"`)}::text = ${value}`);
  }

  let orderSql = Prisma.raw(m.defaultOrder);
  if (options.order) {
    const desc = options.order.startsWith("-");
    const col = desc ? options.order.slice(1) : options.order;
    if (!byName.has(col)) throw new AppError(`Coluna de ordenação desconhecida: ${col}.`, 400, "UNKNOWN_COLUMN");
    orderSql = Prisma.raw(`"${col}" ${desc ? "DESC" : "ASC"} NULLS LAST`);
  }
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 1000), 1), 10_000);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const query = Prisma.sql`SELECT * FROM ${Prisma.raw(m.view)} ${where.length ? Prisma.sql`WHERE ${Prisma.join(where, " AND ")}` : Prisma.empty} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`;

  const rows = await metricsDb().$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 10000");
    return tx.$queryRaw<Record<string, unknown>[]>(query);
  });
  return {
    metric: m.name, view: m.view, row_count: rows.length, limit, offset,
    columns: columns.map((c) => ({ name: c.name, type: c.type })),
    rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v, byName.get(k)?.type ?? "")]))),
  };
}

/** SQL livre (só SELECT no esquema bi), para agentes. Máximo de 1000 linhas e 10 s. */
export async function runGuardedSql(sql: string) {
  const checked = checkReadOnlySql(sql);
  if (!checked.ok) throw new AppError(checked.reason, 400, "SQL_REFUSED");
  const wrapped = `SELECT * FROM (${checked.sql}) AS q LIMIT ${MAX_ROWS}`;
  let rows: Record<string, unknown>[];
  try {
    rows = await metricsDb().$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = 10000");
      await tx.$executeRawUnsafe("SET LOCAL search_path = bi");
      return tx.$queryRawUnsafe<Record<string, unknown>[]>(wrapped);
    });
  } catch (error) {
    // erro do banco (coluna ou view inexistente, tempo esgotado…): mensagem curta, sem detalhes internos
    const detail = String((error as Error).message).split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "erro desconhecido";
    throw new AppError(`A consulta falhou: ${detail.replace(/^Message: /, "")}. Use só as views bi.v1_* (veja list_metrics e describe_metric).`, 400, "SQL_FAILED");
  }
  return { row_count: rows.length, max_rows: MAX_ROWS, rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v, "")]))) };
}

/** Linhas em CSV (cabeçalho + valores), com aspas quando preciso. */
export function toCsv(columns: { name: string }[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const t = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [columns.map((c) => cell(c.name)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.name])).join(","))].join("\n") + "\n";
}
