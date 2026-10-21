/**
 * Gera a documentação de medição para IA e ferramentas a partir do código e do banco:
 *   docs/analytics/{events-catalog,metrics-catalog,data-dictionary}.md, semantic-layer.yaml, openapi.json,
 *   lookml/ki_sapato_bi.view.lkml, powerbi/measures.dax e grafana/ (painéis e provisionamento).
 * O dicionário lê as colunas e os COMMENT das views do banco, então rode com DATABASE_URL apontando para um banco com as migrações
 * aplicadas (pode ser o descartável):   npm run analytics:docs -w @ki-sapato/api
 * Os textos escritos à mão (AGENTS.md, README, playbook…) não são tocados.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { EVENTS, TYPED_FIELDS } from "../src/modules/analytics/registry.js";
import { METRICS } from "../src/modules/analytics/metrics.js";
import { describeView } from "../src/modules/analytics/metrics.service.js";
import { buildOpenApi } from "../src/modules/analytics/openapi.js";
import { grafanaDashboards } from "./analytics-grafana.js";

const root = new URL("../../../docs/analytics/", import.meta.url).pathname;
const out = (file: string, content: string) => {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : content + "\n");
};
const HEADER = "<!-- Gerado por `npm run analytics:docs -w @ki-sapato/api`. Não edite à mão: mude o código e gere de novo. -->\n\n";
const cell = (s: string | null | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

// ---------------------------------------------------------------------------------------------------------------------
// Colunas das views (do banco) classificadas em dimensão e medida
// ---------------------------------------------------------------------------------------------------------------------
type Role = "dimension" | "measure_sum" | "measure_non_additive";
interface Col { name: string; type: string; description: string; role: Role; reason?: string }
const NUMERIC = /^(integer|bigint|smallint|numeric|double precision|real)/;

const models = [];
const unclassified: string[] = [];
for (const m of METRICS) {
  const { columns, viewComment } = await describeView(m.view);
  const cols: Col[] = columns.map((c) => {
    const base = { name: c.name, type: c.type, description: c.description ?? "" };
    if (m.additive.includes(c.name)) return { ...base, role: "measure_sum" as const };
    if (c.name in m.nonAdditive) return { ...base, role: "measure_non_additive" as const, reason: m.nonAdditive[c.name] };
    if (NUMERIC.test(c.type) && !(m.numericDimensions ?? []).includes(c.name) && !/_id$/.test(c.name)) unclassified.push(`${m.name}.${c.name}`);
    return { ...base, role: "dimension" as const };
  });
  models.push({ m, cols, viewComment });
}
if (unclassified.length > 0) {
  console.error("Colunas numéricas sem classificação em metrics.ts (additive, nonAdditive ou numericDimensions):\n  " + unclassified.join("\n  "));
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------------------------
// events-catalog.md
// ---------------------------------------------------------------------------------------------------------------------
{
  let md = HEADER + "# Catálogo de eventos de medição\n\nGerado de `apps/api/src/modules/analytics/registry.ts`. Todo evento vai para `analytics.events` (esquema interno); BI e IA leem as views `bi.v1_*`, nunca esta tabela.\n\n";
  md += "**Campos comuns de todo evento** (preenchidos pelo SDK do site): `occurred_at` (corrigido pelo servidor), `anonymous_id`, `session_id`, `path`, `viewport_w` → `device_type`, `referrer_host`/`utm_*` (só no primeiro evento da visita), `browser` e `os` (do servidor).\n\n";
  md += `**Colunas tipadas disponíveis:** ${TYPED_FIELDS.map((f) => `\`${f}\``).join(", ")}. O que não cabe nelas vai em \`props\` (JSON, até 4 KB, sem dados pessoais).\n\n`;
  md += "**Nomes em outros destinos:** a coluna GA4/Segment/PostHog mostra a tradução usada pelo SDK ao enviar o mesmo evento a essas ferramentas.\n\n";
  for (const group of ["navegacao", "produto", "sacola", "qualidade", "identidade"] as const) {
    const title = { navegacao: "Navegação e descoberta", produto: "Produto", sacola: "Sacola e compra", qualidade: "Qualidade da experiência", identidade: "Identidade" }[group];
    md += `## ${title}\n\n| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |\n|---|---|---|---|---|---|---|---|\n`;
    for (const e of EVENTS.filter((x) => x.group === group)) {
      md += `| \`${e.name}\`${e.serverOnly ? " (servidor)" : ""} | ${cell(e.when)} | ${e.fields.map((f) => `\`${f}\``).join(", ") || "—"} | ${(e.required ?? []).map((f) => `\`${f}\``).join(", ") || "—"} | ${Object.entries(e.props ?? {}).map(([k, v]) => `\`${k}\`: ${cell(v)}`).join("; ") || "—"} | ${e.aliases?.ga4 ? `\`${e.aliases.ga4}\`` : "—"} | ${e.aliases?.segment ?? "—"} | ${e.aliases?.posthog ? `\`${e.aliases.posthog}\`` : "—"} |\n`;
    }
    md += "\n";
  }
  md += "## Exemplos\n\n";
  for (const e of EVENTS) md += `**${e.name}** — ${e.description}\n\n\`\`\`json\n${JSON.stringify({ event: e.name, ...e.example }, null, 2)}\n\`\`\`\n\n`;
  out("events-catalog.md", md);
}

// ---------------------------------------------------------------------------------------------------------------------
// metrics-catalog.md e data-dictionary.md
// ---------------------------------------------------------------------------------------------------------------------
{
  let md = HEADER + "# Catálogo de métricas\n\nCada métrica é uma view versionada do esquema `bi`. Fuso `America/Sao_Paulo`, valores em reais. Colunas, tipos e significados: [data-dictionary.md](data-dictionary.md). API: [openapi.json](openapi.json).\n\n| Métrica | Pergunta que responde | Granularidade | View |\n|---|---|---|---|\n";
  for (const { m } of models) md += `| [\`${m.name}\`](#${m.name}) | ${cell(m.question)} | ${cell(m.grain)} | \`${m.view}\` |\n`;
  md += "\n";
  for (const { m } of models) {
    md += `## ${m.name}\n\n**${m.title}.** ${m.question}\n\n- **View:** \`${m.view}\` · **Granularidade:** ${m.grain}\n- **Período:** ${m.dateColumn ? `filtre por \`${m.dateColumn}\` (API: \`from\` e \`to\`)` : "retrato atual, sem filtro de período"}\n`;
    md += `- **Pode somar:** ${m.additive.length ? m.additive.map((c) => `\`${c}\``).join(", ") : "nada (valores por produto/dia)"}\n`;
    const non = Object.entries(m.nonAdditive);
    if (non.length) md += `- **Não somar:** ${non.map(([c, why]) => `\`${c}\` (${why})`).join("; ")}\n`;
    md += "\n**Cuidados**\n\n" + m.caveats.map((c) => `- ${c}`).join("\n") + `\n\n**Exemplo**\n\n\`\`\`sql\n${m.exampleSql}\n\`\`\`\n\n`;
  }
  out("metrics-catalog.md", md);

  let dict = HEADER + "# Dicionário de dados (esquema `bi`)\n\nLido dos `COMMENT` do banco. **Medida** soma = pode somar linhas; **medida (não somar)** = razão, percentual, rank ou contagem de distintos; **dimensão** = para agrupar e filtrar.\n\n";
  for (const { m, cols, viewComment } of models) {
    dict += `## ${m.view}\n\n${viewComment ?? m.title}\n\n| Coluna | Tipo | Papel | Descrição |\n|---|---|---|---|\n`;
    for (const c of cols) dict += `| \`${c.name}\` | ${c.type} | ${c.role === "dimension" ? "dimensão" : c.role === "measure_sum" ? "medida (soma)" : `medida (não somar: ${cell(c.reason)})`} | ${cell(c.description)} |\n`;
    dict += "\n";
  }
  out("data-dictionary.md", dict);
}

// ---------------------------------------------------------------------------------------------------------------------
// semantic-layer.yaml (YAML escrito à mão: só textos, números e listas simples)
// ---------------------------------------------------------------------------------------------------------------------
{
  const q = (s: string) => JSON.stringify(s);
  let y = "# Camada semântica das métricas do site Ki Sapato (gerada; ver docs/analytics/README.md).\n# Formato próprio, simples de converter para LookML, Cube, dbt MetricFlow ou modelo do Power BI.\nversion: 1\ntimezone: America/Sao_Paulo\ncurrency: BRL\nschema: bi\nmodels:\n";
  for (const { m, cols } of models) {
    y += `  - name: ${m.name}\n    view: ${m.view}\n    title: ${q(m.title)}\n    question: ${q(m.question)}\n    grain: ${q(m.grain)}\n    time_dimension: ${m.dateColumn ?? "null"}\n    default_order: ${q(m.defaultOrder)}\n    dimensions:\n`;
    for (const c of cols.filter((x) => x.role === "dimension")) y += `      - { name: ${c.name}, type: ${q(c.type)}, description: ${q(c.description)} }\n`;
    y += "    measures:\n";
    for (const c of cols.filter((x) => x.role !== "dimension")) y += `      - { name: ${c.name}, type: ${q(c.type)}, aggregation: ${c.role === "measure_sum" ? "sum" : "none"}, description: ${q(c.description)}${c.reason ? `, not_additive_because: ${q(c.reason)}` : ""} }\n`;
    y += "    caveats:\n" + m.caveats.map((c) => `      - ${q(c)}`).join("\n") + "\n";
    if (cols.some((c) => c.name === "product_id") && m.name !== "products") y += "    joins:\n      - { to: products, on: product_id, relationship: many_to_one }\n";
  }
  y += `derived_metrics:
  - { name: ctr, model: product_engagement, formula: "sum(clicks) / sum(impressions)", description: "Cliques ÷ exibições dos cards." }
  - { name: view_to_cart_rate, model: product_engagement, formula: "sum(adds) / sum(views)", description: "Colocações na sacola ÷ visualizações do produto." }
  - { name: product_conversion_rate, model: product_engagement, formula: "sum(orders) / sum(views)", description: "Pedidos ÷ visualizações do produto." }
  - { name: cart_remove_rate, model: cart_add_remove, formula: "sum(removes) / sum(adds)", description: "Retiradas da sacola ÷ colocações." }
  - { name: step_conversion, model: funnel, formula: "sum(sessions at step N) / sum(sessions at step N-1)", description: "Passagem entre etapas do funil; some sessions por etapa e divida depois." }
  - { name: bounce_rate, model: traffic_daily, formula: "sum(bounced_sessions) / sum(sessions)", description: "Visitas de uma página só, sem ver produto nem usar a sacola." }
  - { name: issue_session_rate, model: traffic_daily, formula: "sum(sessions_with_issues) / sum(sessions)", description: "Visitas com erro, cliques repetidos, 404 ou imagem quebrada." }
  - { name: abandoned_cart_value, model: abandoned_carts, formula: "sum(cart_value)", description: "Dinheiro em sacolas abandonadas." }
  - { name: gross_margin_pct, model: sales, formula: "sum(line_revenue * margin_pct / 100) / sum(line_revenue)", description: "Margem ponderada pela receita (linhas sem custo ficam de fora)." }
`;
  out("semantic-layer.yaml", y);
}

// ---------------------------------------------------------------------------------------------------------------------
// openapi.json, LookML, DAX, Grafana
// ---------------------------------------------------------------------------------------------------------------------
out("openapi.json", JSON.stringify(buildOpenApi(), null, 2));

{
  const lk = (t: string): string => (/^(integer|bigint|smallint|numeric|double|real)/.test(t) ? "number" : t === "date" ? "date" : t.startsWith("timestamp") ? "time" : /^boolean/.test(t) ? "yesno" : "string");
  let l = "# LookML gerado das views bi.v1_* (ponto de partida; ver docs/analytics/README.md).\n";
  for (const { m, cols } of models) {
    l += `\nview: ${m.view.replace("bi.", "")} {\n  sql_table_name: ${m.view} ;;\n  label: "${m.title}"\n  description: "${m.question} (${m.grain})"\n`;
    for (const c of cols.filter((x) => x.role === "dimension")) {
      if (lk(c.type) === "date") l += `\n  dimension_group: ${c.name} {\n    type: time\n    timeframes: [date, week, month, year]\n    datatype: date\n    sql: \${TABLE}.${c.name} ;;\n    description: "${c.description.replace(/"/g, "'")}"\n  }\n`;
      else l += `\n  dimension: ${c.name} {\n    type: ${lk(c.type)}\n    sql: \${TABLE}.${c.name} ;;\n    description: "${c.description.replace(/"/g, "'")}"\n${c.name === "product_id" ? "    primary_key: no\n" : ""}  }\n`;
    }
    for (const c of cols.filter((x) => x.role === "measure_sum")) l += `\n  measure: total_${c.name} {\n    type: sum\n    sql: \${TABLE}.${c.name} ;;\n    description: "${c.description.replace(/"/g, "'")}"\n  }\n`;
    l += "}\n";
  }
  out("lookml/ki_sapato_bi.view.lkml", l);
}

{
  let dax = "// Medidas DAX de partida para o Power BI (importe as views bi.v1_* como tabelas com o mesmo nome).\n// Somas simples vêm das colunas somáveis; razões são calculadas sobre as somas, nunca somadas.\n";
  for (const { m, cols } of models) {
    const t = m.view.replace("bi.", "");
    const sums = cols.filter((c) => c.role === "measure_sum");
    if (!sums.length) continue;
    dax += `\n// ${m.title} (${t})\n`;
    for (const c of sums) dax += `${m.name}_${c.name} = SUM(${t}[${c.name}])\n`;
  }
  dax += `
// Razões (sobre as somas)
CTR = DIVIDE(SUM(v1_product_engagement[clicks]), SUM(v1_product_engagement[impressions]))
Taxa de conversão do produto = DIVIDE(SUM(v1_product_engagement[orders]), SUM(v1_product_engagement[views]))
Taxa de colocação na sacola = DIVIDE(SUM(v1_product_engagement[adds]), SUM(v1_product_engagement[views]))
Taxa de retirada da sacola = DIVIDE(SUM(v1_cart_add_remove[removes]), SUM(v1_cart_add_remove[adds]))
Taxa de rejeição = DIVIDE(SUM(v1_traffic_daily[bounced_sessions]), SUM(v1_traffic_daily[sessions]))
Visitas com problema % = DIVIDE(SUM(v1_traffic_daily[sessions_with_issues]), SUM(v1_traffic_daily[sessions]))
Valor em carrinhos abandonados = SUM(v1_abandoned_carts[cart_value])
Ticket médio = DIVIDE(SUMX(FILTER(v1_sales, v1_sales[status] <> "CANCELED"), v1_sales[line_revenue]), DISTINCTCOUNT(v1_sales[order_id]))
`;
  out("powerbi/measures.dax", dax);
}

for (const d of grafanaDashboards()) out(`grafana/dashboards/${d.file}.json`, JSON.stringify(d.json, null, 2));
out("grafana/provisioning/datasources/ki-sapato.yaml", `apiVersion: 1
datasources:
  - name: Ki Sapato (BI)
    uid: ki-sapato-bi
    type: postgres
    access: proxy
    url: \${KI_SAPATO_BI_HOST}:5432
    user: bi_reader
    secureJsonData:
      password: \${KI_SAPATO_BI_PASSWORD}
    jsonData:
      database: \${KI_SAPATO_BI_DATABASE}
      sslmode: require
      postgresVersion: 1700
      timescaledb: false
`);
out("grafana/provisioning/dashboards/ki-sapato.yaml", `apiVersion: 1
providers:
  - name: Ki Sapato
    folder: Ki Sapato
    type: file
    disableDeletion: false
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards/ki-sapato
`);

console.log(`Documentação gerada em ${root} (${models.length} métricas, ${EVENTS.length} eventos, ${grafanaDashboards().length} painéis do Grafana).`);
await prisma.$disconnect();
