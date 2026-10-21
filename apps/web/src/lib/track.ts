/**
 * Medição do site (SDK do navegador). Junta eventos em lote e os entrega a "destinos": a API da própria loja (sempre) e,
 * se configurado, o PostHog. Sem cookies de terceiros, sem dado pessoal: só um identificador anônimo aleatório.
 * Regras de privacidade: respeita "Não rastrear" (DNT), Global Privacy Control e o opt-out local (`localStorage ks:optout=1`);
 * nunca mede o painel (/admin); `NEXT_PUBLIC_ANALYTICS=off` desliga tudo.
 * Registro dos eventos: apps/api/src/modules/analytics/registry.ts (catálogo em docs/analytics/events-catalog.md).
 */

// Calculado aqui (e não importado de api.ts) porque api.ts importa este arquivo.
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
const ENDPOINT = `${API}/events`;

const AID_KEY = "ks:aid";
const SID_KEY = "ks:sid";
const OPTOUT_KEY = "ks:optout";
const AID_TTL_MS = 395 * 24 * 3600_000; // 13 meses
const SESSION_IDLE_MS = 30 * 60_000;
const FLUSH_MS = 3000;
const MAX_BATCH = 50;

export interface TrackFields {
  product_id?: string | null;
  variant_id?: string | null;
  list_name?: string | null;
  list_position?: number | null;
  price?: number | null;
  quantity?: number | null;
  cart_value?: number | null;
  items_count?: number | null;
  search_term?: string | null;
  results_count?: number | null;
  value_num?: number | null;
  error_code?: string | null;
  props?: Record<string, unknown>;
}

export interface TrackRow extends TrackFields {
  event: string;
  ts: number;
  anonymous_id: string;
  session_id: string;
  path: string;
  viewport_w: number;
  referrer_host?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

type Destination = (events: TrackRow[], sentAt: number) => void;

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* sem armazenamento: o identificador vale só nesta aba */
  }
};

const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Medição ligada? Falso no servidor, no painel, com "Não rastrear"/GPC, com opt-out ou com a chave geral desligada. */
export function trackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_ANALYTICS === "off") return false;
  if (window.location.pathname.startsWith("/admin")) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (navigator.doNotTrack === "1" || nav.globalPrivacyControl === true) return false;
  return read(OPTOUT_KEY) !== "1";
}

interface SessionRecord {
  id: string;
  last: number;
  /** Já mandou a origem (UTM e site de origem) nesta visita? Só o primeiro evento leva. */
  landed: boolean;
}

let cachedAid: string | null = null;
let memorySession: SessionRecord | null = null;

function anonymousId(): string {
  if (cachedAid) return cachedAid;
  try {
    const saved = JSON.parse(read(AID_KEY) ?? "null") as { id?: string; at?: number } | null;
    if (saved?.id && typeof saved.at === "number" && Date.now() - saved.at < AID_TTL_MS) return (cachedAid = saved.id);
  } catch {
    /* identificador corrompido: cria outro */
  }
  cachedAid = uuid();
  write(AID_KEY, JSON.stringify({ id: cachedAid, at: Date.now() }));
  return cachedAid;
}

/** Visita atual: renova o horário de atividade; depois de 30 minutos parado, começa outra. */
function session(): SessionRecord {
  const now = Date.now();
  let rec: SessionRecord | null = null;
  try {
    rec = JSON.parse(read(SID_KEY) ?? "null") as SessionRecord | null;
  } catch {
    rec = null;
  }
  rec ??= memorySession;
  if (!rec || typeof rec.last !== "number" || now - rec.last > SESSION_IDLE_MS) rec = { id: uuid(), last: now, landed: false };
  rec.last = now;
  memorySession = rec;
  write(SID_KEY, JSON.stringify(rec));
  return rec;
}

/** Cabeçalhos que ligam as chamadas à API (ex.: criar pedido) à visita; vazio quando a medição está desligada. */
export function trackingHeaders(): Record<string, string> {
  if (!trackingEnabled()) return {};
  return { "X-Ks-Aid": anonymousId(), "X-Ks-Sid": session().id };
}

// --- tradução de nomes para os destinos (espelha o registro da API) ---------------------------------------------
const GA4: Record<string, string> = {
  product_impression: "view_item_list", product_click: "select_item", product_view: "view_item", favorite_add: "add_to_wishlist",
  checkout_step: "add_shipping_info", payment_method_selected: "add_payment_info",
};
const POSTHOG_SPECIAL: Record<string, string> = { page_view: "$pageview", rage_click: "$rageclick", js_error: "$exception" };

