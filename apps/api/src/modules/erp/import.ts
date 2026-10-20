import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { recordMovement } from "../stock/stock.service.js";
import { ensureBrand, ensureCategory, newCatalog, type CatalogContext } from "./catalog.js";
import type { ImportPlan } from "./mapping.js";

/** Nome do site de um produto do ERP: tipo + nome da marca no site (sem a referência). */
const siteName = (plan: ImportPlan, brandName: string) => `${plan.product.typeName} ${brandName}`.trim();

export interface ApplyResult {
  productId: string;
  created: boolean;
  /** Algo do ERP mudou no produto (preço, dados, cores, numerações ou estoque). */
  changed: boolean;
  priceChanged: boolean;
  colors: { created: number; updated: number };
  /** Cores que passaram a ficar desabilitadas (o ERP não marca mais para o site) e as que voltaram a ser habilitadas. */
  disabledColors: string[];
  enabledColors: string[];
  variants: { created: number; updated: number; stockChanges: number };
}

/** Dinheiro do banco (Decimal) ou do ERP (number) em centavos, para comparar sem erro de arredondamento. */
const cents = (v: { toString(): string } | number | null | undefined) => (v === null || v === undefined ? null : Math.round(Number(v.toString()) * 100));
const sameMoney = (a: Parameters<typeof cents>[0], b: Parameters<typeof cents>[0]) => cents(a) === cents(b);

/**
 * Grava o plano no banco, escrevendo SÓ o que mudou: o banco fica longe (~170 ms por ida e volta) e uma rodada sem mudança
 * deve custar uma leitura e uma escrita (a data da sincronização) por produto. Marca, classe e categoria que faltarem no site
 * são criadas (ver catalog.ts). Só mexe no que é do ERP (nome, preço, custo, gênero, categoria, cores, numerações e estoque):
 * fotos, descrição, selo e o "ativo" são do site, então um produto novo nasce INATIVO e um existente mantém o que tem.
 */
