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
  /** Decimal serializado como string pela API (ex.: "249.90") */
  price: string;
  /** Preço "de" quando o produto está em promoção; ainda não existe na API. */
  compareAtPrice?: string | null;
  /** Selo do card; sem valor, só "Promoção" é inferido de compareAtPrice. */
  badge?: "Lançamento" | "Promoção" | "Destaque";
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
