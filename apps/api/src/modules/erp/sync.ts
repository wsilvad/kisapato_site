import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getBrands, getItem, getSiteItems, getStock, isSiteFlagged, type ErpItem } from "./client.js";
import { emptyCreated, type CatalogCreated } from "./catalog.js";
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
  /** Marcas, classes e categorias que não existiam no site e foram criadas (ajuste os nomes em Marcas/Categorias, se quiser). */
  catalogCreated: CatalogCreated;
  needsReview: ReviewItem[];
  /** Pendências abertas depois desta atualização (o aviso de atenção no topo de Produtos). */
  attention: number;
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

/** Resultado de um produto (marca + referência) na rodada: o que precisa de atenção e o produto do site, se houver. */
interface Outcome {
  brandCode: string;
  ref: string;
  problems: string[];
  productId: string | null;
}

/**
 * Avisos do plano que pedem a loja: o ERP desativou o item, dados diferentes entre as cores, estoque fora da grade.
 * Ficam de fora os previstos nas regras (saldo negativo vira 0, preço e custo próprios por cor).
 */
const needsAttention = (warning: string) => /^(Tipo|Gênero|Nome) diferente entre as cores|fora da grade|o ERP desativou/.test(warning);

/** Grava as pendências desta rodada e apaga as resolvidas (ou de produtos que saíram do ERP); devolve quantas ficaram. */
async function saveIssues(outcomes: Outcome[], brandName: Map<string, string>, unreadBrands: Set<string>) {
  const seen = new Set(outcomes.map((o) => keyOf(o.brandCode, o.ref)));
  for (const o of outcomes) {
    if (o.problems.length === 0) {
      await prisma.erpIssue.deleteMany({ where: { brandCode: o.brandCode, ref: o.ref } });
      continue;
    }
    const data = { brandName: brandName.get(o.brandCode) ?? o.brandCode, reason: o.problems.join("\n"), productId: o.productId };
    // uma pendência antiga presa ao mesmo produto (outra referência) solta o vínculo antes
    if (o.productId) await prisma.erpIssue.updateMany({ where: { productId: o.productId, NOT: { brandCode: o.brandCode, ref: o.ref } }, data: { productId: null } });
    await prisma.erpIssue.upsert({ where: { brandCode_ref: { brandCode: o.brandCode, ref: o.ref } }, create: { brandCode: o.brandCode, ref: o.ref, ...data }, update: data });
  }
  const stale = (await prisma.erpIssue.findMany({ select: { id: true, brandCode: true, ref: true } })).filter((i) => !seen.has(keyOf(i.brandCode, i.ref)) && !unreadBrands.has(i.brandCode)); // marca que falhou na leitura: mantém
  if (stale.length > 0) await prisma.erpIssue.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
  return prisma.erpIssue.count();
}

/** Pendências abertas, para o aviso e o filtro de Produtos. */
export const listIssues = () =>
  prisma.erpIssue.findMany({ select: { id: true, brandName: true, ref: true, reason: true, productId: true, updatedAt: true }, orderBy: [{ brandName: "asc" }, { ref: "asc" }] });

let running = false;

/**
 * Atualiza o catálogo do painel com o ERP, só lendo dele:
 *  1. procura os itens marcados para o site em todas as marcas;
 *  2. para cada produto (marca + referência) dos marcados e dos que já vieram do ERP, monta o plano com as cores e o estoque
 *     atuais e grava (produto novo nasce desativado; os campos do site — fotos, descrição, selo, "ativo" — não são mexidos).
 * Marca, classe e categoria que faltarem no site são criadas na hora (tipo do ERP → categoria pelo de-para de mapping.ts).
 * Produto que não dá para importar (grade estranha, gênero desconhecido, sem preço, sem referência) vai para
 * `needsReview` e os demais seguem. Uma atualização por vez.
 */
export async function refreshFromErp(): Promise<RefreshReport> {
  if (running) throw new AppError("Já existe uma atualização com o ERP em andamento. Aguarde terminar.", 409);
  running = true;
  try {
    const brands = await getBrands();
    const brandName = new Map(brands.map((b) => [b.code, titleCase(b.name)]));
    const needsReview: ReviewItem[] = [];
    const unreadBrands = new Set<string>();

    // 1) itens marcados para o site, marca por marca (cada cor é um item)
    const perBrand = await pool(brands, 8, async (b) => {
      try {
        return await getSiteItems(b.code);
      } catch (error) {
        unreadBrands.add(b.code);
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
    const linked = await prisma.product.findMany({ where: { erpBrandCode: { not: null }, erpRef: { not: null } }, include: { colors: { select: { erpItemCode: true } } } });
    for (const p of linked) for (const c of p.colors) if (c.erpItemCode) group(p.erpBrandCode!, p.erpRef!).known.add(c.erpItemCode);

    const report: RefreshReport = { finishedAt: "", flaggedItems: flagged.length, created: [], updated: [], catalogCreated: emptyCreated(), needsReview, attention: 0 };

    // 3) cada produto (marca + referência): importa/atualiza e anota o que fugiu do previsto
    const linkedId = new Map(linked.map((p) => [keyOf(p.erpBrandCode!, p.erpRef!), p.id]));
    const outcomes: Outcome[] = [];
    await pool([...groups.values()], 4, async (g) => {
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
        if (plan.product.price <= 0) return fail(outcome.productId ? "Sem preço de venda do site no ERP: o produto não foi atualizado." : "Não importado: sem preço de venda do site no ERP.");
        const result = await applyPlan(plan);
        outcome.productId = result.productId;
        outcome.problems.push(...plan.warnings.filter(needsAttention));
        for (const key of ["brands", "classes", "categories"] as const) report.catalogCreated[key].push(...result.catalog[key]);
        if (result.created) report.created.push({ name: plan.product.name, reference: g.ref, colors: plan.colors.length });
        else report.updated.push({ name: plan.product.name, reference: g.ref, newColors: result.colors.created, stockChanges: result.variants.stockChanges });
      } catch (error) {
        if (error instanceof AppError) return fail(`Não importado: ${error.message}`);
        console.error(`[erp] falha ao gravar ${g.brandCode}/${g.ref}:`, error);
        fail("Não importado: erro ao gravar no banco (detalhe no log da API).");
      }
    });
    for (const item of noRef) outcomes.push({ brandCode: item.brandCode, ref: item.pkItem, problems: ["Não importado: item marcado para o site sem referência do fornecedor no ERP."], productId: null });
    report.attention = await saveIssues(outcomes, brandName, unreadBrands);

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
