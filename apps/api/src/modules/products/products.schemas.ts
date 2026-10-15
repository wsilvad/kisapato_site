import { z } from "zod";

/** Lista separada por vírgula (`a,b,c`) vira array limpo; vazio vira `undefined`. */
const csv = z
  .string()
  .optional()
  .transform((value) => {
    const items = (value ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30);
    return items.length > 0 ? items : undefined;
  });

/** Filtros da vitrine; categoria, faixa, gênero, marca, cor e numeração aceitam vários valores separados por vírgula. */
export const productFiltersQuery = z.object({
  category: csv,
  productClass: z.string().optional(),
  /** Faixa etária: `adulto`, `infantil`. */
  ageGroup: csv,
  /** Gênero: `feminino`, `masculino` (ambos incluem os unissex) ou `unissex`. */
  gender: csv,
  brand: csv,
  color: csv,
  size: csv.transform((items) => items?.map(Number).filter((n) => Number.isInteger(n) && n > 0)),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  /** Seleção da loja: lançamentos, promoções ou destaques. */
  selo: z.enum(["lancamento", "promocao", "destaque"]).optional(),
  /** Lista de slugs separados por vírgula (favoritos). */
  slugs: z.string().optional(),
  search: z.string().trim().min(1).optional(),
});

export const listProductsQuery = productFiltersQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  sort: z.enum(["novidades", "menor-preco", "maior-preco", "nome"]).default("novidades"),
});

export type ProductFilters = z.infer<typeof productFiltersQuery>;
export type ListProductsQuery = z.infer<typeof listProductsQuery>;
