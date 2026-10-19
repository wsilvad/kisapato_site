import type { ErpItem } from "./client.js";

/** Regras de tradução dos itens do ERP para o catálogo do site (puras, sem banco nem rede). */

const CONNECTORS = new Set(["da", "de", "do", "das", "dos", "e"]);
/** Palavras de tipo sem acento no ERP. */
const ACCENTS: Record<string, string> = {
  tenis: "Tênis", sandalia: "Sandália", sapatenis: "Sapatênis", bone: "Boné", calca: "Calça", macacao: "Macacão", oculos: "Óculos", alca: "Alça", perfume: "Perfume",
};

export const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** "TENIS LUZ DA LUA 58650400" → "Tênis Luz da Lua 58650400" (palavras com número, como referências, ficam em maiúsculas). */
export function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (/\d/.test(word)) return word.toUpperCase();
      const lower = word.toLocaleLowerCase("pt-BR");
      const key = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (ACCENTS[key]) return ACCENTS[key]!;
      if (i > 0 && CONNECTORS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

/** O nome do pai é a descrição do item sem a cor no fim. */
export function parentName(item: ErpItem): string {
  const color = item.color.trim();
  const description = item.description.trim().replace(/\s+/g, " ");
  const stripped = color && description.toUpperCase().endsWith(color.toUpperCase()) ? description.slice(0, description.length - color.length).trim() : description;
  return titleCase(stripped);
}

export const colorName = (item: ErpItem) => titleCase(item.color);

/** Tipo do item em título ("TENIS INFANTIL" → "Tênis Infantil"). */
export const typeName = (item: Pick<ErpItem, "type">) => titleCase(item.type);

/**
 * Nome exibido no site, refeito com os dados do sistema (tipo + marca), sem a referência e sem a cor:
 * "Tênis Luz da Lua". A referência continua no campo próprio e o nome do ERP fica guardado à parte.
 */
export const displayName = (item: Pick<ErpItem, "type">, brandName: string) => `${typeName(item)} ${brandName}`.trim();

/** Tipo do ERP → categoria do site (null = ainda sem categoria definida). */
const CATEGORY_BY_TYPE: Record<string, string> = {
  TENIS: "Tênis", "TENIS INFANTIL": "Tênis", "TENIS BOTINHA": "Tênis",
  SANDALIA: "Sandálias", CHINELO: "Chinelo", "CHINELO PELO": "Chinelo", "CHINELO INFANTIL": "Chinelo",
  BOTA: "Botas", "BOTA INFANTIL": "Botas", SAPATO: "Sapato", MOCASSIM: "Sapato", LOAFER: "Sapato",
  SAPATILHA: "Sapatilha", SAPATENIS: "Sapatênis", MULE: "Mule", SLINGBACK: "Slingback",
  CHANEL: "Chanel", TAMANCO: "Tamancos", BOLSA: "Bolsas", MOCHILA: "Mochilas",
};
export const categoryFor = (type: string): string | null => CATEGORY_BY_TYPE[type.trim().toUpperCase()] ?? null;

export type AgeGroup = "ADULTO" | "INFANTIL";
export type Gender = "FEMININO" | "MASCULINO" | "UNISSEX";

/** Gênero do ERP → faixa etária + gênero do site (MENINA INFANTIL e MENINO são infantis). */
export function segmentFor(item: Pick<ErpItem, "gender" | "type">): { ageGroup: AgeGroup; gender: Gender } | null {
  const g = item.gender.trim().toUpperCase();
  const kids = /INFANTIL/.test(item.type.toUpperCase());
  if (g === "FEMININO") return { ageGroup: kids ? "INFANTIL" : "ADULTO", gender: "FEMININO" };
  if (g === "MASCULINO") return { ageGroup: kids ? "INFANTIL" : "ADULTO", gender: "MASCULINO" };
  if (g === "UNISEX" || g === "UNISSEX") return { ageGroup: kids ? "INFANTIL" : "ADULTO", gender: "UNISSEX" };
  if (g === "MENINA INFANTIL") return { ageGroup: "INFANTIL", gender: "FEMININO" };
  if (g === "MENINO") return { ageGroup: "INFANTIL", gender: "MASCULINO" };
  return null;
}

export type SizeScheme = "NUMERACAO" | "CONFECCAO";
/** Grade de confecção: a posição vira o `size` (ordem de exibição) e o rótulo mostra o tamanho. */
export const CLOTHING_ORDER: Record<string, number> = { U: 0, ÚNICO: 0, UNICO: 0, PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XGG: 7 };
export const clothingLabel = (label: string) => (label.toUpperCase() === "U" || label.toUpperCase().startsWith("ÚNIC") || label.toUpperCase() === "UNICO" ? "Único" : label.toUpperCase());

/** Numerações só com números (ou faixas) = NUMERACAO; P/M/G/Único = CONFECCAO; qualquer outra mistura = null (vai para o relatório). */
export function sizeSchemeFor(labels: string[]): SizeScheme | null {
  if (labels.length === 0) return null;
  if (labels.every((l) => /^\d+$/.test(l) || /^\d+\s*[-/]\s*\d+$/.test(l))) return "NUMERACAO";
  if (labels.every((l) => l.toUpperCase() in CLOTHING_ORDER)) return "CONFECCAO";
  return null;
}

/** Saldo do ERP → estoque do site: arredonda para baixo e nunca fica negativo. */
export const clampStock = (qty: number) => Math.max(0, Math.floor(qty));

export interface PlanSize {
  size: number;
  label: string;
  /** Rótulo mostrado quando a grade é de confecção (ex.: "M", "Único"); nulo na numeração. */
  sizeLabel: string | null;
  erpSizeCode: string;
  ean: string | null;
  stock: number;
  erpStock: number;
  sku: string;
}
export interface PlanColor {
  erpItemCode: string;
  name: string;
  position: number;
  flagged: boolean;
  disabledNote: string | null;
  price: number;
  previousPrice: number;
  cost: number;
  sizes: PlanSize[];
  totalStock: number;
}
export interface ImportPlan {
  key: { brandCode: string; ref: string };
  product: {
    /** Nome exibido no site (tipo + marca, sem referência). */
    name: string;
    /** Nome como vem do ERP (com a referência). */
    erpName: string;
    typeName: string;
    slug: string;
    reference: string;
    category: string | null;
    ageGroup: AgeGroup | null;
    gender: Gender | null;
    sizeScheme: SizeScheme | null;
    price: number;
    compareAtPrice: number | null;
    costPrice: number;
    active: false;
  };
  colors: PlanColor[];
  warnings: string[];
  errors: string[];
}

export interface PlanInput {
  item: ErpItem;
  stock: Map<string, number>;
}

export interface PlanOptions {
  /** Nome da marca no site (ou, na simulação, o do ERP em título). Sem ele, o nome do site é o do ERP sem a referência. */
  brandName?: string;
}

/**
 * Monta o plano de um produto pai (marca + referência) com todas as cores (itens) dele. Só calcula: quem aplica no banco
 * é o importador. `errors` impede a gravação; `warnings` são avisos para a loja conferir.
 */
export function buildPlan(inputs: PlanInput[], { brandName }: PlanOptions = {}): ImportPlan {
  const sorted = [...inputs].sort((a, b) => Number(a.item.pkItem.split(".")[1]) - Number(b.item.pkItem.split(".")[1]));
  const first = sorted[0]!.item;
  const warnings: string[] = [];
  const errors: string[] = [];

  const category = categoryFor(first.type);
  if (!category) errors.push(`Tipo "${first.type}" ainda sem categoria no site.`);
  const segment = segmentFor(first);
  if (!segment) errors.push(`Gênero "${first.gender}" não reconhecido.`);

  const differ = (label: string, pick: (i: ErpItem) => string) => {
    const values = new Set(sorted.map((s) => pick(s.item)));
    if (values.size > 1) warnings.push(`${label} diferente entre as cores: ${[...values].join(", ")}.`);
  };
  differ("Tipo", (i) => i.type);
  differ("Gênero", (i) => i.gender);
  differ("Nome", (i) => parentName(i));

  const schemes = new Set(sorted.map((s) => sizeSchemeFor(s.item.sizes.map((z) => z.label)) ?? "MISTA"));
  const scheme = schemes.size === 1 ? ([...schemes][0] as SizeScheme | "MISTA") : "MISTA";
  if (scheme === "MISTA") errors.push("Grade de tamanhos mista ou diferente entre as cores: precisa de revisão.");
  else if (scheme === "NUMERACAO" && sorted.some((s) => s.item.sizes.some((z) => !/^\d+$/.test(z.label)))) {
    errors.push("Numeração com faixa ou letra misturada: revisar a grade deste produto.");
  }

  const prices = sorted.map((s) => s.item.price).filter((p) => p > 0);
  const price = prices.length ? Math.min(...prices) : 0;
  if (prices.length === 0) warnings.push("Nenhuma cor tem preço de venda do site no ERP: o produto fica sem preço (e inativo).");
  else if (new Set(prices).size > 1) warnings.push(`Preços diferentes entre as cores (${[...new Set(prices)].join(", ")}): cada cor mantém o seu e o produto usa o menor.`);
  const zeroPrice = sorted.filter((s) => s.item.price <= 0).length;
  if (prices.length && zeroPrice) warnings.push(`${zeroPrice} cor(es) sem preço de venda do site (não marcadas para o site no ERP): usam o preço do produto.`);
  const previous = sorted.map((s) => s.item.previousPrice).filter((p) => p > price && price > 0);
  const compareAtPrice = previous.length ? Math.min(...previous) : null;
  const costs = sorted.map((s) => s.item.cost).filter((c) => c > 0);
  if (new Set(costs).size > 1) warnings.push(`Custos diferentes entre as cores (${[...new Set(costs)].join(", ")}).`);

  const seenColors = new Set<string>();
  const colors: PlanColor[] = sorted.map(({ item, stock }, position) => {
    const name = colorName(item);
    if (seenColors.has(name.toLowerCase())) errors.push(`Cor repetida na referência: ${name}.`);
    seenColors.add(name.toLowerCase());
    const clothing = scheme === "CONFECCAO";
    const sizes: PlanSize[] = item.sizes
      .filter((z) => clothing || /^\d+$/.test(z.label))
      .map((z) => {
        const erpStock = stock.get(z.code) ?? 0;
        const label = clothing ? clothingLabel(z.label) : z.label;
        const size = clothing ? CLOTHING_ORDER[z.label.toUpperCase()] ?? 0 : Number(z.label);
        return { size, label, sizeLabel: clothing ? label : null, erpSizeCode: z.code, ean: z.ean || null, stock: clampStock(erpStock), erpStock, sku: `${item.pkItem}-${label}` };
      })
      .sort((a, b) => a.size - b.size);
    const grade = new Set(item.sizes.map((z) => z.code));
    for (const code of stock.keys()) if (!grade.has(code)) warnings.push(`${name}: estoque em tamanho fora da grade (código ${code}).`);
    const negatives = sizes.filter((s) => s.erpStock < 0);
    if (negatives.length) warnings.push(`${name}: saldo negativo no ERP em ${negatives.map((s) => `${s.label} (${s.erpStock})`).join(", ")}; entra como 0.`);
    const disabled = /AUTO DISABLED/i.test(item.note) ? item.note.trim() : null;
    if (disabled) warnings.push(`${name}: ${disabled} (o ERP desativou este item sozinho).`);
    return {
      erpItemCode: item.pkItem,
      name,
      position,
      flagged: item.siteClass !== "NONE" && item.siteClass !== "",
      disabledNote: disabled,
      price: item.price,
      previousPrice: item.previousPrice,
      cost: item.cost,
      sizes,
      totalStock: sizes.reduce((sum, s) => sum + s.stock, 0),
    };
  });

  const erpName = parentName(first);
  const name = brandName ? displayName(first, brandName) : titleCase(erpName.split(first.supplierRef).join(" ").replace(/\s+/g, " ").trim());
  return {
    key: { brandCode: first.brandCode, ref: first.supplierRef },
    product: {
      name,
      erpName,
      typeName: typeName(first),
      slug: slugify(erpName),
      reference: first.supplierRef,
      category,
      ageGroup: segment?.ageGroup ?? null,
      gender: segment?.gender ?? null,
      sizeScheme: scheme === "MISTA" ? null : scheme,
      price,
      compareAtPrice,
      costPrice: costs.length ? Math.min(...costs) : 0,
      active: false,
    },
    colors,
    warnings,
    errors,
  };
}
