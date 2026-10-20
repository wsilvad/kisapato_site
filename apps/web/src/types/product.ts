import type { AgeGroup, Gender } from "@/lib/segment";

/** Classe de produto, nível acima da categoria (Calçados, Acessórios…). */
export interface ProductClass {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active?: boolean;
  _count?: { categories: number };
}

/** Marca do produto, com cadastro próprio. */
export interface Brand {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active?: boolean;
  _count?: { products: number };
}

/** Atalho de público (Feminino, Infantil, Menina…): cartão da home que leva a uma faixa etária e/ou gênero. */
export interface Audience {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  sortOrder: number;
  /** Vazio = todas as faixas / todos os gêneros. */
  ageGroup?: AgeGroup | null;
  gender?: Gender | null;
  _count?: { products: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  classId?: string | null;
  productClass?: ProductClass | null;
  active?: boolean;
  imageUrl?: string | null;
  sortOrder?: number;
  showOnHome?: boolean;
  /** Só vem nas listagens do admin. */
  _count?: { products: number };
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: number;
  /** Rótulo da grade de confecção ("M", "Único"); vazio = mostra o número. */
  sizeLabel?: string | null;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand?: Brand | null;
  brandId?: string | null;
  careInstructions?: string | null;
  /** Nome como vem do ERP (com a referência); só o ERP muda. `name` é o nome exibido no site. */
  erpName?: string | null;
  /** Nas listas: as cores têm preços diferentes, então o preço mostrado é "a partir de". */
  priceFrom?: boolean;
  /** Referência do fornecedor no ERP: produto gerenciado pelo ERP. */
  erpRef?: string | null;
  /** Tipo de grade das numerações (numeração ou confecção). */
  sizeScheme?: "NUMERACAO" | "CONFECCAO";
  /** Última vez que os dados (e o estoque) do produto foram puxados do ERP. */
  erpSyncedAt?: string | null;
  ageGroup?: AgeGroup;
  gender?: Gender;
  reference?: string | null;
  categoryId?: string;
  active?: boolean;
  /** Decimal serializado como string pela API (ex.: "249.90") */
  price: string;
  /** Preço "de" quando o produto está em promoção. */
  compareAtPrice?: string | null;
  /** Custo de compra (só o admin vê); base da margem nos indicadores. */
  costPrice?: string | null;
  badge?: "LANCAMENTO" | "PROMOCAO" | "DESTAQUE" | null;
  /** Fotos da primeira cor (vitrine, cards e sacola); no admin, as fotos gerais do produto. */
  images: string[];
  /** Fotos de cada cor, na ordem da loja (a primeira abre a página do produto). */
  colors?: ProductColor[];
  category: Category;
  variants?: ProductVariant[];
}

/** Cor do produto com as suas fotos (até 4). */
export interface ProductColor {
  name: string;
  images: string[];
  /** Preço da cor (o do produto quando ela não tem preço próprio) e o "de" riscado. */
  price?: string | null;
  compareAtPrice?: string | null;
}

/** Opção de filtro com a quantidade de produtos que ela traz. */
export interface FacetOption {
  name: string;
  slug: string;
  count: number;
}

/** Opções do painel "Filtrar por", calculadas para a seleção atual (lançamentos, promoções…). */
export interface Facets {
  /** Adulto / Infantil. */
  ageGroups: FacetOption[];
  /** Feminino / Masculino (unissex conta nos dois); só da faixa pedida, quando há uma. */
  genders: FacetOption[];
  /** Por faixa: total e quantos servem a feminino e a masculino (menu do topo). */
  segments: Record<"adulto" | "infantil", { total: number; feminino: number; masculino: number }>;
  categories: FacetOption[];
  brands: FacetOption[];
  colors: string[];
  sizes: number[];
  price: { min: number; max: number } | null;
  total: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Com busca: "exact" = achou o que foi digitado (sem contar acentos); "similar" = não achou e mostra os parecidos. */
  searchMode?: "exact" | "similar";
}

export type BadgeKey = "LANCAMENTO" | "PROMOCAO" | "DESTAQUE";

export const BADGE_LABEL: Record<BadgeKey, string> = {
  LANCAMENTO: "Lançamento",
  PROMOCAO: "Promoção",
  DESTAQUE: "Destaque",
};

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** CPF só com dígitos (null em contas antigas, que precisam informá-lo antes de comprar). */
  cpf: string | null;
  role: "CUSTOMER" | "ADMIN";
  /** Áreas do painel liberadas (só ADMIN; "*" = todas; vazio = acesso ao painel desativado). */
  permissions?: string[];
  twoFactorEnabled: boolean;
  /** A verificação em duas etapas ainda não foi ativada nem dispensada: mostrar a oferta. */
  twoFactorOffer: boolean;
  phoneVerified: boolean;
}

