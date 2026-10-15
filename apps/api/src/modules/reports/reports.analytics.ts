/**
 * Cálculos dos indicadores. Funções puras (recebem linhas já carregadas), para poderem ser
 * testadas sem banco. A busca dos dados fica em reports.service.ts.
 */
import { dayKey, type Period } from "./reports.period.js";

/** Pedidos nestas situações contam como venda realizada (faturamento). */
export const REALIZED = ["PAID", "PICKING", "SHIPPED", "DELIVERED"] as const;
export const isRealized = (status: string) => (REALIZED as readonly string[]).includes(status);

export const LOW_STOCK = 3;

export interface ItemRow {
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  productId: string;
  productName: string;
  categoryName: string;
  className: string | null;
  brandName: string | null;
  audiences: string[];
}

export interface OrderRow {
  id: string;
  status: string;
  total: number;
  createdAt: Date;
  profileId: string;
  items: ItemRow[];
}

const money = (n: number) => Math.round(n * 100) / 100;
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export interface Totals {
  revenue: number;
  orders: number;
  items: number;
  avgTicket: number;
}

/** Faturamento, pedidos, itens e ticket médio das vendas realizadas. */
export function totalsOf(orders: OrderRow[]): Totals {
  const sold = orders.filter((o) => isRealized(o.status));
  const revenue = sold.reduce((sum, o) => sum + o.total, 0);
  return {
    revenue: money(revenue),
    orders: sold.length,
    items: sold.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    avgTicket: money(ratio(revenue, sold.length)),
  };
}

export interface RankRow {
  name: string;
  quantity: number;
  revenue: number;
  share: number;
  /** Lucro dos itens com custo conhecido (null = nenhum item do grupo tem custo). */
  profit: number | null;
  /** Lucro sobre a receita dos itens com custo (null quando não há custo). */
  margin: number | null;
}

function rank(sold: OrderRow[], keysOf: (item: ItemRow) => string[]): RankRow[] {
  const map = new Map<string, { quantity: number; revenue: number; profit: number; costedRevenue: number }>();
  for (const order of sold) {
    for (const item of order.items) {
      for (const key of keysOf(item)) {
        const row = map.get(key) ?? { quantity: 0, revenue: 0, profit: 0, costedRevenue: 0 };
        const line = item.quantity * item.unitPrice;
        row.quantity += item.quantity;
        row.revenue += line;
        if (item.unitCost !== null) {
          row.profit += item.quantity * (item.unitPrice - item.unitCost);
          row.costedRevenue += line;
        }
        map.set(key, row);
      }
    }
  }
  const total = [...map.values()].reduce((s, r) => s + r.revenue, 0);
  return [...map.entries()]
    .map(([name, r]) => ({
      name,
      quantity: r.quantity,
      revenue: money(r.revenue),
      share: ratio(r.revenue, total),
      profit: r.costedRevenue > 0 ? money(r.profit) : null,
      margin: r.costedRevenue > 0 ? ratio(r.profit, r.costedRevenue) : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Recortes do painel: cada campo restringe os itens vendidos por nome (ex.: marca "Ki Sapato"). */
export interface Filters {
  className?: string;
  categoryName?: string;
  brandName?: string;
  audienceName?: string;
  productName?: string;
}

const SEM = { class: "Sem classe", brand: "Sem marca", audience: "Sem público" };

const matches = (item: ItemRow, f: Filters) =>
  (!f.className || (item.className ?? SEM.class) === f.className) &&
  (!f.categoryName || item.categoryName === f.categoryName) &&
  (!f.brandName || (item.brandName ?? SEM.brand) === f.brandName) &&
  (!f.audienceName || (item.audiences.length > 0 ? item.audiences.includes(f.audienceName) : f.audienceName === SEM.audience)) &&
  (!f.productName || item.productName === f.productName);

/**
 * Aplica os recortes: o pedido fica só com os itens que casam (e some se não sobrar nenhum), e o total
 * passa a ser a soma desses itens, então faturamento filtrado = receita dos itens do recorte.
 */
export function applyFilters(orders: OrderRow[], f: Filters): OrderRow[] {
  if (!Object.values(f).some(Boolean)) return orders;
  return orders.flatMap((order) => {
    const items = order.items.filter((i) => matches(i, f));
    if (items.length === 0) return [];
    return [{ ...order, items, total: money(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)) }];
  });
}

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
  items: number;
  /** Lucro dos itens com custo conhecido naquele dia. */
  profit: number;
}

/** Uma linha por dia do período (dias sem venda vêm zerados), só com vendas realizadas. */
export function dailySeries(orders: OrderRow[], days: string[]): DailyPoint[] {
  const map = new Map(days.map((date) => [date, { date, revenue: 0, orders: 0, items: 0, profit: 0 }]));
  for (const order of orders) {
    if (!isRealized(order.status)) continue;
    const row = map.get(dayKey(order.createdAt));
    if (!row) continue;
    row.revenue = money(row.revenue + order.total);
    row.orders += 1;
    for (const item of order.items) {
      row.items += item.quantity;
      if (item.unitCost !== null) row.profit = money(row.profit + item.quantity * (item.unitPrice - item.unitCost));
    }
  }
  return [...map.values()];
}

const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hourCycle: "h23" });

