import express, { Router } from "express";
import { eventsFlood } from "../../middlewares/rate-limit.js";
import { enqueue, rowFromClient, stats, type BatchContext } from "./ingest.js";
import { parseUserAgent } from "./sanitize.js";

/**
 * POST /api/events — recebe um lote de eventos do site (até 50). Sempre responde 204, mesmo quando descarta, porque o
 * navegador não deve repetir nem mostrar nada. Aceita text/plain (sendBeacon sem pré-checagem de CORS) e application/json.
 */
export const eventsRouter = Router();

const MAX_EVENTS = 50;

eventsRouter.post("/", eventsFlood, express.text({ type: "text/plain", limit: "64kb" }), (req, res) => {
  res.status(204).end();
  // "Não rastrear" ligado no navegador: nada é gravado
  if (req.get("dnt") === "1" || req.get("sec-gpc") === "1") return;
  const ua = parseUserAgent(req.get("user-agent"));
  if (ua.bot) return;
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return;
    }
  }
  const batch = (body ?? {}) as { sent_at?: unknown; events?: unknown };
  if (!Array.isArray(batch.events)) return;
  const ctx: BatchContext = {
    receivedAt: new Date(),
    sentAt: typeof batch.sent_at === "number" ? batch.sent_at : null,
    browser: ua.browser,
    os: ua.os,
  };
  const rows = batch.events.slice(0, MAX_EVENTS).map((e) => rowFromClient(e, ctx));
  const accepted = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  stats.dropped += rows.length - accepted.length;
  enqueue(accepted);
});
