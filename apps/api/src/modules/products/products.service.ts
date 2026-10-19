import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { ListProductsQuery, ProductFilters } from "./products.schemas.js";
import { withColorPhotos, withFirstColorPhotos } from "./colors.js";
import { ageGroupsOf, genderWhere, gendersOf } from "./segment.js";

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

const include = { brand: true, category: { include: { productClass: true } } };
/** Inclui as cores (com as fotos de cada uma) e as numerações, para a vitrine mostrar a foto da primeira cor. */
export const withColorsInclude = { ...include, colors: true, variants: { select: { color: true } } };

/** Monta o `where` dos filtros da vitrine (sem a regra de visibilidade, que o chamador soma). */
function filtersWhere({ category, productClass, ageGroup, gender, brand, color, size, minPrice, maxPrice, selo, slugs, search }: Partial<ProductFilters>): Prisma.ProductWhereInput[] {
  const conditions: Prisma.ProductWhereInput[] = [];
  if (category || productClass) {
    conditions.push({ category: { ...(category && { slug: { in: category } }), ...(productClass && { productClass: { slug: productClass } }) } });
  }
  if (ageGroup) conditions.push({ ageGroup: { in: ageGroupsOf(ageGroup) } });
  if (gender) conditions.push(genderWhere(gendersOf(gender)));
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
      include: withColorsInclude,
      orderBy: orderings[sort],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items: items.map(withFirstColorPhotos), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Opções do painel de filtros ("Filtrar por"). Valem para a seleção atual (lançamentos, promoções, busca…),
 * mas ignoram os demais filtros marcados, para as opções não sumirem enquanto a pessoa escolhe. A exceção é a
 * faixa etária: escolhido o infantil, gênero, numeração, cores, categorias, marcas e preço são só do infantil.
 * `segments` traz, por faixa, o total e quantos servem a feminino e a masculino (o menu do topo usa).
 */
export async function productFacets({ selo, search, ageGroup }: Pick<ProductFilters, "selo" | "search" | "ageGroup">) {
  const products = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, ...filtersWhere({ selo, search })] },
    select: {
      price: true,
      ageGroup: true,
      gender: true,
      category: { select: { name: true, slug: true, sortOrder: true } },
      brand: { select: { name: true, slug: true, sortOrder: true } },
      variants: { where: { stock: { gt: 0 } }, select: { size: true, color: true } },
    },
    take: 2000,
  });

  type Option = { name: string; slug: string; count: number; sortOrder: number };
  const tally = (list: typeof products, pick: (p: (typeof products)[number]) => { name: string; slug: string; sortOrder: number }[]) => {
    const map = new Map<string, Option>();
    for (const product of list) {
      for (const item of pick(product)) {
        const entry = map.get(item.slug) ?? { ...item, count: 0 };
        entry.count += 1;
        map.set(item.slug, entry);
      }
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")).map(({ name, slug, count }) => ({ name, slug, count }));
  };

  const ages = ageGroup ? new Set(ageGroupsOf(ageGroup)) : null;
  const inAge = ages ? products.filter((p) => ages.has(p.ageGroup)) : products;

  const colors = new Map<string, string>();
  const sizes = new Set<number>();
  for (const product of inAge) {
    for (const v of product.variants) {
      colors.set(v.color.toLowerCase(), v.color);
      sizes.add(v.size);
    }
  }
  const prices = inAge.map((p) => Number(p.price));

  const segments = {
    adulto: { total: 0, feminino: 0, masculino: 0 },
    infantil: { total: 0, feminino: 0, masculino: 0 },
  };
  for (const p of products) {
    const s = segments[p.ageGroup === "INFANTIL" ? "infantil" : "adulto"];
    s.total += 1;
    if (p.gender !== "MASCULINO") s.feminino += 1;
    if (p.gender !== "FEMININO") s.masculino += 1;
  }

  return {
    ageGroups: tally(products, (p) => [p.ageGroup === "INFANTIL" ? { name: "Infantil", slug: "infantil", sortOrder: 1 } : { name: "Adulto", slug: "adulto", sortOrder: 0 }]),
    // Unissex conta nos dois, como no filtro.
    genders: tally(inAge, (p) => [
      ...(p.gender !== "MASCULINO" ? [{ name: "Feminino", slug: "feminino", sortOrder: 0 }] : []),
      ...(p.gender !== "FEMININO" ? [{ name: "Masculino", slug: "masculino", sortOrder: 1 }] : []),
    ]),
    segments,
    categories: tally(inAge, (p) => [p.category]),
    brands: tally(inAge, (p) => (p.brand ? [p.brand] : [])),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    sizes: [...sizes].sort((a, b) => a - b),
    price: prices.length > 0 ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null,
    total: products.length,
  };
}