// --- destinos -----------------------------------------------------------------------------------------------------
const own: Destination = (events, sentAt) => {
  const body = JSON.stringify({ sent_at: sentAt, events });
  // text/plain evita a pré-checagem de CORS e funciona com sendBeacon ao fechar a página
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
  void fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => undefined);
};

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
const posthog: Destination = (events) => {
  const batch = events.map((e) => {
    const { event, ts, anonymous_id, session_id, props, ...rest } = e;
    return {
      event: POSTHOG_SPECIAL[event] ?? GA4[event] ?? event,
      distinct_id: anonymous_id,
      timestamp: new Date(ts).toISOString(),
      properties: { ...rest, ...props, $session_id: session_id, $current_url: rest.path, ks_event: event },
    };
  });
  void fetch(`${posthogHost}/batch/`, { method: "POST", body: JSON.stringify({ api_key: posthogKey, batch }), headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => undefined);
};

const destinations: Destination[] = posthogKey ? [own, posthog] : [own];

// --- fila e envio -------------------------------------------------------------------------------------------------
const queue: TrackRow[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function flush(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length > 0) {
    const batch = queue.splice(0, MAX_BATCH);
    const sentAt = Date.now();
    for (const d of destinations) {
      try {
        d(batch, sentAt);
      } catch {
        /* um destino com problema não derruba os outros */
      }
    }
  }
}

const externalReferrer = (): string | null => {
  try {
    const host = new URL(document.referrer).host;
    return host && host !== window.location.host ? host : null;
  } catch {
    return null;
  }
};

/**
 * Eventos que descrevem um fato único da página (não uma ação do cliente): se o mesmo evento idêntico chegar duas vezes em menos de
 * 1 segundo (efeito do React rodando duas vezes em desenvolvimento, por exemplo), só o primeiro vale. Ações (clique, sacola) nunca são descartadas.
 */
const ONCE = new Set(["page_view", "product_view", "search", "not_found", "begin_checkout", "web_vital"]);
const recent = new Map<string, number>();

/** Registra um evento (ver registry.ts da API). Nunca lança erro e não faz nada se a medição estiver desligada. */
export function track(event: string, fields: TrackFields = {}): void {
  if (!trackingEnabled()) return;
  try {
    if (ONCE.has(event)) {
      const key = `${event}|${window.location.pathname}|${fields.product_id ?? ""}|${fields.search_term ?? ""}|${fields.error_code ?? ""}|${JSON.stringify(fields.props ?? {})}|${fields.value_num ?? ""}`;
      const now = Date.now();
      if (now - (recent.get(key) ?? 0) < 1000) return;
      recent.set(key, now);
      if (recent.size > 200) recent.clear();
    }
    const s = session();
    const row: TrackRow = { event, ts: Date.now(), anonymous_id: anonymousId(), session_id: s.id, path: window.location.pathname, viewport_w: window.innerWidth, ...fields };
    if (!s.landed) {
      const q = new URLSearchParams(window.location.search);
      row.referrer_host = externalReferrer();
      row.utm_source = q.get("utm_source");
      row.utm_medium = q.get("utm_medium");
      row.utm_campaign = q.get("utm_campaign");
      s.landed = true;
      write(SID_KEY, JSON.stringify(s));
      memorySession = s;
    }
    queue.push(row);
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(flush, FLUSH_MS);
  } catch {
    /* medição nunca pode atrapalhar a loja */
  }
}

/** Endereço da API sem ids (para agrupar erros por rota): /orders/ab12… → /orders/:id; no máximo 3 trechos. */
export function endpointOf(path: string): string {
  return path
    .split("?")[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d{3,}(?=\/|$)/g, "/:id")
    .split("/")
    .slice(0, 4)
    .join("/");
}

/** Erro numa chamada à API (4xx, exceto 401, 5xx ou falha de rede). Chamado por lib/api.ts. */
export function trackApiError(path: string, method: string, status: number | "network", ms: number): void {
  if (path.startsWith("/admin") || status === 401) return;
  track("api_error", { error_code: String(status), props: { endpoint: endpointOf(path), method, ms: Math.round(ms) } });
}