export interface HeatCell {
  /** 0 = segunda … 6 = domingo (horário de Brasília). */
  weekday: number;
  hour: number;
  orders: number;
  revenue: number;
}

/** Vendas por dia da semana × hora, só as células com venda. */
export function heatmapOf(orders: OrderRow[]): HeatCell[] {
  const cells = new Map<number, HeatCell>();
  for (const order of orders) {
    if (!isRealized(order.status)) continue;
    const parts = Object.fromEntries(clock.formatToParts(order.createdAt).map((p) => [p.type, p.value]));
    const weekday = WEEKDAY[parts.weekday!]!;
    const hour = Number(parts.hour) % 24;
    const key = weekday * 24 + hour;
    const cell = cells.get(key) ?? { weekday, hour, orders: 0, revenue: 0 };
    cell.orders += 1;
    cell.revenue = money(cell.revenue + order.total);
    cells.set(key, cell);
  }
  return [...cells.values()].sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}

export interface Overview {
  kpis: Totals & {
    pendingOrders: number;
    pendingRevenue: number;
    canceledOrders: number;
    canceledRate: number;
    customers: number;
    newCustomers: number;
    returningCustomers: number;
    grossProfit: number | null;
    margin: number | null;
    /** Parte do faturamento cujos produtos tinham custo cadastrado (a margem só vale sobre ela). */
    profitCoverage: number;
  };
  daily: DailyPoint[];
  heatmap: HeatCell[];
  byStatus: Record<string, { orders: number; total: number }>;
  topProducts: (RankRow & { abc: "A" | "B" | "C" })[];
  byClass: RankRow[];
  byCategory: RankRow[];
  byBrand: RankRow[];
  byAudience: RankRow[];
}

/**
 * Indicadores de um período. `firstPurchase` guarda a data da primeira compra realizada de cada cliente,
 * para separar clientes novos de recorrentes.
 */
export function buildOverview(orders: OrderRow[], period: Period, firstPurchase: Map<string, Date>): Overview {
  const sold = orders.filter((o) => isRealized(o.status));
  const totals = totalsOf(orders);

  const byStatus: Overview["byStatus"] = {};
  for (const order of orders) {
    const row = (byStatus[order.status] ??= { orders: 0, total: 0 });
    row.orders += 1;
    row.total = money(row.total + order.total);
  }

  // Lucro só considera itens com custo conhecido na hora da venda.
  let costedRevenue = 0;
  let itemsRevenue = 0;
  let grossProfit = 0;
  for (const order of sold) {
    for (const item of order.items) {
      const line = item.quantity * item.unitPrice;
      itemsRevenue += line;
      if (item.unitCost !== null) {
        const profit = item.quantity * (item.unitPrice - item.unitCost);
        costedRevenue += line;
        grossProfit += profit;
      }
    }
  }

  const topProducts = rank(sold, (i) => [i.productName]);
  let cumulative = 0;
  const withAbc = topProducts.map((row) => {
    const abc = cumulative < 0.8 ? "A" : cumulative < 0.95 ? "B" : "C";
    cumulative += row.share;
    return { ...row, abc: abc as "A" | "B" | "C" };
  });

  const buyers = new Set(sold.map((o) => o.profileId));
  const newCustomers = [...buyers].filter((id) => {
    const first = firstPurchase.get(id);
    return first !== undefined && first >= period.start && first < period.end;
  }).length;

  const canceled = byStatus.CANCELED?.orders ?? 0;
  const pending = byStatus.PENDING ?? { orders: 0, total: 0 };

  return {
    kpis: {
      ...totals,
      pendingOrders: pending.orders,
      pendingRevenue: pending.total,
      canceledOrders: canceled,
      canceledRate: ratio(canceled, orders.length),
      customers: buyers.size,
      newCustomers,
      returningCustomers: buyers.size - newCustomers,
      grossProfit: costedRevenue > 0 ? money(grossProfit) : null,
      margin: costedRevenue > 0 ? ratio(grossProfit, costedRevenue) : null,
      profitCoverage: ratio(costedRevenue, itemsRevenue),
    },
    daily: dailySeries(orders, period.days),
    heatmap: heatmapOf(orders),
    byStatus,
    topProducts: withAbc,
    byClass: rank(sold, (i) => [i.className ?? "Sem classe"]),
    byCategory: rank(sold, (i) => [i.categoryName]),
    byBrand: rank(sold, (i) => [i.brandName ?? "Sem marca"]),
    // Cada produto tem um único público (faixa + gênero, ex.: "Infantil · Menina").
    byAudience: rank(sold, (i) => (i.audiences.length > 0 ? i.audiences : ["Sem público"])),
  };
}

