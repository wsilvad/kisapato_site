import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { Router } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { metricsFlood } from "../../middlewares/rate-limit.js";
import { describeMetric, listMetrics, queryMetric, toCsv } from "./metrics.service.js";
import { buildOpenApi } from "./openapi.js";

/**
 * API de métricas (somente leitura) para IA e ferramentas: GET /api/metrics/v1/metrics, /{name} e /{name}/data.
 * Autenticada por chave (METRICS_API_KEY no servidor). Sem a chave configurada, fica desligada (503).
 */
export const metricsRouter = Router();

const digest = (s: string) => createHash("sha256").update(s).digest();

const requireKey: RequestHandler = (req, _res, next) => {
  if (!env.METRICS_API_KEY) throw new AppError("A API de métricas está desligada neste servidor (falta METRICS_API_KEY).", 503, "METRICS_DISABLED");
  const given = (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !timingSafeEqual(digest(given), digest(env.METRICS_API_KEY))) throw new AppError("Chave inválida.", 401, "BAD_KEY");
  next();
};

metricsRouter.use(metricsFlood);

// o contrato não tem dados: pode ser lido sem chave (a IA o usa para descobrir como chamar)
metricsRouter.get("/openapi.json", (req, res) => {
  res.json(buildOpenApi(`${req.protocol}://${req.get("host")}`));
});

metricsRouter.use(requireKey);

metricsRouter.get("/v1/metrics", async (_req, res) => {
  res.json(await listMetrics());
});

metricsRouter.get("/v1/metrics/:name", async (req, res) => {
  res.json(await describeMetric(String(req.params.name)));
});

const RESERVED = new Set(["from", "to", "limit", "offset", "order", "format"]);

metricsRouter.get("/v1/metrics/:name/data", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const text = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const num = (k: string) => (text(k) !== undefined && Number.isFinite(Number(text(k))) ? Number(text(k)) : undefined);
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (!RESERVED.has(k) && typeof v === "string") filters[k] = v;
  const result = await queryMetric(String(req.params.name), { from: text("from"), to: text("to"), limit: num("limit"), offset: num("offset"), order: text("order"), filters });
  if (text("format") === "csv") {
    res.type("text/csv; charset=utf-8").send(toCsv(result.columns, result.rows));
    return;
  }
  res.json(result);
});
