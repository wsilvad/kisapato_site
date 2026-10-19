import { getAdminToken } from "@/lib/admin-session";
import type { AdminStats, Address, Audience, Brand, Campaign, Capabilities, Category, CustomerStat, DashFilters, Facets, Inventory, Order, Overview, Paginated, Product, ProductClass, SavedCard, ShippingQuote, Showcase, PanelUser, SiteSettings, StockMovement, Story, User } from "@/types/product";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
/** Origem da API (sem /api), usada para servir as fotos enviadas em /uploads. */
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function assetUrl(path: string | null | undefined) {
  if (!path) return undefined;
  return path.startsWith("/uploads/") ? `${API_ORIGIN}${path}` : path;
}

/** Miniatura de uma foto enviada pelo admin (`/uploads/x.jpg` → `x-thumb.jpg`); outras origens ficam como estão. */
export function thumbUrl(path: string | null | undefined) {
  if (!path || !path.startsWith("/uploads/")) return assetUrl(path);
  return assetUrl(path.replace(/\.[a-z0-9]+$/i, "-thumb.jpg"));
}

export const TOKEN_KEY = "ki-sapato:token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Código estável do caso (ex.: "CPF_REQUIRED"), quando a API informa. */
    public readonly code?: string,
    /** Corpo inteiro da resposta de erro (campos extras como `phoneHint`, `emailOk`). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Chamadas de /admin usam a sessão do painel (por aba); as demais, a sessão do cliente da loja. */