/** Endereço de entrega salvo na conta. Um só é o padrão. */
export interface Address {
  id: string;
  label: string | null;
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  isDefault: boolean;
}

/** Cartão salvo: só bandeira, 4 últimos dígitos e validade (o número nunca é guardado). */
export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  isDefault: boolean;
}

/** O que o servidor consegue oferecer hoje. */
export interface Capabilities {
  /** false = cadastro indisponível (não há como enviar os códigos). */
  registration: boolean;
  /** O cadastro confirma também o telefone por SMS? (liga sozinho quando há provedor de SMS.) */
  phoneVerification: boolean;
  emailRecovery: boolean;
  smsRecovery: boolean;
  twoFactor: boolean;
  savedCards: boolean;
}

export interface Campaign {
  id: string;
  startsAt?: string | null;
  endsAt?: string | null;
  eyebrow: string | null;
  title: string;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  /** Enquadramento da foto (foco em %, zoom 1–3). Ausente = centralizada, sem zoom. */
  desktopFocusX?: number;
  desktopFocusY?: number;
  desktopZoom?: number;
  mobileFocusX?: number;
  mobileFocusY?: number;
  mobileZoom?: number;
  sortOrder: number;
  active: boolean;
}

export interface Showcase {
  id: string;
  title: string;
  selectionRule: BadgeKey;
  itemLimit: number;
  sortOrder: number;
  active: boolean;
  products?: Product[];
}

/** Cartão vertical da home (GIF ou foto), no estilo "stories". */
export interface Story {
  id: string;
  title: string | null;
  mediaUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface OrderEvent {
  id: string;
  status: Order["status"];
  note: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  /** Conferido na separação do estoque. */
  picked?: boolean;
  quantity: number;
  unitPrice: string;
  variant: ProductVariant & { product: Product };
}

export interface Order {
  id: string;
  shippingAddress?: Record<string, string>;
  status: "PENDING" | "PAID" | "PICKING" | "SHIPPED" | "DELIVERED" | "CANCELED";
  total: string;
  createdAt: string;
  items: OrderItem[];
  /** Rastreio preenchido ao enviar (o cliente vê). */
  carrier?: string | null;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  /** Observação da equipe (só o painel recebe). */
  internalNote?: string | null;
  events?: OrderEvent[];
  profile?: { name: string | null; email: string; phone?: string | null };
}

export interface SiteLink {
  label: string;
  url: string;
}

/** Conteúdo editável do site; espelha modules/settings/settings.schemas.ts da API. */
export interface ShippingRegion {
  name: string;
  states: string[];
  price: number;
  minDays: number;
  maxDays: number;
}

export interface ShippingOption {
  id: string;
  label: string;
  /** 0 = grátis. */
  price: number;
  minDays: number;
  maxDays: number;
  note?: string;
}

export interface ShippingQuote {
  cep: string;
  state: string;
  place: string;
  options: ShippingOption[];
  freeShippingMissing: number | null;
}

export interface SiteSettings {
  shipping: { freeAbove: number; pickup: { active: boolean; label: string; note: string }; regions: ShippingRegion[] };
  topbar: string[];
  /** Perfis da loja nas redes (ícones do cabeçalho); vazio = ícone escondido. */
  social: { instagram: string; facebook: string; pinterest: string; tiktok: string };
  nav: (SiteLink & { highlight: boolean })[];
  promo: { active: boolean; eyebrow: string; title: string; buttonLabel: string; buttonUrl: string };
  benefits: { title: string; text: string }[];
  /** Páginas institucionais (/institucional/<slug>); sem texto = fora do ar e fora do rodapé. */
  pages: { slug: string; title: string; body: string }[];
  footer: {
    columns: { title: string; links: SiteLink[] }[];
    storeTitle: string;
    address: string;
    phone: string;
    hours: string;
    cnpj: string;
    /** WhatsApp com DDI e DDD (ex.: +5551998113318); vazio = sem botão flutuante. */
    whatsapp?: string;
    /** "latitude,longitude" da loja para o mapa de Nossas lojas; vazio = sem mapa. */
    mapCoords?: string;
    /** Logos de pagamento do rodapé, na ordem: visa, mastercard, elo, hipercard, amex, diners, boleto, pix. */
    paymentMethods: string[];
  };
}

export interface AdminStats {
  products: { active: number; inactive: number; lowStock: number; lowStockThreshold: number };
  categories: number;
  campaigns: number;
  showcases: number;
  orders: Partial<Record<Order["status"], number>>;
}

/* ---------- gestão: indicadores, estoque, clientes ---------- */

export interface RankRow {
  name: string;
  quantity: number;
  revenue: number;
  share: number;
  /** Lucro dos itens com custo conhecido; null = nenhum item do grupo tem custo cadastrado. */
  profit: number | null;
  margin: number | null;
}

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  items: number;
  profit: number;
}

