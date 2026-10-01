import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { ListProductsQuery } from "./products.schemas.js";

export async function listProducts({ page, pageSize, category, search }: ListProductsQuery) {
  const where = {
    active: true,
    ...(category && { category: { slug: category } }),
    ...(search && { name: { contains: search, mode: "insensitive" as const } }),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
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
    where: { slug, active: true },
    include: {
      category: true,
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  if (!product) throw new AppError("Produto não encontrado", 404);
  return product;
}
