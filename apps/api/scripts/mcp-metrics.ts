/**
 * Servidor MCP (stdio) das métricas do site Ki Sapato: dá a agentes de IA (Claude, etc.) ferramentas de LEITURA sobre o esquema bi.
 * Ferramentas: list_metrics, describe_metric, query_metric, run_sql (só SELECT no esquema bi, 1000 linhas, 10 s), get_agent_guide.
 *
 * Como usar (exemplo para o Claude Code / Claude Desktop):
 *   claude mcp add ki-sapato-metrics -- npx tsx apps/api/scripts/mcp-metrics.ts
 * Variáveis: DATABASE_URL (obrigatória) e, em produção, METRICS_DATABASE_URL com o usuário somente leitura bi_reader.
 * Nada é gravado: as consultas rodam em transação READ ONLY.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { METRICS } from "../src/modules/analytics/metrics.js";
import { describeMetric, listMetrics, queryMetric, runGuardedSql } from "../src/modules/analytics/metrics.service.js";

const server = new McpServer({ name: "ki-sapato-metrics", version: "1.0.0" });
const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (error: unknown) => ({ isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] });
const names = METRICS.map((m) => m.name) as [string, ...string[]];

server.registerTool("list_metrics", { description: "Lista as métricas do site (visitas, funil, carrinho, produtos, preço, qualidade, vendas): o que cada uma responde, a granularidade e quais colunas podem ser somadas. Comece por aqui.", inputSchema: {} }, async () => {
  try {
    return text(await listMetrics());
  } catch (e) {
    return fail(e);
  }
});

server.registerTool("describe_metric", { description: "Colunas (tipo e significado), cuidados de leitura e um SQL de exemplo de uma métrica.", inputSchema: { name: z.enum(names) } }, async ({ name }) => {
  try {
    return text(await describeMetric(name));
  } catch (e) {
    return fail(e);
  }
});

server.registerTool(
  "query_metric",
  {
    description: "Linhas de uma métrica. Informe sempre from/to (AAAA-MM-DD, fuso de Brasília) nas métricas com date_column. Máximo de 10000 linhas.",
    inputSchema: {
      name: z.enum(names),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.number().int().min(1).max(10000).optional(),
      order: z.string().optional().describe("coluna; prefixo - para decrescente"),
      filters: z.record(z.string(), z.string()).optional().describe("igualdade por coluna, ex.: {\"device_type\":\"mobile\"}"),
    },
  },
  async ({ name, from, to, limit, order, filters }) => {
    try {
      return text(await queryMetric(name, { from, to, limit, order, filters }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "run_sql",
  { description: "SQL livre, SÓ de leitura: um SELECT (ou WITH … SELECT) sobre as views do esquema bi (bi.v1_*). Até 1000 linhas e 10 s. Veja describe_metric para as colunas.", inputSchema: { sql: z.string().max(5000) } },
  async ({ sql }) => {
    try {
      return text(await runGuardedSql(sql));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool("get_agent_guide", { description: "Guia para agentes (regras, privacidade, como montar dashboards). Leia antes de montar análises.", inputSchema: {} }, async () => {
  try {
    return text(readFileSync(new URL("../../../docs/analytics/AGENTS.md", import.meta.url), "utf8"));
  } catch (e) {
    return fail(e);
  }
});

await server.connect(new StdioServerTransport());
