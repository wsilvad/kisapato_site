import sandalImage from "@/assets/product-sandal.jpg";
import sneakerImage from "@/assets/product-sneaker.jpg";
import bagImage from "@/assets/product-bag.jpg";
import kidsImage from "@/assets/product-kids.jpg";

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  gender: string;
  badge: "Lançamento" | "Promoção" | "Destaque" | null;
  brand: string | null;
  description: string | null;
  reference: string | null;
  is_active: boolean;
  category_id?: string | null;
  category_name?: string;
  category_slug?: string;
  image_url?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export const fallbackProducts: Product[] = [
  { id: "1", name: "Mule couro trançado", slug: "mule-couro-trancado", price: 289.9, compare_at_price: null, gender: "Feminino", badge: "Lançamento", brand: "Marca A", description: "Mule elegante em couro com trama artesanal.", reference: "KS-1001", is_active: true, category_name: "Sapatos", category_slug: "sapatos" },
  { id: "2", name: "Tênis casual couro branco", slug: "tenis-casual-couro-branco", price: 349.9, compare_at_price: null, gender: "Masculino", badge: "Lançamento", brand: "Marca B", description: "Tênis casual em couro, leve e versátil.", reference: "KS-1002", is_active: true, category_name: "Tênis", category_slug: "tenis" },
  { id: "3", name: "Sandália infantil velcro", slug: "sandalia-infantil-velcro", price: 129.9, compare_at_price: null, gender: "Infantil", badge: "Lançamento", brand: "Marca C", description: "Sandália confortável com fechamento seguro.", reference: "KS-1003", is_active: true, category_name: "Sandálias", category_slug: "sandalias" },
  { id: "4", name: "Scarpin salto bloco", slug: "scarpin-salto-bloco", price: 219.9, compare_at_price: 279.9, gender: "Feminino", badge: "Promoção", brand: "Marca D", description: "Scarpin de bico fino com salto bloco confortável.", reference: "KS-1004", is_active: true, category_name: "Sapatos", category_slug: "sapatos" },
  { id: "5", name: "Sapato social oxford", slug: "sapato-social-oxford", price: 459.9, compare_at_price: null, gender: "Masculino", badge: "Destaque", brand: "Marca B", description: "Oxford clássico em couro legítimo.", reference: "KS-1005", is_active: true, category_name: "Sapatos", category_slug: "sapatos" },
  { id: "6", name: "Rasteira tiras finas", slug: "rasteira-tiras-finas", price: 99.9, compare_at_price: 139.9, gender: "Feminino", badge: "Promoção", brand: "Marca E", description: "Rasteira delicada para dias leves.", reference: "KS-1006", is_active: true, category_name: "Rasteiras e chinelos", category_slug: "rasteiras-e-chinelos" },
  { id: "7", name: "Tênis infantil luz de LED", slug: "tenis-infantil-luz-de-led", price: 189.9, compare_at_price: null, gender: "Infantil", badge: "Destaque", brand: "Marca C", description: "Tênis infantil divertido com luzes na sola.", reference: "KS-1007", is_active: true, category_name: "Tênis", category_slug: "tenis" },
  { id: "8", name: "Bota cano curto camurça", slug: "bota-cano-curto-camurca", price: 399.9, compare_at_price: null, gender: "Feminino", badge: "Lançamento", brand: "Marca A", description: "Bota de cano curto com acabamento macio.", reference: "KS-1008", is_active: true, category_name: "Botas", category_slug: "botas" },
  { id: "9", name: "Mocassim couro legítimo", slug: "mocassim-couro-legitimo", price: 319.9, compare_at_price: 389.9, gender: "Masculino", badge: "Promoção", brand: "Marca F", description: "Mocassim em couro de construção flexível.", reference: "KS-1009", is_active: true, category_name: "Sapatos", category_slug: "sapatos" },
  { id: "10", name: "Tênis esportivo corrida", slug: "tenis-esportivo-corrida", price: 379.9, compare_at_price: null, gender: "Masculino", badge: "Destaque", brand: "Marca C", description: "Amortecimento responsivo para corrida diária.", reference: "KS-1010", is_active: true, category_name: "Tênis", category_slug: "tenis" },
  { id: "11", name: "Sapatilha infantil laço", slug: "sapatilha-infantil-laco", price: 89.9, compare_at_price: null, gender: "Infantil", badge: null, brand: "Marca E", description: "Sapatilha delicada com laço frontal.", reference: "KS-1011", is_active: true, category_name: "Sapatos", category_slug: "sapatos" },
  { id: "12", name: "Sandália salto fino", slug: "sandalia-salto-fino", price: 259.9, compare_at_price: null, gender: "Feminino", badge: "Lançamento", brand: "Marca D", description: "Sandália sofisticada para ocasiões especiais.", reference: "KS-1012", is_active: true, category_name: "Sandálias", category_slug: "sandalias" },
  { id: "13", name: "Bolsa estruturada clássica", slug: "bolsa-estruturada-classica", price: 329.9, compare_at_price: null, gender: "Feminino", badge: "Destaque", brand: "Marca A", description: "Bolsa estruturada com alça removível.", reference: "KS-1013", is_active: true, category_name: "Bolsas e acessórios", category_slug: "bolsas-e-acessorios" },
  { id: "14", name: "Carteira masculina couro", slug: "carteira-masculina-couro", price: 149.9, compare_at_price: null, gender: "Masculino", badge: "Lançamento", brand: "Marca F", description: "Carteira compacta em couro legítimo.", reference: "KS-1014", is_active: true, category_name: "Bolsas e acessórios", category_slug: "bolsas-e-acessorios" },
];

const categoryRows: Array<[string, string, string]> = [
  ["feminino", "Feminino", "Gênero"], ["masculino", "Masculino", "Gênero"], ["infantil", "Infantil", "Gênero"],
  ["tenis", "Tênis", "Categoria"], ["sandalias", "Sandálias", "Categoria"], ["sapatos", "Sapatos", "Categoria"],
  ["botas", "Botas", "Categoria"], ["rasteiras-e-chinelos", "Rasteiras e chinelos", "Categoria"], ["bolsas-e-acessorios", "Bolsas e acessórios", "Categoria"],
];
export const fallbackCategories: Category[] = categoryRows.map(([slug, name, kind], index) => ({ id: slug, slug, name, kind, image_url: null, is_active: true, sort_order: index + 1 }));

export function productImage(product: Pick<Product, "slug" | "gender" | "category_slug">) {
  if ("image_url" in product && typeof product.image_url === "string") return product.image_url;
  if (product.category_slug === "bolsas-e-acessorios") return bagImage;
  if (product.gender === "Infantil") return kidsImage;
  if (product.gender === "Masculino" || product.category_slug === "tenis") return sneakerImage;
  return sandalImage;
}

export const formatPrice = (price: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

export function installmentText(price: number) {
  if (price >= 300) return `6x de ${formatPrice(price / 6)} sem juros`;
  if (price >= 150) return `3x de ${formatPrice(price / 3)} sem juros`;
  return "Pix ou cartão";
}