import type { Campaign, Category, Order, Paginated, Product, Showcase, User } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
/** Origem da API (sem /api), usada para servir as fotos enviadas em /uploads. */
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function assetUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return path.startsWith("/uploads/") ? `${API_ORIGIN}${path}` : path;
}

export const TOKEN_KEY = "ki-sapato:token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `API ${res.status} em ${path}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface ShippingAddress {
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
}

export const api = {
  listProducts(params: { page?: number; category?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return request<Paginated<Product>>(`/products?${query}`);
  },
  getProduct: (slug: string) => request<Product>(`/products/${encodeURIComponent(slug)}`),
  listCategories: () => request<Category[]>("/categories"),
  home: () => request<{ campaigns: Campaign[]; showcases: Required<Showcase>[] }>("/home"),

  register: (data: { name: string; email: string; phone?: string; password: string }) =>
    request<AuthResult>("/auth/register", { method: "POST", json: data }),
  login: (data: { email: string; password: string }) => request<AuthResult>("/auth/login", { method: "POST", json: data }),
  me: () => request<User>("/auth/me"),

  createOrder: (data: { items: { variantId: string; quantity: number }[]; shippingAddress: ShippingAddress }) =>
    request<Order>("/orders", { method: "POST", json: data }),
  myOrders: () => request<Order[]>("/orders/mine"),

  admin: {
    list: <T>(resource: "products" | "categories" | "campaigns" | "showcases" | "orders") => request<T[]>(`/admin/${resource}`),
    create: <T>(resource: string, json: unknown) => request<T>(`/admin/${resource}`, { method: "POST", json }),
    update: <T>(resource: string, id: string, json: unknown) => request<T>(`/admin/${resource}/${id}`, { method: "PUT", json }),
    remove: (resource: string, id: string) => request<void>(`/admin/${resource}/${id}`, { method: "DELETE" }),
    setOrderStatus: (id: string, status: Order["status"]) =>
      request<Order>(`/admin/orders/${id}/status`, { method: "PATCH", json: { status } }),
    async upload(files: FileList | File[]) {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return request<{ urls: string[] }>("/admin/uploads", { method: "POST", body: form });
    },
  },
};