/* ---------- estoque ---------- */

export interface VariantRow {
  variantId: string;
  productId: string;
  productName: string;
  productActive: boolean;
  productCreatedAt: Date;
  categoryName: string;
  brandName: string | null;
  color: string;
  size: number;
  sku: string;
  stock: number;
  price: number;
  cost: number | null;
}

export type StockStatus = "OUT" | "LOW" | "OK";

export interface InventoryItem extends VariantRow {
  status: StockStatus;
  sold30: number;
  /** Quantos dias o estoque dura no ritmo de vendas dos últimos 30 dias (null = sem vendas para estimar). */
  daysOfCover: number | null;
  /** Tem estoque, foi cadastrado há mais de 60 dias e não vendeu nada nesse período. */
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

/** `sales` traz as unidades vendidas de cada variação nos últimos 30 e 60 dias. */
export function buildInventory(variants: VariantRow[], sales: Map<string, { sold30: number; sold60: number }>, now = new Date()): Inventory {
  const cutoff = now.getTime() - 60 * 86_400_000;
  const items = variants.map<InventoryItem>((v) => {
    const sold = sales.get(v.variantId) ?? { sold30: 0, sold60: 0 };
    const status: StockStatus = v.stock === 0 ? "OUT" : v.stock <= LOW_STOCK ? "LOW" : "OK";
    return {
      ...v,
      status,
      sold30: sold.sold30,
      daysOfCover: sold.sold30 > 0 ? Math.round(v.stock / (sold.sold30 / 30)) : null,
      stalled: v.stock > 0 && sold.sold60 === 0 && v.productCreatedAt.getTime() < cutoff,
    };
  });

  const active = items.filter((i) => i.productActive);
  const costed = active.filter((i) => i.cost !== null);
  return {
    lowStockThreshold: LOW_STOCK,
    totals: {
      variants: active.length,
      units: active.reduce((s, i) => s + i.stock, 0),
      outOfStock: active.filter((i) => i.status === "OUT").length,
      lowStock: active.filter((i) => i.status === "LOW").length,
      stalled: active.filter((i) => i.stalled).length,
      costValue: money(costed.reduce((s, i) => s + i.stock * i.cost!, 0)),
      saleValue: money(active.reduce((s, i) => s + i.stock * i.price, 0)),
      potentialProfit: money(costed.reduce((s, i) => s + i.stock * (i.price - i.cost!), 0)),
      variantsWithoutCost: active.length - costed.length,
    },
    // Esgotados e baixos primeiro: é o que pede ação.
    items: items.sort((a, b) => rankStatus(a) - rankStatus(b) || a.productName.localeCompare(b.productName, "pt-BR") || a.color.localeCompare(b.color, "pt-BR") || a.size - b.size),
  };
}

const rankStatus = (i: InventoryItem) => (i.status === "OUT" ? 0 : i.status === "LOW" ? 1 : 2);

/* ---------- clientes ---------- */

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  orders: { status: string; total: number; createdAt: Date }[];
}

export function buildCustomers(rows: CustomerRow[]) {
  return rows
    .map((c) => {
      const sold = c.orders.filter((o) => isRealized(o.status));
      const spent = sold.reduce((s, o) => s + o.total, 0);
      const last = sold.reduce<Date | null>((d, o) => (d === null || o.createdAt > d ? o.createdAt : d), null);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        createdAt: c.createdAt,
        orders: sold.length,
        canceled: c.orders.filter((o) => o.status === "CANCELED").length,
        spent: money(spent),
        avgTicket: money(ratio(spent, sold.length)),
        lastOrderAt: last,
      };
    })
    .sort((a, b) => b.spent - a.spent || a.email.localeCompare(b.email));
}
