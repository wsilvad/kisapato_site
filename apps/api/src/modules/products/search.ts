import { prisma } from "../../lib/prisma.js";

/**
 * Busca da loja, tolerante a erros: ignora acentos e maiúsculas, procura em nome (do site e do ERP), referência, código
 * do item, marca, categoria, classe, cores e público, aceita plural/singular e palavras pela metade. Primeiro vale a
 * correspondência exata (depois de tirar acentos); se nada bater, cai para a semelhança (erros de digitação).
 * O catálogo é pequeno, então o índice fica em memória por alguns segundos em vez de exigir extensões no banco.
 */

export type SearchMode = "exact" | "similar";
export interface SearchResult {
  /** Ids na ordem de relevância (o mais relevante primeiro). */
  ids: string[];
  mode: SearchMode;
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "para", "pra", "com", "em", "no", "na", "um", "uma"]);

/** "Tênis Luz-da-Lua" → "tenis luz da lua". */
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/(^|\s)\.+|\.+(\s|$)/g, " ")
    .trim();

/** Singular e plural iguais ("botas" = "bota", "sandalias" = "sandalia"); números e códigos ficam como estão. */
const stem = (token: string) => (token.length > 3 && /[a-z]s$/.test(token) && !/\d/.test(token) ? token.slice(0, -1) : token);

export const tokens = (value: string) => normalize(value).split(" ").filter(Boolean).map(stem);

/** Distância de edição com troca de letras vizinhas (Damerau–Levenshtein restrita), parando cedo se passar de `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j]!;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Quantos erros a palavra aceita: curtas nenhum, médias 1, longas 2. */
const allowedEdits = (term: string) => (term.length <= 3 ? 0 : term.length <= 6 ? 1 : 2);

export interface SearchDoc {
  id: string;
  createdAt: number;
  /** Palavras do produto (já normalizadas) com o peso de onde vieram (nome e referência pesam mais que cor). */
  words: Map<string, number>;
}

/** Palavras de público para a busca entender "feminino", "masculino", "infantil", "menina"… */
const AUDIENCE: Record<string, string> = {
  "ADULTO|FEMININO": "feminino feminina mulher",
  "ADULTO|MASCULINO": "masculino masculina homem",
  "ADULTO|UNISSEX": "unissex feminino masculino",
  "INFANTIL|FEMININO": "infantil crianca menina kids",
  "INFANTIL|MASCULINO": "infantil crianca menino kids",
  "INFANTIL|UNISSEX": "infantil crianca menina menino kids",
};

interface DocSource {
  id: string;
  createdAt: Date;
  name: string;
  erpName?: string | null;
  reference?: string | null;
  erpRef?: string | null;
  ageGroup: string;
  gender: string;
  brand?: { name: string } | null;
  category: { name: string; productClass?: { name: string } | null };
  colors: { name: string; erpItemCode?: string | null }[];
  variants: { color: string; sku: string }[];
}

export function toDoc(p: DocSource): SearchDoc {
  const words = new Map<string, number>();
  const add = (text: string | null | undefined, weight: number) => {
    if (!text) return;
    const list = tokens(text);
    for (const w of list) words.set(w, Math.max(words.get(w) ?? 0, weight));
    // nomes de várias palavras também valem juntos ("luzdalua", "sapatenis")
    if (list.length > 1) words.set(list.join(""), Math.max(words.get(list.join("")) ?? 0, weight));
  };
  add(p.name, 1);
  add(p.erpName, 1);
  add(p.reference, 1);
  add(p.erpRef, 1);
  add(p.brand?.name, 1);
  add(p.category.name, 1);
  add(p.category.productClass?.name, 0.8);
  for (const c of p.colors) {
    add(c.name, 0.8);
    add(c.erpItemCode, 0.9);
  }
  for (const v of p.variants) {
    add(v.color, 0.8);
    add(v.sku, 0.6);
  }
  add(AUDIENCE[`${p.ageGroup}|${p.gender}`], 0.7);
  return { id: p.id, createdAt: p.createdAt.getTime(), words };
}

/** Melhor nota de um termo da busca num produto: exata 3, começo da palavra 2, trecho de código 2, parecida 1 a 0,4. */
function termScore(term: string, doc: SearchDoc, fuzzy: boolean): number {
  let best = 0;
  const max = allowedEdits(term);
  const isCode = /\d/.test(term);
  for (const [word, weight] of doc.words) {
    let s = 0;
    if (word === term) s = 3;
    else if (term.length >= 2 && word.startsWith(term)) s = 2;
    else if (isCode && term.length >= 3 && word.includes(term)) s = 2;
    else if (fuzzy && max > 0 && !isCode) {
      const d = editDistance(term, word.length > term.length + max ? word.slice(0, term.length + max) : word, max);
      // palavra digitada pela metade e com erro ("sandla") vale como começo parecido
      if (d <= max) s = 1 - (d - 1) * 0.3;
    }
    s *= weight;
    if (s > best) best = s;
    if (best >= 3) break;
  }
  return best;
}

/**
 * Procura os produtos pelo texto digitado. Fase 1 (exata): todos os termos batem por inteiro, pelo começo ou como trecho
 * de código. Fase 2 (semelhança), só se a fase 1 não achar nada: cada termo pode ter erros de digitação; se nem assim
 * todos baterem, aceita os produtos que batem com a maior parte dos termos.
 */
export function searchDocs(query: string, docs: SearchDoc[]): SearchResult {
  const all = tokens(query);
  const terms = all.filter((t) => !STOPWORDS.has(t));
  const list = terms.length > 0 ? terms : all;
  if (list.length === 0) return { ids: [], mode: "exact" };

  const rank = (fuzzy: boolean, minTerms: number) =>
    docs
      .map((doc) => {
        const scores = list.map((t) => termScore(t, doc, fuzzy));
        const hits = scores.filter((s) => (fuzzy ? s > 0 : s >= 1.2)).length;
        return { doc, hits, total: scores.reduce((a, b) => a + b, 0) };
      })
      .filter((r) => r.hits >= minTerms)
      .sort((a, b) => b.hits - a.hits || b.total - a.total || b.doc.createdAt - a.doc.createdAt)
      .map((r) => r.doc.id);

  const exact = rank(false, list.length);
  if (exact.length > 0) return { ids: exact, mode: "exact" };
  const similar = rank(true, list.length);
  if (similar.length > 0 || list.length === 1) return { ids: similar, mode: "similar" };
  return { ids: rank(true, Math.ceil(list.length / 2)), mode: "similar" };
}

const TTL_MS = 30_000;
let cache: { at: number; docs: Promise<SearchDoc[]> } | null = null;

/** Índice dos produtos visíveis (recriado a cada 30 s: produto novo ou editado entra na busca logo). */
export function searchIndex(visibleWhere: object): Promise<SearchDoc[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.docs;
  const docs = prisma.product
    .findMany({
      where: visibleWhere,
      select: {
        id: true,
        createdAt: true,
        name: true,
        erpName: true,
        reference: true,
        erpRef: true,
        ageGroup: true,
        gender: true,
        brand: { select: { name: true } },
        category: { select: { name: true, productClass: { select: { name: true } } } },
        colors: { select: { name: true, erpItemCode: true } },
        variants: { select: { color: true, sku: true } },
      },
    })
    .then((list) => list.map(toDoc));
  cache = { at: Date.now(), docs };
  docs.catch(() => (cache = null));
  return docs;
}

export async function searchProducts(query: string, visibleWhere: object): Promise<SearchResult> {
  return searchDocs(query, await searchIndex(visibleWhere));
}