async function request<T>(path: string, init: RequestInit & { json?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const token = init.admin || path.startsWith("/admin") ? getAdminToken() : window.localStorage.getItem(TOKEN_KEY);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ({ error?: string; code?: string } & Record<string, unknown>) | null;
    throw new ApiError(body?.error ?? `API ${res.status} em ${path}`, res.status, body?.code, body ?? undefined);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface AuthResult {
  token: string;
  user: User;
}

/** Cadastro criado, mas a conta só abre depois de confirmar os códigos enviados por e-mail e SMS. */
export interface PendingRegistration {
  verificationRequired: true;
  email: string;
  /** Também há um código por SMS para confirmar (só quando o provedor de SMS está configurado). */
  phoneRequired: boolean;
  /** Telefone com parte oculta, ex.: (51) *****-8888 (vazio se o SMS não é exigido). */
  phoneHint: string;
}

/** Senha certa, mas a conta tem verificação em duas etapas: falta o código (use `api.twoFactorLogin`). */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challenge: string;
}

export function needsTwoFactor(result: AuthResult | TwoFactorChallenge): result is TwoFactorChallenge {
  return "twoFactorRequired" in result;
}

/** Campos de um endereço ao criar ou editar. */
export interface AddressInput {
  label?: string;
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  isDefault?: boolean;
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
  /** `category`, `ageGroup`, `gender`, `brand`, `color` e `size` aceitam vários valores separados por vírgula. */
  listProducts(params: { page?: number; pageSize?: number; category?: string; productClass?: string; ageGroup?: string; gender?: string; brand?: string; color?: string; size?: string; minPrice?: string; maxPrice?: string; sort?: string; selo?: string; slugs?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return request<Paginated<Product>>(`/products?${query}`);
  },
  /** Opções do painel de filtros para a seleção (`selo`/`search`); `ageGroup` limita a contagem por gênero. */
  productFacets(params: { selo?: string; search?: string; ageGroup?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    return request<Facets>(`/products/facets?${query}`);
  },
  /** Contagens do menu do topo de todas as seleções ("" = tudo, lancamento, promocao, destaque) numa chamada só. */
  menuSegments: () => request<Record<string, Pick<Facets, "segments" | "total">>>("/products/menu-segments"),
  getProduct: (slug: string) => request<Product>(`/products/${encodeURIComponent(slug)}`),
  /** Com `selo`, faixa ou gênero, só as categorias que têm produtos naquela seleção (menu da loja). */
  listCategories(params: { selo?: string; ageGroup?: string; gender?: string } = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    return request<Category[]>(`/categories${query.size ? `?${query}` : ""}`);
  },
  /** "Compre junto": peças de outras categorias que combinam com o produto. */
  relatedProducts: (slug: string) => request<Product[]>(`/products/${encodeURIComponent(slug)}/related`),
  shippingQuote: (cep: string, subtotal: number) => request<ShippingQuote>(`/shipping/quote?${new URLSearchParams({ cep, subtotal: String(subtotal) })}`),
  listClasses: () => request<ProductClass[]>("/classes"),
  listAudiences: () => request<Audience[]>("/audiences"),
  listBrands: () => request<Brand[]>("/brands"),
  home: () => request<{ campaigns: Campaign[]; showcases: Required<Showcase>[]; categories: Category[]; audiences: Audience[]; stories: Story[] }>("/home"),
  settings: () => request<SiteSettings>("/settings"),

  /** O cadastro não abre sessão: devolve o pedido de confirmação dos dois códigos (e-mail e SMS). */
  register: (data: { name: string; email: string; cpf: string; phone: string; password: string }) =>
    request<PendingRegistration>("/auth/register", { method: "POST", json: data }),
  verifyRegistration: (data: { email: string; emailCode: string; phoneCode?: string }) =>
    request<AuthResult>("/auth/register/verify", { method: "POST", json: data }),
  resendRegistrationCodes: (email: string) => request<{ ok: true; message: string }>("/auth/register/resend", { method: "POST", json: { email } }),
  login: (data: { email: string; password: string }) => request<AuthResult | TwoFactorChallenge>("/auth/login", { method: "POST", json: data }),
  /** Segunda etapa da entrada: código do aplicativo autenticador ou código de emergência. */
  twoFactorLogin: (data: { challenge: string; code: string }) => request<AuthResult>("/auth/2fa/login", { method: "POST", json: data }),
  me: () => request<User>("/auth/me"),
  capabilities: () => request<Capabilities>("/auth/capabilities"),
  /** `identifier`: e-mail da conta ou telefone confirmado. A resposta é sempre a mesma, exista a conta ou não. */
  forgotPassword: (identifier: string) => request<{ ok: true; message: string }>("/auth/forgot", { method: "POST", json: { identifier } }),
  resetPassword: (data: { identifier: string; code: string; newPassword: string }) => request<{ ok: true }>("/auth/reset", { method: "POST", json: data }),

  account: {
    updateProfile: (data: { name: string; cpf: string; phone?: string }) => request<User>("/account/profile", { method: "PUT", json: data }),
    changePassword: (data: { currentPassword: string; newPassword: string }) => request<AuthResult>("/account/password", { method: "PUT", json: data }),
    sendPhoneCode: () => request<{ ok: true }>("/account/phone/send-code", { method: "POST" }),
    confirmPhone: (code: string) => request<User>("/account/phone/confirm", { method: "POST", json: { code } }),

    addresses: () => request<Address[]>("/account/addresses"),
    addAddress: (data: AddressInput) => request<Address>("/account/addresses", { method: "POST", json: data }),
    updateAddress: (id: string, data: AddressInput) => request<Address>(`/account/addresses/${id}`, { method: "PUT", json: data }),
    setDefaultAddress: (id: string) => request<Address[]>(`/account/addresses/${id}/default`, { method: "PUT" }),
    deleteAddress: (id: string) => request<void>(`/account/addresses/${id}`, { method: "DELETE" }),

    twoFactorStatus: () => request<{ enabled: boolean; available: boolean; recoveryCodesLeft: number }>("/account/2fa/status"),
    twoFactorSetup: () => request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/account/2fa/setup", { method: "POST" }),
    twoFactorEnable: (code: string) => request<AuthResult & { recoveryCodes: string[] }>("/account/2fa/enable", { method: "POST", json: { code } }),
    twoFactorDisable: (data: { password: string; code: string }) => request<AuthResult>("/account/2fa/disable", { method: "POST", json: data }),
    newRecoveryCodes: (data: { password: string; code: string }) => request<{ recoveryCodes: string[] }>("/account/2fa/recovery-codes", { method: "POST", json: data }),
    dismissTwoFactorOffer: () => request<User>("/account/2fa/dismiss-offer", { method: "POST" }),

    cards: () => request<SavedCard[]>("/account/cards"),
    setDefaultCard: (id: string) => request<SavedCard[]>(`/account/cards/${id}/default`, { method: "PUT" }),
    deleteCard: (id: string) => request<void>(`/account/cards/${id}`, { method: "DELETE" }),
  },
  /** Confere a sessão do painel (token da aba) e devolve o usuário. */
  adminMe: () => request<User>("/auth/me", { admin: true }),

  /** Endereço salvo (`addressId`) ou digitado na hora (`shippingAddress`, com `saveAddress` para guardá-lo na conta). */
  createOrder: (data: { items: { variantId: string; quantity: number }[]; addressId?: string; shippingAddress?: ShippingAddress; saveAddress?: boolean }) =>
    request<Order>("/orders", { method: "POST", json: data }),
  myOrders: () => request<Order[]>("/orders/mine"),

  admin: {
    list: <T>(resource: "products" | "categories" | "classes" | "audiences" | "brands" | "campaigns" | "showcases" | "stories" | "orders") => request<T[]>(`/admin/${resource}`),
    get: <T>(resource: string, id: string) => request<T>(`/admin/${resource}/${id}`),
    /** Ativa/desativa direto da tabela. Inativo some da loja (e leva os produtos ligados, no caso de categoria, classe e marca). */
    setActive: (resource: "products" | "categories" | "classes" | "brands" | "stories", id: string, active: boolean) =>
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
    pages: () => request<SiteSettings["pages"]>("/admin/pages"),
    savePage: (slug: string, json: { title: string; body: string }) => request<SiteSettings["pages"][number]>(`/admin/pages/${slug}`, { method: "PUT", json }),
    users: () => request<PanelUser[]>("/admin/users"),
    createUser: (json: { name: string; email: string; password: string; permissions: string[] }) => request<PanelUser>("/admin/users", { method: "POST", json }),
    updateUser: (id: string, json: { name: string; permissions: string[] }) => request<PanelUser>(`/admin/users/${id}`, { method: "PUT", json }),
    setUserPassword: (id: string, password: string) => request<void>(`/admin/users/${id}/password`, { method: "POST", json: { password } }),
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
    /** Vídeo de story (MP4, WebM ou MOV, até 15 MB); devolve o endereço guardado. */
    async uploadVideo(file: File) {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string }>("/admin/uploads/video", { method: "POST", body: form });
    },
    async upload(files: FileList | File[]) {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return request<{ urls: string[] }>("/admin/uploads", { method: "POST", body: form });
    },
  },
};
