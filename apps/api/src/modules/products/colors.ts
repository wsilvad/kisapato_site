/** Fotos por cor: no máximo 4 por cor. */
export const MAX_COLOR_PHOTOS = 4;

export interface ColorPhotos {
  name: string;
  images: string[];
}

interface WithColors {
  images: string[];
  colors: { name: string; position: number; images: string[] }[];
  variants?: { color: string }[];
}

/**
 * Cores do produto na ordem em que aparecem na loja: primeiro as cadastradas (por posição), depois qualquer cor que só
 * exista nas numerações. Cor sem fotos usa as fotos gerais do produto, então produtos antigos continuam iguais.
 */
export function colorsOf(product: WithColors): ColorPhotos[] {
  const known = [...product.colors].sort((a, b) => a.position - b.position);
  const seen = new Set(known.map((c) => c.name.toLowerCase()));
  const extra: string[] = [];
  for (const v of product.variants ?? []) {
    if (!seen.has(v.color.toLowerCase())) {
      seen.add(v.color.toLowerCase());
      extra.push(v.color);
    }
  }
  return [...known.map((c) => ({ name: c.name, images: c.images })), ...extra.map((name) => ({ name, images: [] as string[] }))].map((c) => ({
    name: c.name,
    images: c.images.length > 0 ? c.images : product.images,
  }));
}

/**
 * Produto como a loja mostra: `images` passa a ser as fotos da primeira cor (vitrine, cards e sacola) e `colors` leva as
 * fotos de cada cor para a página do produto trocar a galeria ao escolher a cor.
 */
export function withColorPhotos<T extends WithColors>(product: T): Omit<T, "colors"> & { colors: ColorPhotos[] } {
  const colors = colorsOf(product);
  return { ...product, images: colors[0]?.images ?? product.images, colors };
}

/** Versão para listas (cards, vitrines): troca `images` e não leva as cores nem as numerações. */
export function withFirstColorPhotos<T extends WithColors>(product: T): Omit<T, "colors" | "variants"> {
  const colors = colorsOf(product);
  const { colors: _colors, variants: _variants, ...rest } = product;
  return { ...rest, images: colors[0]?.images ?? product.images };
}
