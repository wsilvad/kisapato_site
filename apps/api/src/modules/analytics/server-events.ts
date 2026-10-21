import type { Request } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ZERO_UUID, enqueue, type EventRow } from "./ingest.js";
import { cleanText, isUuid, normalizePath, parseUserAgent, propsOf } from "./sanitize.js";

/** O site manda estes cabeçalhos em toda chamada à API; com eles o servidor liga a compra à visita. */
export const ANON_HEADER = "x-ks-aid";
export const SESSION_HEADER = "x-ks-sid";

type Reader = Pick<Request, "get">;

export interface ServerEvent {
  event: "purchase" | "api_error";
  path?: string | null;
  product_id?: string | null;
  cart_value?: number | null;
  items_count?: number | null;
  error_code?: string | null;
  props?: Record<string, unknown>;
}

/** Grava um evento no servidor (sem depender do navegador, então antibloqueadores não o escondem). Nunca lança erro. */
export function recordServerEvent(req: Reader | null, e: ServerEvent): void {
  if (!env.ANALYTICS_ENABLED) return;
  try {
    const aid = req?.get(ANON_HEADER);
    const sid = req?.get(SESSION_HEADER);
    const ua = parseUserAgent(req?.get("user-agent") ?? undefined);
    const row: EventRow = {
      occurred_at: new Date(),
      schema_v: 1,
      event: e.event,
      anonymous_id: isUuid(aid) ? aid.toLowerCase() : ZERO_UUID,
      session_id: isUuid(sid) ? sid.toLowerCase() : ZERO_UUID,
      profile_id: null,
      path: normalizePath(e.path ?? null),
      referrer_host: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      device_type: null,
      browser: ua.browser,
      os: ua.os,
      viewport_w: null,
      product_id: cleanText(e.product_id, 64),
      variant_id: null,
      list_name: null,
      list_position: null,
      price: null,
      quantity: null,
      cart_value: e.cart_value ?? null,
      items_count: e.items_count ?? null,
      search_term: null,
      results_count: null,
      value_num: null,
      error_code: cleanText(e.error_code, 120),
      props: { ...propsOf(e.props), server: true },
    };
    enqueue([row]);
  } catch (error) {
    console.error("[analytics] evento do servidor descartado:", (error as Error).message);
  }
}

/** Liga o visitante anônimo ao cliente logado. Só grava se ANALYTICS_IDENTIFY estiver ligado (decisão de privacidade). */
export async function linkIdentity(req: Reader, profileId: string): Promise<void> {
  if (!env.ANALYTICS_ENABLED || !env.ANALYTICS_IDENTIFY) return;
  const aid = req.get(ANON_HEADER);
  if (!isUuid(aid) || !isUuid(profileId)) return;
  try {
    await prisma.$executeRaw`INSERT INTO analytics.identities (anonymous_id, profile_id) VALUES (${aid.toLowerCase()}::uuid, ${profileId}::uuid) ON CONFLICT DO NOTHING`;
  } catch (error) {
    console.error("[analytics] falha ao ligar identidade:", (error as Error).message.split("\n").slice(-1)[0]);
  }
}
