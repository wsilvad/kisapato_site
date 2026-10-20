import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { recordMovement } from "../stock/stock.service.js";
import { emptyCreated, ensureBrand, ensureCategory, type CatalogCreated } from "./catalog.js";
import type { ImportPlan } from "./mapping.js";

/** Nome do site de um produto do ERP: tipo + nome da marca no site (sem a referência). */
const siteName = (plan: ImportPlan, brandName: string) => `${plan.product.typeName} ${brandName}`.trim();

export interface ApplyResult {
  productId: string;
  created: boolean;
  colors: { created: number; updated: number };
  variants: { created: number; updated: number; stockChanges: number };
  /** Marcas, classes e categorias que não existiam no site e foram criadas para este produto. */
  catalog: CatalogCreated;
}

/**
 * Grava o plano no banco. Marca, classe e categoria que faltarem no site são criadas (ver catalog.ts). Só mexe no que é do ERP (nome, preço, custo, gênero, categoria, cores, numerações e estoque):
 * fotos, descrição, selo e o "ativo" são do site, então um produto novo nasce INATIVO e um existente mantém o que tem.
 */
export async function applyPlan(plan: ImportPlan): Promise<ApplyResult> {
  if (plan.errors.length > 0) throw new AppError(`O plano tem erros e não pode ser gravado: ${plan.errors.join(" ")}`, 422);
  const p = plan.product;
  const catalog = emptyCreated();
  const brand = await ensureBrand(plan.key.brandCode, catalog);
  const category = await ensureCategory(p.category!, p.className, catalog);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { erpBrandCode_erpRef: { erpBrandCode: plan.key.brandCode, erpRef: plan.key.ref } } });
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
      erpSyncedAt: new Date(),
    };

    let productId: string;
    if (existing) {
      productId = existing.id;
      // O nome do site é editável no painel: só é refeito se ainda não foi personalizado (igual ao nome do ERP ou sem nome do ERP).
      const untouched = existing.erpName === null || existing.name === existing.erpName;
      await tx.product.update({ where: { id: productId }, data: { ...erpFields, ...(untouched && { name: siteName(plan, brand.name) }) } });
    } else {
      let slug = p.slug;
      for (let n = 2; await tx.product.findUnique({ where: { slug } }); n++) slug = `${p.slug}-${n}`;
      productId = (await tx.product.create({ data: { ...erpFields, name: siteName(plan, brand.name), slug, erpBrandCode: plan.key.brandCode, erpRef: plan.key.ref, active: false, images: [] } })).id;
    }

    const result: ApplyResult = { productId, created: !existing, colors: { created: 0, updated: 0 }, variants: { created: 0, updated: 0, stockChanges: 0 }, catalog };
    for (const color of plan.colors) {
      const known = await tx.productColor.findFirst({ where: { productId, OR: [{ erpItemCode: color.erpItemCode }, { name: color.name }] } });
      const data = {
        name: color.name,
        position: color.position,
        erpItemCode: color.erpItemCode,
        costPrice: color.cost > 0 ? color.cost : null,
        // preço próprio da cor (item do ERP); sem preço no ERP, vale o do produto (o menor das cores)
        price: color.price > 0 ? color.price : null,
        compareAtPrice: color.price > 0 && color.previousPrice > color.price ? color.previousPrice : null,
      };
      if (known) {
        await tx.productColor.update({ where: { id: known.id }, data });
        result.colors.updated++;
      } else {
        await tx.productColor.create({ data: { ...data, productId, images: [] } });
        result.colors.created++;
      }
      for (const size of color.sizes) {
        const variant = await tx.productVariant.findUnique({ where: { productId_size_color: { productId, size: size.size, color: color.name } } });
        if (variant) {
          await tx.productVariant.update({ where: { id: variant.id }, data: { stock: size.stock, erpSizeCode: size.erpSizeCode, sizeLabel: size.sizeLabel, ean: size.ean } });
          result.variants.updated++;
          if (variant.stock !== size.stock) {
            await recordMovement(tx, { variantId: variant.id, type: "ADJUSTMENT", quantity: size.stock - variant.stock, balance: size.stock, note: "Sincronização ERP" });
            result.variants.stockChanges++;
          }
        } else {
          const created = await tx.productVariant.create({ data: { productId, size: size.size, color: color.name, stock: size.stock, sku: size.sku, erpSizeCode: size.erpSizeCode, sizeLabel: size.sizeLabel, ean: size.ean } });
          result.variants.created++;
          if (size.stock > 0) {
            await recordMovement(tx, { variantId: created.id, type: "ADJUSTMENT", quantity: size.stock, balance: size.stock, note: "Estoque inicial (ERP)" });
            result.variants.stockChanges++;
          }
        }
      }
    }
    return result;
  });
}
