import type { Product } from "@/types/product";

/**
 * Produtos de exemplo do protótipo. A Home usa estes dados só enquanto a API
 * estiver fora do ar ou sem produtos cadastrados.
 */
function sample(
  slug: string,
  name: string,
  brand: string,
  price: string,
  extra: Pick<Product, "badge" | "compareAtPrice"> = {},
): Product {
  return {
    id: slug,
    slug,
    name,
    brand,
    price,
    description: null,
    images: [],
    category: { id: "exemplo", name: "Calçados", slug: "calcados" },
    ...extra,
  };
}

export const sampleLaunches: Product[] = [
  sample("mule-couro-trancado", "Mule couro trançado", "Marca A", "289.90", { badge: "Lançamento" }),
  sample("tenis-casual-couro-branco", "Tênis casual couro branco", "Marca B", "349.90", { badge: "Lançamento" }),
  sample("sandalia-infantil-velcro", "Sandália infantil velcro", "Marca C", "129.90", { badge: "Lançamento" }),
  sample("bota-cano-curto-camurca", "Bota cano curto camurça", "Marca A", "399.90", { badge: "Lançamento" }),
];

export const sampleHighlights: Product[] = [
  sample("scarpin-salto-bloco", "Scarpin salto bloco", "Marca D", "219.90", { compareAtPrice: "279.90" }),
  sample("sapato-social-oxford", "Sapato social oxford", "Marca B", "459.90", { badge: "Destaque" }),
  sample("rasteira-tiras-finas", "Rasteira tiras finas", "Marca E", "99.90", { compareAtPrice: "139.90" }),
  sample("tenis-esportivo-corrida", "Tênis esportivo corrida", "Marca C", "379.90", { badge: "Destaque" }),
];
