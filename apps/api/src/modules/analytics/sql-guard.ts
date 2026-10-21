/**
 * Guarda de SQL para agentes de IA: só SELECT (ou WITH … SELECT) sobre o esquema bi. É a primeira barreira; a segunda é a transação
 * somente leitura com limite de tempo, e a terceira (em produção) é o usuário bi_reader, que só enxerga o esquema bi.
 */
export const MAX_SQL_LENGTH = 5000;
export const MAX_ROWS = 1000;

const FORBIDDEN_WORDS = [
  "insert", "update", "delete", "drop", "alter", "create", "grant", "revoke", "truncate", "copy", "call", "do", "execute", "prepare", "deallocate",
  "set", "reset", "vacuum", "analyze", "listen", "notify", "lock", "refresh", "comment", "security", "into", "pg_sleep", "dblink", "set_config",
  "current_setting", "txid_current", "lo_import", "lo_export",
];
const FORBIDDEN_SCHEMAS = ["analytics", "public", "pg_catalog", "information_schema", "pg_temp", "pg_toast"];

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

/** Troca o conteúdo de textos entre aspas simples por vazio, para as regras não olharem dentro de literais. */
const withoutLiterals = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''");

export function checkReadOnlySql(input: string): GuardResult {
  let sql = input.trim();
  if (sql.length === 0) return { ok: false, reason: "Consulta vazia." };
  if (sql.length > MAX_SQL_LENGTH) return { ok: false, reason: `Consulta longa demais (máximo ${MAX_SQL_LENGTH} caracteres).` };
  sql = sql.replace(/;\s*$/, "");
  const bare = withoutLiterals(sql);
  if (bare.includes(";")) return { ok: false, reason: "Só uma instrução por vez (sem ponto e vírgula no meio)." };
  if (/--|\/\*/.test(bare)) return { ok: false, reason: "Comentários não são aceitos." };
  if (!/^(select|with)\b/i.test(bare)) return { ok: false, reason: "Só consultas SELECT (ou WITH … SELECT)." };
  const lower = bare.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return { ok: false, reason: `Palavra não permitida: ${word}.` };
  }
  for (const schema of FORBIDDEN_SCHEMAS) {
    if (new RegExp(`\\b${schema}\\s*\\.`).test(lower)) return { ok: false, reason: `Só o esquema bi está liberado (encontrei ${schema}.).` };
  }
  if (/\bpg_[a-z_]+/.test(lower) || /\binformation_schema\b/.test(lower)) return { ok: false, reason: "Catálogos do banco não estão liberados." };
  if (/\bfor\s+(update|share)\b/.test(lower)) return { ok: false, reason: "Bloqueios de linha não são permitidos." };
  return { ok: true, sql };
}
