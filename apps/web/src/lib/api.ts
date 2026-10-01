import type { Category, Paginated, Product } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  listProducts(params: { page?: number; category?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return request<Paginated<Product>>(`/products?${query}`);
  },
  getProduct(slug: string) {
    return request<Product>(`/products/${encodeURIComponent(slug)}`);
  },
  listCategories() {
    return request<Category[]>("/categories");
  },
};