type Segments = { adulto: { total: number; feminino: number; masculino: number }; infantil: { total: number; feminino: number; masculino: number } };
type MenuSegments = Record<string, { segments: Segments; total: number }>;
const MENU_SELOS = ["", "lancamento", "promocao", "destaque"] as const;
const MENU_TTL_MS = 30_000;
let menuCache: { at: number; value: Promise<MenuSegments> } | null = null;

/**
 * Contagens do menu do topo (Feminino, Masculino e Infantil de cada seleção: tudo, lançamentos, promoções,
 * destaques) numa chamada só, com contagem agrupada no banco, sem carregar os produtos. Fica 30 s em memória:
 * o menu é aberto o tempo todo e a contagem exata ao segundo não importa.
 */
export function menuSegments(): Promise<MenuSegments> {
  if (menuCache && Date.now() - menuCache.at < MENU_TTL_MS) return menuCache.value;
  const value = Promise.all(
    MENU_SELOS.map(async (selo) => {
      const groups = await prisma.product.groupBy({
        by: ["ageGroup", "gender"],
        where: { AND: [visibleProductWhere, ...(selo ? [seloWhere(selo)] : [])] },
        _count: { _all: true },
      });
      const segments: Segments = { adulto: { total: 0, feminino: 0, masculino: 0 }, infantil: { total: 0, feminino: 0, masculino: 0 } };
      let total = 0;
      for (const g of groups) {
        const n = g._count._all;
        const s = segments[g.ageGroup === "INFANTIL" ? "infantil" : "adulto"];
        total += n;
        s.total += n;
        // Unissex conta nos dois, como no filtro.
        if (g.gender !== "MASCULINO") s.feminino += n;
        if (g.gender !== "FEMININO") s.masculino += n;
      }
      return [selo, { segments, total }] as const;
    }),
  ).then((entries) => Object.fromEntries(entries));
  menuCache = { at: Date.now(), value };
  value.catch(() => (menuCache = null));
  return value;
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { AND: [visibleProductWhere, { slug }] },
    include: {
      ...include,
      colors: true,
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  if (!product) throw new AppError("Produto não encontrado", 404);
  return withColorPhotos(product);
}

/**
 * "Compre junto": peças de OUTRAS categorias que combinam com o produto. A pontuação favorece a mesma faixa
 * etária e um gênero compatível (feminino com feminino ou unissex…), uma classe diferente (calçado + acessório), a mesma marca e produtos com foto; só
 * entram itens com estoque.
 */
export async function relatedProducts(slug: string, limit = 4) {
  const base = await prisma.product.findFirst({
    where: { AND: [visibleProductWhere, { slug }] },
    include: { category: true },
  });
  if (!base) throw new AppError("Produto não encontrado", 404);

  const candidates = await prisma.product.findMany({
    where: { AND: [visibleProductWhere, { id: { not: base.id } }, { categoryId: { not: base.categoryId } }] },
    include: { ...include, colors: true, variants: { select: { stock: true, color: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return candidates
    .filter((c) => c.variants.some((v) => v.stock > 0))
    .map((candidate) => {
      const product = withFirstColorPhotos(candidate);
      return {
        product,
        score:
          (product.ageGroup === base.ageGroup ? 3 : 0) +
          (product.gender === base.gender || product.gender === "UNISSEX" || base.gender === "UNISSEX" ? 3 : 0) +
          (product.category.classId !== base.category.classId ? 2 : 0) +
          (product.brandId && product.brandId === base.brandId ? 1 : 0) +
          (product.images.length > 0 ? 1 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.product);
}