/** Vendas de um dia da semana (0 = segunda … 6 = domingo) numa hora, no horário de Brasília. */
export interface HeatCell {
  weekday: number;
  hour: number;
  orders: number;
  revenue: number;
}

/** Recortes do painel de indicadores, pelo nome (iguais aos nomes dos rankings). */
export type DashFilters = Partial<Record<"classe" | "categoria" | "marca" | "publico" | "produto", string>>;

export interface Overview {
  period: { from: string; to: string; days: number };
  previous: { from: string; to: string; revenue: number; orders: number; items: number; avgTicket: number; daily: DailyPoint[] };
  kpis: {
    revenue: number;
    orders: number;
    items: number;
    avgTicket: number;
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRate: number;
    customers: number;
    newCustomers: number;
    returningCustomers: number;
    grossProfit: number | null;
    margin: number | null;
    profitCoverage: number;
  };
  daily: DailyPoint[];
  heatmap: HeatCell[];
  byStatus: Partial<Record<Order["status"], { orders: number; total: number }>>;
  topProducts: (RankRow & { abc: "A" | "B" | "C" })[];
  byClass: RankRow[];
  byCategory: RankRow[];
  byBrand: RankRow[];
  byAudience: RankRow[];
}

export interface InventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  productActive: boolean;
  categoryName: string;
  brandName: string | null;
  color: string;
  size: number;
  /** Rótulo da grade de confecção ("M", "Único"); vazio = mostra o número. */
  sizeLabel?: string | null;
  sku: string;
  stock: number;
  price: number;
  cost: number | null;
  status: "OUT" | "LOW" | "OK";
  sold30: number;
  daysOfCover: number | null;
  stalled: boolean;
}

export interface Inventory {
  lowStockThreshold: number;
  totals: {
    variants: number;
    units: number;
    outOfStock: number;
    lowStock: number;
    stalled: number;
    costValue: number;
    saleValue: number;
    potentialProfit: number;
    variantsWithoutCost: number;
  };
  items: InventoryItem[];
}

export interface StockMovement {
  id: string;
  type: "SALE" | "CANCELLATION" | "ADJUSTMENT";
  quantity: number;
  balance: number;
  note: string | null;
  orderId: string | null;
  createdAt: string;
  variant: { sku: string; color: string; size: number; sizeLabel?: string | null; product: { name: string } };
}

export interface CustomerStat {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: number;
  canceled: number;
  spent: number;
  avgTicket: number;
  lastOrderAt: string | null;
}

/** Usuário do painel (Usuários). */
export interface PanelUser {
  id: string;
  name: string | null;
  email: string;
  permissions: string[];
  twoFactorEnabled: boolean;
  createdAt: string;
}

/** Resultado do botão "Atualizar do ERP" (Produtos). */
export interface ErpRefreshReport {
  finishedAt: string;
  flaggedItems: number;
  created: { name: string; reference: string; colors: number }[];
  updated: { name: string; reference: string; newColors: number; stockChanges: number }[];
  needsReview: { reference: string; brand: string; reason: string }[];
}
