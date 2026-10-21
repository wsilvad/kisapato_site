import { METRICS } from "./metrics.js";

/** Contrato OpenAPI 3.1 da API de métricas, gerado do registro (sem escrever à mão, para nunca divergir). */
export function buildOpenApi(serverUrl = "https://kisapatoback.discloud.dev") {
  const names = METRICS.map((m) => m.name);
  const metricDocs = METRICS.map((m) => `- **${m.name}** — ${m.title}: ${m.question} (${m.grain})`).join("\n");
  return {
    openapi: "3.1.0",
    info: {
      title: "API de métricas do site Ki Sapato",
      version: "1.0.0",
      description:
        "Leitura (somente) das métricas de comportamento e vendas da loja. Cada métrica é uma view versionada do esquema bi. Datas no formato AAAA-MM-DD, fuso America/Sao_Paulo, valores em reais.\n\n" +
        "Para IA: comece por `GET /api/metrics/v1/metrics`, depois `GET /api/metrics/v1/metrics/{name}` (colunas e significados) e então `/data`. Sempre informe `from` e `to` nas métricas com `date_column`. Veja docs/analytics/AGENTS.md.\n\nMétricas:\n" + metricDocs,
    },
    servers: [{ url: serverUrl }, { url: "http://localhost:3333" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Chave METRICS_API_KEY do servidor." } },
      schemas: {
        Metric: {
          type: "object",
          properties: {
            name: { type: "string", enum: names }, title: { type: "string" }, question: { type: "string" }, grain: { type: "string" }, view: { type: "string" },
            date_column: { type: ["string", "null"] }, additive_columns: { type: "array", items: { type: "string" } },
            non_additive_columns: { type: "object", additionalProperties: { type: "string" } }, caveats: { type: "array", items: { type: "string" } }, example_sql: { type: "string" },
          },
        },
        DataResponse: {
          type: "object",
          properties: {
            metric: { type: "string" }, view: { type: "string" }, row_count: { type: "integer" }, limit: { type: "integer" }, offset: { type: "integer" },
            columns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" } } } },
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
        Error: { type: "object", properties: { error: { type: "string" }, code: { type: "string" } } },
      },
    },
    paths: {
      "/api/metrics/v1/metrics": {
        get: { operationId: "listMetrics", summary: "Lista as métricas, o que respondem e como somar", responses: { "200": { description: "Lista", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Metric" } } } } } } },
      },
      "/api/metrics/v1/metrics/{name}": {
        get: {
          operationId: "describeMetric", summary: "Colunas, tipos, significados e cuidados de uma métrica",
          parameters: [{ name: "name", in: "path", required: true, schema: { type: "string", enum: names } }],
          responses: { "200": { description: "Descrição" }, "404": { description: "Métrica desconhecida", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } },
        },
      },
      "/api/metrics/v1/metrics/{name}/data": {
        get: {
          operationId: "queryMetric", summary: "Linhas de uma métrica (JSON ou CSV)",
          parameters: [
            { name: "name", in: "path", required: true, schema: { type: "string", enum: names } },
            { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Início (inclusive). Só métricas com date_column." },
            { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Fim (inclusive)." },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1000 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
            { name: "order", in: "query", schema: { type: "string" }, description: "Coluna de ordenação; prefixo - para decrescente." },
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"], default: "json" } },
            { name: "where", in: "query", style: "form", explode: true, schema: { type: "object", additionalProperties: { type: "string" } }, description: "Filtros de igualdade como ?device_type=mobile (qualquer coluna da métrica)." },
          ],
          responses: {
            "200": { description: "Linhas", content: { "application/json": { schema: { $ref: "#/components/schemas/DataResponse" } }, "text/csv": { schema: { type: "string" } } } },
            "400": { description: "Parâmetro inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Chave ausente ou errada" }, "429": { description: "Muitas requisições" }, "503": { description: "API de métricas desligada (sem METRICS_API_KEY)" },
          },
        },
      },
    },
  };
}
