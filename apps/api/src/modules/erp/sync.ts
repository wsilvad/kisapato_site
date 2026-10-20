import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getBrands, getItem, getSiteItems, getStock, isSiteFlagged, type ErpItem } from "./client.js";
import { newCatalog, type CatalogCreated } from "./catalog.js";
import { applyPlan } from "./import.js";
import { buildPlan, titleCase } from "./mapping.js";

/** Um produto que a atualização não conseguiu importar ou atualizar, com o que a loja precisa ajustar. */
export interface ReviewItem {
  reference: string;
  brand: string;
  reason: string;
}

export interface RefreshReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** Itens (cores) marcados para o site que o ERP devolveu. */
  flaggedItems: number;
  /** Produtos (marca + referência) conferidos nesta rodada: os marcados e os que já tinham vindo do ERP. */
  productsChecked: number;
  /** Produtos novos no painel (entram DESATIVADOS: falta foto e descrição, que são do site). */
  created: { name: string; reference: string; colors: number }[];
  /** Produtos que já existiam e mudaram com o ERP (preço, dados, cores, numerações ou estoque). */
  updated: { name: string; reference: string; newColors: number; stockChanges: number; priceChanged: boolean; disabledColors: string[]; enabledColors: string[] }[];
  /** Produtos que já existiam e estavam iguais ao ERP. */
  unchanged: number;
  /** Marcas, classes e categorias que não existiam no site e foram criadas (ajuste os nomes em Marcas/Categorias, se quiser). */
  catalogCreated: CatalogCreated;
  needsReview: ReviewItem[];
  /** Pendências abertas depois desta atualização (o aviso de atenção no topo de Produtos) e quantas surgiram nela. */
  attention: number;
  newIssues: number;
}

/** Andamento da atualização (a tela consulta enquanto roda, inclusive depois de recarregar a página). */
export interface RefreshStatus {
  running: boolean;
  phase: "idle" | "brands" | "products" | "saving" | "done" | "failed";
  /** Texto da etapa, ex.: "Lendo as marcas no ERP (40 de 114)". */
  label: string;
  percent: number;
  startedAt: string | null;
  finishedAt: string | null;
  /** Resultado da última atualização concluída (fica guardado até a próxima ou até a API reiniciar). */
  report: RefreshReport | null;
  error: string | null;
}

const keyOf = (brandCode: string, ref: string) => `${brandCode}\u0000${ref}`;

/** Roda `fn` sobre a lista com no máximo `limit` ao mesmo tempo (as chamadas ao ERP ainda passam pelo limite do client.ts). */
async function pool<T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        results[i] = await fn(list[i]!);
      }
    }),
  );
  return results;
}

/** Resultado de um produto (marca + referência) na rodada: o que precisa de atenção e o produto do site, se houver. */
interface Outcome {
  brandCode: string;
  ref: string;
  problems: string[];
  productId: string | null;
}

/**
 * Avisos do plano que pedem a loja: dados diferentes entre as cores e estoque fora da grade. Ficam de fora os previstos nas
 * regras: saldo negativo vira 0, preço e custo próprios por cor e item desativado no ERP (a cor sai da loja sozinha e o
 * resultado da atualização lista as cores desabilitadas).
 */
const needsAttention = (warning: string) => /^(Tipo|Gênero|Nome) diferente entre as cores|fora da grade/.test(warning);

/**
 * Grava as pendências desta rodada de uma vez: lê as existentes, apaga as resolvidas (ou de produtos que saíram do ERP) e só
 * escreve as novas ou alteradas. Devolve quantas ficaram abertas e quantas são novas.
 */
async function saveIssues(outcomes: Outcome[], brandName: Map<string, string>, unreadBrands: Set<string>) {
  const existing = await prisma.erpIssue.findMany();
  const byKey = new Map(existing.map((i) => [keyOf(i.brandCode, i.ref), i]));
  const open = new Map(outcomes.filter((o) => o.problems.length > 0).map((o) => [keyOf(o.brandCode, o.ref), o]));
  const seen = new Set(outcomes.map((o) => keyOf(o.brandCode, o.ref)));

  // resolvidas nesta rodada, ou de produtos que nem apareceram (marca que falhou na leitura: mantém)
  const remove = existing.filter((i) => {
    const key = keyOf(i.brandCode, i.ref);
    return !open.has(key) && (seen.has(key) || !unreadBrands.has(i.brandCode));
  });
  if (remove.length > 0) await prisma.erpIssue.deleteMany({ where: { id: { in: remove.map((i) => i.id) } } });

  let fresh = 0;
  for (const [key, o] of open) {
    const data = { brandName: brandName.get(o.brandCode) ?? o.brandCode, reason: o.problems.join("\n"), productId: o.productId };
    const current = byKey.get(key);
    if (!current) fresh++;
    if (current && current.reason === data.reason && current.productId === data.productId && current.brandName === data.brandName) continue;
    // uma pendência antiga presa ao mesmo produto (outra referência) solta o vínculo antes
    if (o.productId && existing.some((i) => i.productId === o.productId && keyOf(i.brandCode, i.ref) !== key && !remove.includes(i))) {
      await prisma.erpIssue.updateMany({ where: { productId: o.productId, NOT: { brandCode: o.brandCode, ref: o.ref } }, data: { productId: null } });
    }
    await prisma.erpIssue.upsert({ where: { brandCode_ref: { brandCode: o.brandCode, ref: o.ref } }, create: { brandCode: o.brandCode, ref: o.ref, ...data }, update: data });
  }
  const kept = existing.length - remove.length;
  return { attention: kept + fresh, newIssues: fresh };
}

