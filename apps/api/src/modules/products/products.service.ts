import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { ListProductsQuery, ProductFilters } from "./products.schemas.js";

/**
 * Um produto só aparece na loja se ele, sua categoria, a classe da categoria e a marca (quando tem)
 * estiverem ativos. Reativar qualquer um deles devolve os produtos sem precisar mexer neles.
 */
export const visibleProductWhere = {
  active: true,
  category: { active: true, OR: [{ classId: null }, { productClass: { active: true } }] },
  AND: [{ OR: [{ brandId: null }, { brand: { active: true } }] }],
} satisfies Prisma.ProductWhereInput;

/** Filtro da seleção da loja (menu "Lançamentos" e "Promoções"). Promoção = selo Promoção ou preço "de" cadastrado. */
export function seloWhere(selo: "lancamento" | "promocao" | "destaque"): Prisma.ProductWhereInput {
  if (selo === "lancamento") return { badge: "LANCAMENTO" };
  if (selo === "destaque") return { badge: "DESTAQUE" };
  return { OR: [{ badge: "PROMOCAO" }, { compareAtPrice: { not: null } }] };
}

const include = { brand: true, category: { include: { productClass: true } }, audiences: { orderBy: { sortOrder: "asc" as const } } };

/** Monta o `where` dos filtros da vitrine (sem a regra de visibilidade, que o chamador soma). */
function filtersWhere({ category, productClass, audience, brand, color, size, minPrice, maxPrice, selo, slugs, search }: Partial<ProductFilters>): Prisma.ProductWhereInput[] {
  const conditions: Prisma.ProductWhereInput[] = [];
  if (category || productClass) {
    conditions.push({ category: { ...(category && { slug: { in: category } }), ...(productClass && { productClass: { slug: productClass } }) } });
  }
  if (audience) conditions.push({ audiences: { some: { slug: { in: audience } } } });
  if (brand) conditions.push({ brand: { slug: { in: brand } } });
  // Cor e numeração valem para a mesma variante (ex.: "preto" + "38" = existe preto no 38) e só contam com estoque.
  if (color || size) {
    conditions.push({ variants: { some: { stock: { gt: 0 }, ...(color && { color: { in: color, mode: "insensitive" as const } }), ...(size && size.length > 0 && { size: { in: size } }) } } });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    conditions.push({ price: { ...(minPrice !== undefined && { gte: minPrice }), ...(maxPrice !== undefined && { lte: maxPrice }) } });
  }
  if (slugs) conditions.push({ slug: { in: slugs.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50) } });
  if (search) conditions.push({ name: { contains: search, mode: "insensitive" as const } });
  if (selo) conditions.push(seloWhere(selo));
  return conditions;
}

const orderings = {
  novidades: { createdAt: "desc" },
  "menor-preco": { price: "asc" },
  "maior-preco": { price: "desc" },
  nome: { name: "asc" },
} satisfies Record<ListProductsQuery["sort"], Prisma.ProductOrderByWithRelationInput>;

export async function listProducts({ page, pageSize, sort, ...filters }: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = { AND: [visibleProductWhere, ...filtersWhere(filters)] };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include,
      orderBy: orderings[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Opções do painel de filtros ("Filtrar por"). Valem para a seleção atual (lançamentos, promoções, busca…),
 * mas ignoram os demais filtros marcados, para as opções não sumirem enquanto a pessoa escolhe.
 */
export async function productFacets({ selo, search }: Pick<ProductFilters, "selo" | "search">) {
  const products = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, ...filtersWhere({ selo, search })] },
    select: {
      price: true,
      category: { select: { name: true, slug: true, sortOrder: true } },
      brand: { select: { name: true, slug: true, sortOrder: true } },
      audiences: { select: { name: true, slug: true, sortOrder: true } },
      variants: { where: { stock: { gt: 0 } }, select: { size: true, color: true } },
    },
    take: 2000,
  });

  type Option = { name: string; slug: string; count: number; sortOrder: number };
  const tally = (pick: (p: (typeof products)[number]) => { name: string; slug: string; sortOrder: number }[]) => {
    const map = new Map<string, Option>();
    for (const product of products) {
      for (const item of pick(product)) {
        const entry = map.get(item.slug) ?? { ...item, count: 0 };
        entry.count += 1;
        map.set(item.slug, entry);
      }
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")).map(({ name, slug, count }) => ({ name, slug, count }));
  };

  const colors = new Map<string, string>();
  const sizes = new Set<number>();
  for (const product of products) {
    for (const v of product.variants) {
      colors.set(v.color.toLowerCase(), v.color);
      sizes.add(v.size);
    }
  }
  const prices = products.map((p) => Number(p.price));

  return {
    audiences: tally((p) => p.audiences),
    categories: tally((p) => [p.category]),
    brands: tally((p) => (p.brand ? [p.brand] : [])),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    sizes: [...sizes].sort((a, b) => a - b),
    price: prices.length > 0 ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null,
    total: products.length,
  };
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

/**
 * "Compre junto": peças de OUTRAS categorias que combinam com o produto. A pontuação favorece o mesmo público
 * (feminino com feminino…), uma classe diferente (calçado + acessório), a mesma marca e produtos com foto; só
 * entram itens com estoque.
 */
export async function relatedProducts(slug: string, limit = 4) {
  const base = await prisma.product.findFirst({
    where: { AND: [visibleProductWhere, { slug }] },
    include: { category: true, audiences: true },
  });
  if (!base) throw new AppError("Produto não encontrado", 404);

  const candidates = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, { id: { not: base.id } }, { categoryId: { not: base.categoryId } }] },
    include: { ...include, variants: { select: { stock: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const baseAudiences = new Set(base.audiences.map((a) => a.id));
  return candidates
    .filter((c) => c.variants.some((v) => v.stock > 0))
    .map(({ variants: _variants, ...product }) => ({
      product,
      score:
        product.audiences.filter((a) => baseAudiences.has(a.id)).length * 3 +
        (product.category.classId !== base.category.classId ? 2 : 0) +
        (product.brandId && product.brandId === base.brandId ? 1 : 0) +
        (product.images.length > 0 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.product);
}
