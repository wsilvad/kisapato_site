import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { recordMovement } from "../stock/stock.service.js";
import { getBrands } from "./client.js";
import { slugify, type ImportPlan } from "./mapping.js";

/** Nome do site de um produto do ERP: tipo + nome da marca no site (sem a referência). */
const siteName = (plan: ImportPlan, brandName: string) => `${plan.product.typeName} ${brandName}`.trim();

const norm = (s: string) => slugify(s);

/** Marca do site para o código do ERP: pelo `erpCode` já gravado ou, na primeira vez, pelo nome (e então grava o código). */
async function resolveBrand(brandCode: string) {
  const linked = await prisma.brand.findUnique({ where: { erpCode: brandCode } });
  if (linked) return linked;
  const erpBrand = (await getBrands()).find((b) => b.code === brandCode);
  if (!erpBrand) throw new AppError(`Marca ${brandCode} não existe no ERP.`, 404);
  const matches = (await prisma.brand.findMany({ where: { erpCode: null } })).filter((b) => norm(b.name) === norm(erpBrand.name));
  if (matches.length !== 1) throw new AppError(`Marca "${erpBrand.name}" (${brandCode}) ${matches.length === 0 ? "não foi encontrada" : "tem mais de um cadastro"} no site: cadastre ou ajuste a marca antes de importar.`, 409);
  return prisma.brand.update({ where: { id: matches[0]!.id }, data: { erpCode: brandCode } });
}

export interface ApplyResult {
  productId: string;
  created: boolean;
  colors: { created: number; updated: number };
  variants: { created: number; updated: number; stockChanges: number };
}

/**
 * Grava o plano no banco. Só mexe no que é do ERP (nome, preço, custo, gênero, categoria, cores, numerações e estoque):
 * fotos, descrição, selo e o "ativo" são do site, então um produto novo nasce INATIVO e um existente mantém o que tem.
 */
export async function applyPlan(plan: ImportPlan): Promise<ApplyResult> {
  if (plan.errors.length > 0) throw new AppError(`O plano tem erros e não pode ser gravado: ${plan.errors.join(" ")}`, 422);
  const p = plan.product;
  const brand = await resolveBrand(plan.key.brandCode);
  const category = await prisma.category.findFirst({ where: { name: { equals: p.category!, mode: "insensitive" } } });
  if (!category) throw new AppError(`Categoria "${p.category}" não existe no site.`, 409);

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

    const result: ApplyResult = { productId, created: !existing, colors: { created: 0, updated: 0 }, variants: { created: 0, updated: 0, stockChanges: 0 } };
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