export async function applyPlan(plan: ImportPlan, catalog: CatalogContext = newCatalog()): Promise<ApplyResult> {
  if (plan.errors.length > 0) throw new AppError(`O plano tem erros e não pode ser gravado: ${plan.errors.join(" ")}`, 422);
  const p = plan.product;
  const [brand, category, existing] = await Promise.all([
    ensureBrand(plan.key.brandCode, catalog),
    ensureCategory(p.category!, p.className, catalog),
    prisma.product.findUnique({ where: { erpBrandCode_erpRef: { erpBrandCode: plan.key.brandCode, erpRef: plan.key.ref } }, omit: { costPrice: false }, include: { colors: { omit: { costPrice: false } }, variants: true } }),
  ]);

  // Nenhuma cor marcada no ERP: o produto fica sem cores na loja, mas o preço (que o ERP zera) não é mexido.
  const anyFlagged = plan.colors.some((c) => c.flagged);
  const erpFields = {
    erpName: p.erpName,
    reference: p.reference,
    brandId: brand.id,
    categoryId: category.id,
    ageGroup: p.ageGroup!,
    gender: p.gender!,
    sizeScheme: p.sizeScheme!,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    costPrice: p.costPrice > 0 ? p.costPrice : null,
  };
  const result: ApplyResult = { productId: existing?.id ?? "", created: !existing, changed: !existing, priceChanged: false, colors: { created: 0, updated: 0 }, disabledColors: [], enabledColors: [], variants: { created: 0, updated: 0, stockChanges: 0 } };

  // o que mudou no produto em si (o nome do site só é refeito se ainda não foi personalizado no painel)
  let productData: Record<string, unknown> = { erpSyncedAt: new Date() };
  if (existing) {
    const untouched = existing.erpName === null || existing.name === existing.erpName;
    const name = siteName(plan, brand.name);
    const differs =
      existing.erpName !== erpFields.erpName || existing.reference !== erpFields.reference || existing.brandId !== erpFields.brandId ||
      existing.categoryId !== erpFields.categoryId || existing.ageGroup !== erpFields.ageGroup || existing.gender !== erpFields.gender ||
      existing.sizeScheme !== erpFields.sizeScheme || !sameMoney(existing.costPrice, erpFields.costPrice) || (untouched && existing.name !== name);
    result.priceChanged = anyFlagged && (!sameMoney(existing.price, erpFields.price) || !sameMoney(existing.compareAtPrice, erpFields.compareAtPrice));
    if (differs || result.priceChanged) {
      const { price, compareAtPrice, ...rest } = erpFields;
      productData = { ...productData, ...rest, ...(anyFlagged && { price, compareAtPrice }), ...(untouched && { name }) };
    }
  }

  type Op = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], productId: string) => Promise<unknown>;
  const ops: Op[] = [];
  const colors = existing?.colors ?? [];
  const variants = existing?.variants ?? [];
  for (const color of plan.colors) {
    const known = colors.find((c) => c.erpItemCode === color.erpItemCode) ?? colors.find((c) => c.name === color.name);
    // Habilitada = marcada no ERP e não desligada no painel. Voltar a ser marcada no ERP religa; já marcada, respeita o painel.
    const active = !color.flagged ? false : known && known.erpFlagged ? known.active : true;
    const data = {
      name: color.name,
      position: color.position,
      erpItemCode: color.erpItemCode,
      erpFlagged: color.flagged,
      active,
      costPrice: color.cost > 0 ? color.cost : null,
      // preço próprio da cor (item do ERP); sem preço no ERP, vale o do produto (o menor das cores)
      price: color.price > 0 ? color.price : null,
      compareAtPrice: color.price > 0 && color.previousPrice > color.price ? color.previousPrice : null,
    };
    if (!known) {
      ops.push((tx, productId) => tx.productColor.create({ data: { ...data, productId, images: [] } }));
      result.colors.created++;
    } else if (
      known.name !== data.name || known.position !== data.position || known.erpItemCode !== data.erpItemCode || known.active !== data.active || known.erpFlagged !== data.erpFlagged ||
      !sameMoney(known.costPrice, data.costPrice) || !sameMoney(known.price, data.price) || !sameMoney(known.compareAtPrice, data.compareAtPrice)
    ) {
      if (color.flagged && (!sameMoney(known.price, data.price) || !sameMoney(known.compareAtPrice, data.compareAtPrice))) result.priceChanged = true;
      if (known.active && !active) result.disabledColors.push(color.name);
      if (!known.active && active) result.enabledColors.push(color.name);
      ops.push((tx) => tx.productColor.update({ where: { id: known.id }, data }));
      result.colors.updated++;
    }
    for (const planSize of color.sizes) {
      // cor desabilitada (no ERP ou no painel) não tem estoque vendável; o saldo real do ERP continua no plano
      const size = { ...planSize, stock: active ? planSize.stock : 0 };
      const variant = variants.find((v) => v.size === size.size && v.color === color.name);
      if (!variant) {
        ops.push(async (tx, productId) => {
          const created = await tx.productVariant.create({ data: { productId, size: size.size, color: color.name, stock: size.stock, sku: size.sku, erpSizeCode: size.erpSizeCode, sizeLabel: size.sizeLabel, ean: size.ean } });
          if (size.stock > 0) await recordMovement(tx, { variantId: created.id, type: "ADJUSTMENT", quantity: size.stock, balance: size.stock, note: "Estoque inicial (ERP)" });
        });
        result.variants.created++;
        if (size.stock > 0) result.variants.stockChanges++;
      } else if (variant.stock !== size.stock || variant.erpSizeCode !== size.erpSizeCode || variant.sizeLabel !== size.sizeLabel || variant.ean !== size.ean) {
        ops.push(async (tx) => {
          await tx.productVariant.update({ where: { id: variant.id }, data: { stock: size.stock, erpSizeCode: size.erpSizeCode, sizeLabel: size.sizeLabel, ean: size.ean } });
          if (variant.stock !== size.stock) await recordMovement(tx, { variantId: variant.id, type: "ADJUSTMENT", quantity: size.stock - variant.stock, balance: size.stock, note: "Sincronização ERP" });
        });
        result.variants.updated++;
        if (variant.stock !== size.stock) result.variants.stockChanges++;
      }
    }
  }
  if (ops.length > 0 || result.priceChanged || Object.keys(productData).length > 1) result.changed = true;

  // sem mudança: só a data da sincronização (mostrada em "Estoque atualizado em")
  if (existing && ops.length === 0) {
    await prisma.product.update({ where: { id: existing.id }, data: productData });
    return result;
  }

  return prisma.$transaction(
    async (tx) => {
      let productId: string;
      if (existing) {
        productId = existing.id;
        await tx.product.update({ where: { id: productId }, data: productData });
      } else {
        let slug = p.slug;
        for (let n = 2; await tx.product.findUnique({ where: { slug } }); n++) slug = `${p.slug}-${n}`;
        productId = (await tx.product.create({ data: { ...erpFields, erpSyncedAt: new Date(), name: siteName(plan, brand.name), slug, erpBrandCode: plan.key.brandCode, erpRef: plan.key.ref, active: false, images: [] } })).id;
      }
      for (const op of ops) await op(tx, productId);
      return { ...result, productId };
    },
    // produto novo com muitas numerações: cada escrita é uma ida e volta ao banco
    { timeout: 120_000, maxWait: 30_000 },
  );
}
