import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://teste:teste@localhost:5432/teste";
process.env.JWT_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres!";
process.env.NODE_ENV = "development";
process.env.ANALYTICS_ENABLED = "false";

const { checkReadOnlySql } = await import("../src/modules/analytics/sql-guard.js");
const { METRICS } = await import("../src/modules/analytics/metrics.js");
const { buildOpenApi } = await import("../src/modules/analytics/openapi.js");
const { toCsv } = await import("../src/modules/analytics/metrics.service.js");

test("guarda de SQL: aceita SELECT e WITH no esquema bi", () => {
  assert.equal(checkReadOnlySql("SELECT * FROM bi.v1_products").ok, true);
  assert.equal(checkReadOnlySql("  select category, count(*) from bi.v1_products group by 1;  ").ok, true);
  assert.equal(checkReadOnlySql("WITH t AS (SELECT * FROM bi.v1_sales) SELECT count(*) FROM t").ok, true);
  assert.equal(checkReadOnlySql("SELECT 'a;b' AS x FROM bi.v1_products").ok, true, "ponto e vírgula dentro de texto é permitido");
});

test("guarda de SQL: recusa escrita, vários comandos, outros esquemas e catálogos", () => {
  const bad = [
    "DELETE FROM bi.v1_products",
    "SELECT 1; DROP TABLE products",
    "UPDATE products SET price = 0",
    "SELECT * FROM public.products",
    "SELECT * FROM analytics.events",
    "SELECT * FROM pg_catalog.pg_user",
    "SELECT * FROM pg_user",
    "SELECT * FROM information_schema.tables",
    "SELECT pg_sleep(10)",
    "SELECT * INTO nova FROM bi.v1_products",
    "SELECT * FROM bi.v1_products -- comentário",
    "SELECT * FROM bi.v1_products /* x */",
    "COPY bi.v1_products TO '/tmp/x'",
    "SET search_path = public",
    "SELECT set_config('a','b',false)",
    "SELECT * FROM bi.v1_products FOR UPDATE",
    "",
    "EXPLAIN SELECT 1",
  ];
  for (const sql of bad) assert.equal(checkReadOnlySql(sql).ok, false, `deveria recusar: ${sql}`);
  assert.equal(checkReadOnlySql("SELECT " + "x".repeat(6000)).ok, false, "consulta longa demais");
});

test("registro de métricas: nomes únicos, views existem nas migrações e colunas de data fazem sentido", () => {
  assert.equal(new Set(METRICS.map((m) => m.name)).size, METRICS.length);
  const dir = join(import.meta.dirname, "../prisma/migrations");
  const sql = readdirSync(dir).filter((d) => d.includes("analytics")).map((d) => readFileSync(join(dir, d, "migration.sql"), "utf8")).join("\n");
  for (const m of METRICS) {
    assert.match(sql, new RegExp(`CREATE VIEW ${m.view.replace(".", "\\.")}\\b`), `${m.view} não existe nas migrações`);
    if (m.dateColumn) assert.ok(sql.includes(m.dateColumn), `${m.name}: coluna de data ${m.dateColumn}`);
    for (const c of m.additive) assert.ok(!(c in m.nonAdditive), `${m.name}: ${c} não pode ser somável e não somável`);
    assert.ok(m.exampleSql.includes(m.view), `${m.name}: o exemplo deve usar a view`);
    assert.ok(checkReadOnlySql(m.exampleSql).ok, `${m.name}: o SQL de exemplo precisa passar na guarda`);
  }
  // toda view bi.v1_* criada nas migrações está no registro
  const created = [...sql.matchAll(/CREATE VIEW (bi\.v1_[a-z_]+)/g)].map((x) => x[1]);
  for (const v of created) assert.ok(METRICS.some((m) => m.view === v), `${v} falta em metrics.ts`);
});

test("OpenAPI: lista todas as métricas e os três caminhos", () => {
  const spec = buildOpenApi("https://exemplo.test");
  assert.equal(spec.openapi, "3.1.0");
  assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/metrics/v1/metrics", "/api/metrics/v1/metrics/{name}", "/api/metrics/v1/metrics/{name}/data"]);
  const names = (spec.paths["/api/metrics/v1/metrics/{name}/data"].get.parameters[0] as { schema: { enum: string[] } }).schema.enum;
  assert.deepEqual(names, METRICS.map((m) => m.name));
});

test("CSV: aspas, vírgulas e nulos", () => {
  assert.equal(toCsv([{ name: "a" }, { name: "b" }], [{ a: "x,y", b: null }, { a: 'diz "oi"', b: 3 }]), 'a,b\n"x,y",\n"diz ""oi""",3\n');
});
