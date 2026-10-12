import { prisma } from "../../lib/prisma.js";
import { REALIZED, applyFilters, buildCustomers, buildInventory, buildOverview, dailySeries, totalsOf, type Filters, type OrderRow, type VariantRow } from "./reports.analytics.js";
import { previousPeriod, type Period } from "./reports.period.js";

const DAY_MS = 86_400_000;

async function loadOrders(start: Date, end: Date): Promise<OrderRow[]> {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: {
      items: {
        omit: { unitCost: false },
        include: {
          variant: {
            include: { product: { include: { category: { include: { productClass: true } }, brand: true, audiences: true } } },
          },
        },
      },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    total: Number(o.total),
    createdAt: o.createdAt,
    profileId: o.profileId,
    items: o.items.map((i) => {
      const product = i.variant.product;
      return {
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        unitCost: i.unitCost === null ? null : Number(i.unitCost),
        productId: product.id,
        productName: product.name,
        categoryName: product.category.name,
        className: product.category.productClass?.name ?? null,
        brandName: product.brand?.name ?? null,
        audiences: product.audiences.map((a) => a.name),
      };
    }),
  }));
}

export async function overview(period: Period, filters: Filters = {}) {
  const previous = previousPeriod(period);
  const [orders, previousOrders, firstPurchases] = await Promise.all([
    loadOrders(period.start, period.end),
    loadOrders(previous.start, previous.end),
    prisma.order.groupBy({ by: ["profileId"], where: { status: { in: [...REALIZED] } }, _min: { createdAt: true } }),
  ]);
  const firstPurchase = new Map(firstPurchases.map((f) => [f.profileId, f._min.createdAt!]));
  const current = applyFilters(orders, filters);
  const before = applyFilters(previousOrders, filters);
  return {
    period: { from: period.from, to: period.to, days: period.days.length },
    previous: { from: previous.from, to: previous.to, ...totalsOf(before), daily: dailySeries(before, previous.days) },
    ...buildOverview(current, period, firstPurchase),
  };
}

export async function inventory(now = new Date()) {
  const since60 = new Date(now.getTime() - 60 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const [variants, recent] = await Promise.all([
    prisma.productVariant.findMany({ include: { product: { omit: { costPrice: false }, include: { category: true, brand: true } } } }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: [...REALIZED] }, createdAt: { gte: since60 } } },
      select: { variantId: true, quantity: true, order: { select: { createdAt: true } } },
    }),
  ]);

  const sales = new Map<string, { sold30: number; sold60: number }>();
  for (const item of recent) {
    const row = sales.get(item.variantId) ?? { sold30: 0, sold60: 0 };
    row.sold60 += item.quantity;
    if (item.order.createdAt >= since30) row.sold30 += item.quantity;
    sales.set(item.variantId, row);
  }

  const rows: VariantRow[] = variants.map((v) => ({
    variantId: v.id,
    productId: v.productId,
    productName: v.product.name,
    productActive: v.product.active,
    productCreatedAt: v.product.createdAt,
    categoryName: v.product.category.name,
    brandName: v.product.brand?.name ?? null,
    color: v.color,
    size: v.size,
    sku: v.sku,
    stock: v.stock,
    price: Number(v.product.price),
    cost: v.product.costPrice === null ? null : Number(v.product.costPrice),
  }));
  return buildInventory(rows, sales, now);
}

export async function customers() {
  const profiles = await prisma.profile.findMany({
    where: { role: "CUSTOMER" },
    include: { orders: { select: { status: true, total: true, createdAt: true } } },
  });
  return buildCustomers(profiles.map((p) => ({ ...p, orders: p.orders.map((o) => ({ ...o, total: Number(o.total) })) })));
}
