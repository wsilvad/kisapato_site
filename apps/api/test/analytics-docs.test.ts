import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!";
process.env.NODE_ENV = "development";
process.env.ANALYTICS_ENABLED = "false";

const { EVENTS } = await import("../src/modules/analytics/registry.js");
const { METRICS } = await import("../src/modules/analytics/metrics.js");
const { buildOpenApi } = await import("../src/modules/analytics/openapi.js");
const { checkReadOnlySql } = await import("../src/modules/analytics/sql-guard.js");
const { grafanaDashboards } = await import("../scripts/analytics-grafana.js");

const docs = join(import.meta.dirname, "../../../docs/analytics");
const read = (f: string) => readFileSync(join(docs, f), "utf8");
const migrations = join(import.meta.dirname, "../prisma/migrations");
const migrationSql = readdirSync(migrations).filter((d) => d.includes("analytics")).map((d) => readFileSync(join(migrations, d, "migration.sql"), "utf8")).join("\n");
const REGEN = "Rode `npm run analytics:docs -w @ki-sapato/api` e commite os arquivos de docs/analytics.";

test("catálogo de eventos tem todos os eventos do registro", () => {
  const md = read("events-catalog.md");
  for (const e of EVENTS) assert.ok(md.includes(`\`${e.name}\``), `${e.name} falta em events-catalog.md. ${REGEN}`);
});

test("catálogo de métricas, dicionário e camada semântica têm todas as métricas", () => {
  const cat = read("metrics-catalog.md");
  const dict = read("data-dictionary.md");
  const sem = read("semantic-layer.yaml");
  for (const m of METRICS) {
    assert.ok(cat.includes(`## ${m.name}`), `${m.name} falta em metrics-catalog.md. ${REGEN}`);
    assert.ok(dict.includes(`## ${m.view}`), `${m.view} falta em data-dictionary.md. ${REGEN}`);
    assert.ok(sem.includes(`name: ${m.name}\n`), `${m.name} falta em semantic-layer.yaml. ${REGEN}`);
  }
});

test("toda coluna comentada nas migrações aparece no dicionário de dados", () => {
  const dict = read("data-dictionary.md");
  for (const m of migrationSql.matchAll(/doc_columns\('(bi\.v1_[a-z_]+)', ARRAY\[([\s\S]*?)\]\);/g)) {
    const view = m[1]!;
    const section = dict.slice(dict.indexOf(`## ${view}`));
    for (const pair of m[2]!.matchAll(/'([a-z_0-9]+)\|/g)) assert.ok(section.includes(`| \`${pair[1]}\` |`), `${view}.${pair[1]} falta em data-dictionary.md. ${REGEN}`);
  }
});

test("OpenAPI e painéis do Grafana gerados estão em dia com o código", () => {
  assert.deepEqual(JSON.parse(read("openapi.json")), JSON.parse(JSON.stringify(buildOpenApi())), `openapi.json desatualizado. ${REGEN}`);
  for (const d of grafanaDashboards()) assert.deepEqual(JSON.parse(read(`grafana/dashboards/${d.file}.json`)), JSON.parse(JSON.stringify(d.json)), `painel ${d.file} desatualizado. ${REGEN}`);
});

test("guia para agentes cita todas as métricas; exemplos de SQL passam na guarda e só usam o esquema bi", () => {
  const guide = read("AGENTS.md");
  for (const m of METRICS) assert.ok(guide.includes(m.name), `AGENTS.md não cita a métrica ${m.name}`);
  for (const f of readdirSync(join(docs, "examples"))) {
    const sql = readFileSync(join(docs, "examples", f), "utf8").replace(/^--.*$/gm, "").trim();
    assert.equal(checkReadOnlySql(sql).ok, true, `exemplo ${f} é recusado pela guarda de SQL`);
    assert.match(sql, /bi\.v1_/, `exemplo ${f} deve usar views bi.v1_*`);
  }
});

test("painéis do Grafana só leem views bi e não escrevem", () => {
  for (const d of grafanaDashboards()) {
    for (const p of d.json.panels) {
      const sql = p.targets[0]!.rawSql;
      assert.match(sql, /bi\.v1_/);
      assert.doesNotMatch(sql, /\b(insert|update|delete|drop|alter|truncate)\b/i);
      assert.doesNotMatch(sql, /\b(analytics|public)\./i);
    }
  }
});