/** Pendências abertas, para o aviso e o filtro de Produtos. */
export const listIssues = () =>
  prisma.erpIssue.findMany({ select: { id: true, brandName: true, ref: true, reason: true, productId: true, updatedAt: true }, orderBy: [{ brandName: "asc" }, { ref: "asc" }] });

/** Andamento guardado na memória da API (uma atualização por vez; a Discloud roda uma instância só). */
let status: RefreshStatus = { running: false, phase: "idle", label: "", percent: 0, startedAt: null, finishedAt: null, report: null, error: null };
export const getRefreshStatus = (): RefreshStatus => status;

/** Peso de cada etapa na barra: ler as marcas é rápido e fixo; conferir os produtos depende de quantos são. */
function progress(phase: RefreshStatus["phase"], done: number, total: number, label: string) {
  const [from, to] = phase === "brands" ? [0, 35] : phase === "products" ? [35, 95] : [95, 100];
  status = { ...status, phase, label, percent: Math.min(99, Math.round(from + ((to - from) * done) / Math.max(1, total))) };
}

/**
 * Começa a atualização em segundo plano e devolve o andamento na hora. Se já houver uma rodando, só devolve o andamento dela
 * (clicar de novo, ou recarregar a página e clicar, não começa outra).
 */
export function startRefresh(): RefreshStatus {
  if (status.running) return status;
  const startedAt = new Date().toISOString();
  status = { running: true, phase: "brands", label: "Começando…", percent: 0, startedAt, finishedAt: null, report: status.report, error: null };
  void refreshFromErp(startedAt).then(
    (report) => (status = { running: false, phase: "done", label: "Concluída", percent: 100, startedAt, finishedAt: report.finishedAt, report, error: null }),
    (error: unknown) => {
      console.error("[erp] atualização falhou:", error);
      status = { ...status, running: false, phase: "failed", label: "Falhou", finishedAt: new Date().toISOString(), error: error instanceof AppError ? error.message : "A atualização falhou. Veja o log da API e tente de novo." };
    },
  );
  return status;
}

/**
 * Atualiza o catálogo do painel com o ERP, só lendo dele:
 *  1. procura os itens marcados para o site em todas as marcas;
 *  2. para cada produto (marca + referência) dos marcados e dos que já vieram do ERP, monta o plano com as cores e o estoque
 *     atuais e grava só o que mudou (produto novo nasce desativado; fotos, descrição, selo e "ativo" não são mexidos).
 * Marca, classe e categoria que faltarem no site são criadas na hora (tipo do ERP → categoria pelo de-para de mapping.ts).
 * O que foge das regras vira pendência (`erp_issues`) e os demais produtos seguem.
 */
