import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { ListProductsQuery } from "./products.schemas.js";

/**
 * Um produto só aparece na loja se ele, sua categoria, a classe da categoria e a marca (quando tem)
 * estiverem ativos. Reativar qualquer um deles devolve os produtos sem precisar mexer neles.
 */
export const visibleProductWhere = {
  active: true,
  category: { active: true, OR: [{ classId: null }, { productClass: { active: true } }] },
  AND: [{ OR: [{ brandId: null }, { brand: { active: true } }] }],
} satisfies Prisma.ProductWhereInput;

const include = { brand: true, category: { include: { productClass: true } }, audiences: { orderBy: { sortOrder: "asc" as const } } };

export async function listProducts({ page, pageSize, category, productClass, audience, brand, search }: ListProductsQuery) {
  const filters: Prisma.ProductWhereInput = {
    ...((category || productClass) && {
      category: { ...(category && { slug: category }), ...(productClass && { productClass: { slug: productClass } }) },
    }),
    ...(audience && { audiences: { some: { slug: audience } } }),
    ...(brand && { brand: { slug: brand } }),
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
  };
  const where: Prisma.ProductWhereInput = { AND: [visibleProductWhere, filters] };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { AND: [visibleProductWhere, { slug }] },
    include: {
      ...include,
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  if (!product) throw new AppError("Produto não encontrado", 404);
  return product;
}
