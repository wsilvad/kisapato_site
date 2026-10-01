export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: number;
  color: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  careInstructions?: string | null;
  active?: boolean;
  /** Decimal serializado como string pela API (ex.: "249.90") */
  price: string;
  /** Preço "de" quando o produto está em promoção. */
  compareAtPrice?: string | null;
  badge?: "LANCAMENTO" | "PROMOCAO" | "DESTAQUE" | null;
  images: string[];
  category: Category;
  variants?: ProductVariant[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  role: "CUSTOMER" | "ADMIN";
}

export interface Campaign {
  id: string;
  eyebrow: string | null;
  title: string;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
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

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  variant: ProductVariant & { product: Product };
}

export interface Order {
  id: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELED";
  total: string;
  createdAt: string;
  items: OrderItem[];
  profile?: { name: string | null; email: string };
}