async function refreshFromErp(startedAt: string): Promise<RefreshReport> {
  const t0 = Date.now();
  const brands = await getBrands();
  const brandName = new Map(brands.map((b) => [b.code, titleCase(b.name)]));
  const needsReview: ReviewItem[] = [];
  const unreadBrands = new Set<string>();
  const linked = await prisma.product.findMany({ where: { erpBrandCode: { not: null }, erpRef: { not: null } }, select: { id: true, erpBrandCode: true, erpRef: true, colors: { select: { erpItemCode: true } } } });
  const linkedBrands = new Set(linked.map((p) => p.erpBrandCode!));

  // 1) itens marcados para o site, marca por marca (cada cor é um item)
  let read = 0;
  progress("brands", 0, brands.length, `Lendo as marcas no ERP (0 de ${brands.length})`);
  const perBrand = await pool(brands, 4, async (b) => {
    try {
      let items = await getSiteItems(b.code);
      // lista vazia numa marca que já tem produtos no site: confere de novo antes de acreditar
      if (items.length === 0 && linkedBrands.has(b.code)) items = await getSiteItems(b.code);
      return items;
    } catch (error) {
      unreadBrands.add(b.code);
      needsReview.push({ reference: "—", brand: brandName.get(b.code) ?? b.code, reason: `Não consegui ler os itens da marca no ERP (${(error as Error).message}).` });
      return [] as ErpItem[];
    } finally {
      read++;
      progress("brands", read, brands.length, `Lendo as marcas no ERP (${read} de ${brands.length})`);
    }
  });
  if (unreadBrands.size === brands.length) throw new AppError("Não consegui ler o ERP. Tente de novo em instantes.", 502);
  const flagged = perBrand.flat().filter(isSiteFlagged);

  const groups = new Map<string, { brandCode: string; ref: string; flagged: Map<string, ErpItem>; known: Set<string> }>();
  const group = (brandCode: string, ref: string) => {
    const key = keyOf(brandCode, ref);
    if (!groups.has(key)) groups.set(key, { brandCode, ref, flagged: new Map(), known: new Set() });
    return groups.get(key)!;
  };
  const noRef: ErpItem[] = [];
  for (const item of flagged) {
    if (!item.supplierRef) {
      noRef.push(item);
      needsReview.push({ reference: item.pkItem, brand: brandName.get(item.brandCode) ?? item.brandCode, reason: "Item marcado para o site sem referência do fornecedor no ERP." });
      continue;
    }
    group(item.brandCode, item.supplierRef).flagged.set(item.pkItem, item);
  }
  // 2) produtos que já vieram do ERP entram junto: as cores deles são conferidas mesmo se saíram da marcação
  for (const p of linked) for (const c of p.colors) if (c.erpItemCode) group(p.erpBrandCode!, p.erpRef!).known.add(c.erpItemCode);

  const catalog = newCatalog();
  const report: RefreshReport = {
    startedAt, finishedAt: "", durationMs: 0, flaggedItems: flagged.length, productsChecked: groups.size,
    created: [], updated: [], unchanged: 0, catalogCreated: catalog.created, needsReview, attention: 0, newIssues: 0,
  };

  // 3) cada produto (marca + referência): importa/atualiza e anota o que fugiu do previsto
  const linkedId = new Map(linked.map((p) => [keyOf(p.erpBrandCode!, p.erpRef!), p.id]));
  const outcomes: Outcome[] = [];
  let checked = 0;
  progress("products", 0, groups.size, `Conferindo os produtos (0 de ${groups.size})`);
  await pool([...groups.values()], 6, async (g) => {
    const label = { reference: g.ref, brand: brandName.get(g.brandCode) ?? g.brandCode };
    const outcome: Outcome = { brandCode: g.brandCode, ref: g.ref, problems: [], productId: linkedId.get(keyOf(g.brandCode, g.ref)) ?? null };
    outcomes.push(outcome);
    const fail = (reason: string) => {
      outcome.problems.push(reason);
      needsReview.push({ ...label, reason });
    };
    try {
      const codes = new Set([...g.flagged.keys(), ...g.known]);
      const items = (await Promise.all([...codes].map(async (code) => g.flagged.get(code) ?? (await getItem(code))))).filter((i): i is ErpItem => i !== null);
      if (items.length === 0) return fail("Os itens deste produto não existem mais no ERP.");
      const plan = buildPlan(await Promise.all(items.map(async (item) => ({ item, stock: await getStock(item.pkItem) }))), { brandName: brandName.get(g.brandCode) });
      if (plan.errors.length > 0) return fail(`Não importado: ${plan.errors.join(" ")}`);
      const anyFlagged = plan.colors.some((c) => c.flagged);
      // produto já no site sem nenhuma cor marcada no ERP: segue (as cores ficam desabilitadas); novo, nunca chega aqui
      if (!anyFlagged && !outcome.productId) return fail("Não importado: nenhuma cor está marcada para o site no ERP.");
      if (anyFlagged && plan.product.price <= 0) return fail(outcome.productId ? "Sem preço de venda do site no ERP: o produto não foi atualizado." : "Não importado: sem preço de venda do site no ERP.");
      const result = await applyPlan(plan, catalog);
      outcome.productId = result.productId;
      outcome.problems.push(...plan.warnings.filter(needsAttention));
      if (result.created) report.created.push({ name: plan.product.name, reference: g.ref, colors: plan.colors.length });
      else if (result.changed) report.updated.push({ name: plan.product.name, reference: g.ref, newColors: result.colors.created, stockChanges: result.variants.stockChanges, priceChanged: result.priceChanged, disabledColors: result.disabledColors, enabledColors: result.enabledColors });
      else report.unchanged++;
    } catch (error) {
      if (error instanceof AppError) return fail(`Não importado: ${error.message}`);
      console.error(`[erp] falha ao gravar ${g.brandCode}/${g.ref}:`, error);
      fail("Não importado: erro ao gravar no banco (detalhe no log da API).");
    } finally {
      checked++;
      progress("products", checked, groups.size, `Conferindo os produtos (${checked} de ${groups.size})`);
    }
  });
  for (const item of noRef) outcomes.push({ brandCode: item.brandCode, ref: item.pkItem, problems: ["Não importado: item marcado para o site sem referência do fornecedor no ERP."], productId: null });

  progress("saving", 0, 1, "Gravando as pendências");
  Object.assign(report, await saveIssues(outcomes, brandName, unreadBrands));

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");
  report.created.sort(byName);
  report.updated.sort(byName);
  needsReview.sort((a, b) => a.brand.localeCompare(b.brand, "pt-BR") || a.reference.localeCompare(b.reference, "pt-BR"));
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - t0;
  return report;
}
