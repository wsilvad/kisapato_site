import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getBrands, getItem, getSiteItems, getStock, isSiteFlagged, type ErpItem } from "./client.js";
import { applyPlan } from "./import.js";
import { buildPlan, titleCase } from "./mapping.js";

/** Um produto que a atualização não conseguiu importar ou atualizar, com o que a loja precisa ajustar. */
export interface ReviewItem {
  reference: string;
  brand: string;
  reason: string;
}

export interface RefreshReport {
  finishedAt: string;
  /** Itens marcados para o site que o ERP devolveu. */
  flaggedItems: number;
  /** Produtos novos no painel (entram DESATIVADOS: falta foto e descrição, que são do site). */
  created: { name: string; reference: string; colors: number }[];
  /** Produtos que já existiam e foram conferidos com o ERP (preço, cores, numerações e estoque). */
  updated: { name: string; reference: string; newColors: number; stockChanges: number }[];
  needsReview: ReviewItem[];
}

const keyOf = (brandCode: string, ref: string) => `${brandCode}\u0000${ref}`;

/** Roda `fn` sobre a lista com no máximo `limit` chamadas ao mesmo tempo (o ERP é um serviço pequeno). */
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

let running = false;

/**
 * Atualiza o catálogo do painel com o ERP, só lendo dele:
 *  1. procura os itens marcados para o site em todas as marcas;
 *  2. para cada produto (marca + referência) dos marcados e dos que já vieram do ERP, monta o plano com as cores e o estoque
 *     atuais e grava (produto novo nasce desativado; os campos do site — fotos, descrição, selo, "ativo" — não são mexidos).
 * Produto que não dá para importar (tipo sem categoria, marca não cadastrada, grade estranha, sem preço) vai para
 * `needsReview` e os demais seguem. Uma atualização por vez.
 */
export async function refreshFromErp(): Promise<RefreshReport> {
  if (running) throw new AppError("Já existe uma atualização com o ERP em andamento. Aguarde terminar.", 409);
  running = true;
  try {
    const brands = await getBrands();
    const brandName = new Map(brands.map((b) => [b.code, titleCase(b.name)]));
    const needsReview: ReviewItem[] = [];

    // 1) itens marcados para o site, marca por marca (cada cor é um item)
    const perBrand = await pool(brands, 8, async (b) => {
      try {
        return await getSiteItems(b.code);
      } catch (error) {
        needsReview.push({ reference: "—", brand: brandName.get(b.code) ?? b.code, reason: `Não consegui ler os itens da marca no ERP (${(error as Error).message}).` });
        return [] as ErpItem[];
      }
    });
    if (needsReview.length === brands.length) throw new AppError("Não consegui ler o ERP. Tente de novo em instantes.", 502);
    const flagged = perBrand.flat().filter(isSiteFlagged);

    const groups = new Map<string, { brandCode: string; ref: string; flagged: Map<string, ErpItem>; known: Set<string> }>();
    const group = (brandCode: string, ref: string) => {
      const key = keyOf(brandCode, ref);
      if (!groups.has(key)) groups.set(key, { brandCode, ref, flagged: new Map(), known: new Set() });
      return groups.get(key)!;
    };
    for (const item of flagged) {
      if (!item.supplierRef) {
        needsReview.push({ reference: item.pkItem, brand: brandName.get(item.brandCode) ?? item.brandCode, reason: "Item marcado para o site sem referência do fornecedor no ERP." });
        continue;
      }
      group(item.brandCode, item.supplierRef).flagged.set(item.pkItem, item);
    }

    // 2) produtos que já vieram do ERP entram junto: as cores deles são conferidas mesmo se saíram da marcação
    const linked = await prisma.product.findMany({ where: { erpBrandCode: { not: null }, erpRef: { not: null } }, include: { colors: { select: { erpItemCode: true } } } });
    for (const p of linked) for (const c of p.colors) if (c.erpItemCode) group(p.erpBrandCode!, p.erpRef!).known.add(c.erpItemCode);

    const report: RefreshReport = { finishedAt: "", flaggedItems: flagged.length, created: [], updated: [], needsReview };

    await pool([...groups.values()], 4, async (g) => {
      const label = { reference: g.ref, brand: brandName.get(g.brandCode) ?? g.brandCode };
      try {
        const codes = new Set([...g.flagged.keys(), ...g.known]);
        const items = (await Promise.all([...codes].map(async (code) => g.flagged.get(code) ?? (await getItem(code))))).filter((i): i is ErpItem => i !== null);
        if (items.length === 0) return void needsReview.push({ ...label, reason: "Os itens deste produto não existem mais no ERP." });
        const plan = buildPlan(await Promise.all(items.map(async (item) => ({ item, stock: await getStock(item.pkItem) }))), { brandName: brandName.get(g.brandCode) });
        if (plan.errors.length > 0) return void needsReview.push({ ...label, reason: plan.errors.join(" ") });
        if (plan.product.price <= 0) return void needsReview.push({ ...label, reason: "Sem preço de venda do site no ERP." });
        const result = await applyPlan(plan);
        if (result.created) report.created.push({ name: plan.product.name, reference: g.ref, colors: plan.colors.length });
        else report.updated.push({ name: plan.product.name, reference: g.ref, newColors: result.colors.created, stockChanges: result.variants.stockChanges });
      } catch (error) {
        needsReview.push({ ...label, reason: error instanceof Error ? error.message : "Erro inesperado." });
      }
    });

    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");
    report.created.sort(byName);
    report.updated.sort(byName);
    needsReview.sort((a, b) => a.brand.localeCompare(b.brand, "pt-BR") || a.reference.localeCompare(b.reference, "pt-BR"));
    report.finishedAt = new Date().toISOString();
    return report;
  } finally {
    running = false;
  }
}
