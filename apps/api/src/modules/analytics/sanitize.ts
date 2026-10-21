/** Limpeza do que chega do navegador antes de gravar: sem dado pessoal, sem texto gigante, sem formato inesperado. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return t === "" ? null : t;
};

export const cleanNumber = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v < min || v > max ? null : v;
};

export const cleanInt = (v: unknown, min: number, max: number): number | null => {
  const n = cleanNumber(v, min, max);
  return n === null ? null : Math.round(n);
};

/** E-mail, CPF e telefone digitados na busca viram "[removido]". */
export function redactSearchTerm(v: unknown): string | null {
  const t = cleanText(v, 120);
  if (t === null) return null;
  const clean = t
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[removido]")
    .replace(/\(?\+?\d[\d\s().-]{8,}\d/g, "[removido]")
    .slice(0, 80)
    .trim();
  return clean === "" ? null : clean;
}

/** Só o caminho, sem endereço do site, parâmetros nem âncora; ids longos viram ":id". */
export function normalizePath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let p = v.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    return null;
  }
  p = p.split("?")[0]!.split("#")[0]!;
  if (!p.startsWith("/")) return null;
  p = p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id").replace(/\/\d{5,}(?=\/|$)/g, "/:id");
  return p.slice(0, 300);
}

/** Chaves que nunca entram em props, por maior que seja a boa intenção de quem enviou. */
const BLOCKED_KEY = /(e-?mail|cpf|cnpj|senha|password|token|telefone|phone|celular|cart[aã]o|card|nome|name_full|endere[cç]o|address|cep$)/i;
// "item_name" é nome de produto (permitido); "cep3" é só o prefixo do CEP.
const ALLOWED_KEY = /^(item_name|cep3|filename)$/;

export function cleanProps(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "string") return input.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  if (typeof input === "boolean") return input;
  if (depth >= 3) return undefined;
  if (Array.isArray(input)) return input.slice(0, 50).map((x) => cleanProps(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 30)) {
      if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
      if (BLOCKED_KEY.test(k) && !ALLOWED_KEY.test(k)) continue;
      const c = cleanProps(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/** props final: objeto simples de até 4 KB (acima disso, descarta). */
export function propsOf(input: unknown): Record<string, unknown> {
  const c = cleanProps(input);
  if (!c || typeof c !== "object" || Array.isArray(c)) return {};
  return JSON.stringify(c).length > 4000 ? {} : (c as Record<string, unknown>);
}

export const deviceFromWidth = (w: number | null): "mobile" | "tablet" | "desktop" | null => (w === null ? null : w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop");

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget|python-requests|python-urllib|axios|node-fetch|go-http|postman|java\//i;

export function parseUserAgent(ua: string | undefined): { browser: string | null; os: string | null; bot: boolean } {
  const s = ua ?? "";
  if (s === "" || BOT.test(s)) return { browser: null, os: null, bot: true };
  const browser = /SamsungBrowser/i.test(s) ? "Samsung" : /Edg\//.test(s) ? "Edge" : /OPR\/|Opera/.test(s) ? "Opera" : /Firefox|FxiOS/.test(s) ? "Firefox" : /Chrome|CriOS/.test(s) ? "Chrome" : /Safari/.test(s) ? "Safari" : "Outro";
  const os = /iPhone|iPad|iPod/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /Linux|X11/.test(s) ? "Linux" : "Outro";
  return { browser, os, bot: false };
}
