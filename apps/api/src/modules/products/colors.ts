/** Fotos por cor: no máximo 4 por cor. */
export const MAX_COLOR_PHOTOS = 4;

export interface ColorPhotos {
  name: string;
  images: string[];
  /** Preço da cor: o dela, ou o do produto quando a cor não tem preço próprio. */
  price: string;
  compareAtPrice: string | null;
}

type Money = { toString(): string } | string | number;

interface WithColors {
  price: Money;
  compareAtPrice?: Money | null;
  /** Produto do ERP: cor sem foto própria fica oculta na loja (não herda as fotos gerais). */
  erpRef?: string | null;
  images: string[];
  colors: { name: string; position: number; images: string[]; price?: Money | null; compareAtPrice?: Money | null }[];
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
  const own = (c: { price?: Money | null; compareAtPrice?: Money | null }) =>
    c.price != null
      ? { price: String(c.price), compareAtPrice: c.compareAtPrice != null ? String(c.compareAtPrice) : null }
      : { price: String(product.price), compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : null };
  const all: ColorPhotos[] = [
    ...known.map((c) => ({ name: c.name, images: c.images, ...own(c) })),
    ...extra.map((name) => ({ name, images: [] as string[], ...own({}) })),
  ];
  // Produto do ERP: só aparece a cor que já tem fotos. Produto cadastrado à mão: cor sem fotos usa as gerais.
  if (product.erpRef) return all.filter((c) => c.images.length > 0);
  return all.map((c) => ({ ...c, images: c.images.length > 0 ? c.images : product.images }));
}

/**
 * Produto como a loja mostra: `images` passa a ser as fotos da primeira cor (vitrine, cards e sacola) e `colors` leva as
 * fotos de cada cor para a página do produto trocar a galeria ao escolher a cor.
 */
export function withColorPhotos<T extends WithColors>(product: T): Omit<T, "colors"> & { colors: ColorPhotos[] } {
  const colors = colorsOf(product);
  // Só as numerações das cores que aparecem (cor oculta por falta de foto não pode ser comprada).
  const visible = new Set(colors.map((c) => c.name.toLowerCase()));
  const variants = product.variants?.filter((v) => visible.has(v.color.toLowerCase()));
  return { ...product, ...(variants && { variants }), images: colors[0]?.images ?? product.images, colors };
}

/** Versão para listas (cards, vitrines): troca `images` e não leva as cores nem as numerações. */
export function withFirstColorPhotos<T extends WithColors>(product: T): Omit<T, "colors" | "variants"> {
  const colors = colorsOf(product);
  const { colors: _colors, variants: _variants, ...rest } = product;
  // Preços diferentes entre as cores: o card mostra "a partir de" (o preço do produto é o menor).
  const priceFrom = new Set(colors.map((c) => c.price)).size > 1;
  return { ...rest, images: colors[0]?.images ?? product.images, priceFrom };
}
