import type { AdminStats, Audience, Brand, Campaign, Category, CustomerStat, DashFilters, Inventory, Order, Overview, StockMovement, Paginated, Product, ProductClass, Showcase, SiteSettings, User } from "@/types/product";

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
  listProducts(params: { page?: number; category?: string; productClass?: string; audience?: string; brand?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return request<Paginated<Product>>(`/products?${query}`);
  },
  getProduct: (slug: string) => request<Product>(`/products/${encodeURIComponent(slug)}`),
  listCategories: () => request<Category[]>("/categories"),
  listClasses: () => request<ProductClass[]>("/classes"),
  listAudiences: () => request<Audience[]>("/audiences"),
  listBrands: () => request<Brand[]>("/brands"),
  home: () => request<{ campaigns: Campaign[]; showcases: Required<Showcase>[]; categories: Category[] }>("/home"),
  settings: () => request<SiteSettings>("/settings"),

  register: (data: { name: string; email: string; phone?: string; password: string }) =>
    request<AuthResult>("/auth/register", { method: "POST", json: data }),
  login: (data: { email: string; password: string }) => request<AuthResult>("/auth/login", { method: "POST", json: data }),
  me: () => request<User>("/auth/me"),

  createOrder: (data: { items: { variantId: string; quantity: number }[]; shippingAddress: ShippingAddress }) =>
    request<Order>("/orders", { method: "POST", json: data }),
  myOrders: () => request<Order[]>("/orders/mine"),

  admin: {
    list: <T>(resource: "products" | "categories" | "classes" | "audiences" | "brands" | "campaigns" | "showcases" | "orders") => request<T[]>(`/admin/${resource}`),
    get: <T>(resource: string, id: string) => request<T>(`/admin/${resource}/${id}`),
    /** Ativa/desativa direto da tabela. Inativo some da loja (e leva os produtos ligados, no caso de categoria, classe e marca). */
    setActive: (resource: "products" | "categories" | "classes" | "brands", id: string, active: boolean) =>
      request<{ id: string; active: boolean }>(`/admin/${resource}/${id}/active`, { method: "PATCH", json: { active } }),
    stats: () => request<AdminStats>("/admin/stats"),
    overview: (from: string, to: string, filters: DashFilters = {}) =>
      request<Overview>(`/admin/reports/overview?${new URLSearchParams({ from, to, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })}`),
    inventory: () => request<Inventory>("/admin/reports/inventory"),
    customers: () => request<CustomerStat[]>("/admin/reports/customers"),
    movements: (variantId?: string, limit = 100) => request<StockMovement[]>(`/admin/stock/movements?${new URLSearchParams({ ...(variantId && { variantId }), limit: String(limit) })}`),
    adjustStock: (variantId: string, change: { delta: number } | { set: number }, note?: string) =>
      request<{ id: string; stock: number }>(`/admin/stock/${variantId}/adjust`, { method: "POST", json: { ...change, note } }),
    getSettings: () => request<SiteSettings>("/admin/settings"),
    saveSettings: (json: SiteSettings) => request<SiteSettings>("/admin/settings", { method: "PUT", json }),
    create: <T>(resource: string, json: unknown) => request<T>(`/admin/${resource}`, { method: "POST", json }),
    update: <T>(resource: string, id: string, json: unknown) => request<T>(`/admin/${resource}/${id}`, { method: "PUT", json }),
    remove: (resource: string, id: string) => request<void>(`/admin/${resource}/${id}`, { method: "DELETE" }),
    /** Muda a situação do pedido; ao enviar, pode levar transportadora, código e link de rastreio. */
    setOrderStatus: (id: string, status: Order["status"], extra: { note?: string; carrier?: string; trackingCode?: string; trackingUrl?: string } = {}) =>
      request<Order>(`/admin/orders/${id}/status`, { method: "PATCH", json: { status, ...extra } }),
    setTracking: (id: string, tracking: { carrier?: string; trackingCode?: string; trackingUrl?: string }) =>
      request<Order>(`/admin/orders/${id}/tracking`, { method: "PATCH", json: tracking }),
    setOrderNote: (id: string, internalNote: string) => request<Order>(`/admin/orders/${id}/note`, { method: "PATCH", json: { internalNote } }),
    setItemPicked: (orderId: string, itemId: string, picked: boolean) =>
      request<{ id: string; picked: boolean }>(`/admin/orders/${orderId}/items/${itemId}/picked`, { method: "PATCH", json: { picked } }),
    async upload(files: FileList | File[]) {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return request<{ urls: string[] }>("/admin/uploads", { method: "POST", body: form });
    },
  },
};
