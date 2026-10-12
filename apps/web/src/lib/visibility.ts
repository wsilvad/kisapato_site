import type { Product } from "@/types/product";

/**
 * Por que um produto ATIVO não aparece na loja: a categoria, a classe ou a marca dele foi desativada
 * (mesma regra da API). Devolve null quando ele está visível ou foi desativado por si mesmo.
 */
export function hiddenReason(p: Product): string | null {
  if (p.active === false) return null;
  if (p.category?.active === false) return `categoria ${p.category.name} desativada`;
  if (p.category?.productClass?.active === false) return `classe ${p.category.productClass.name} desativada`;
  if (p.brand?.active === false) return `marca ${p.brand.name} desativada`;
  return null;
}

export const isVisible = (p: Product) => p.active !== false && hiddenReason(p) === null;
