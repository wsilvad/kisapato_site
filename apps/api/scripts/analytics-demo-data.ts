/**
 * Gera eventos de mentira (visitas, buscas, sacola, erros…) para testar as views e os dashboards de medição.
 * SÓ para banco descartável: recusa rodar em produção ou fora de localhost, a não ser com --force.
 *   npx tsx scripts/analytics-demo-data.ts [--days 14] [--sessions 60] [--clean]
 * --clean apaga antes todos os eventos e resumos de medição.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const num = (name: string, fallback: number) => (args.includes(`--${name}`) ? Number(args[args.indexOf(`--${name}`) + 1]) : fallback);
const days = num("days", 14);
const perDay = num("sessions", 60);
const url = process.env.DATABASE_URL ?? "";
if ((process.env.NODE_ENV === "production" || !/localhost|127\.0\.0\.1/.test(url)) && !args.includes("--force")) {
  console.error("Recusado: este script só roda em banco descartável (localhost). Use --force sob sua responsabilidade.");
  process.exit(1);
}

const products = await prisma.$queryRaw<{ id: string; name: string; price: string }[]>`SELECT id, name, price::text FROM products WHERE active ORDER BY name`;
const variants = await prisma.$queryRaw<{ id: string; "productId": string }[]>`SELECT id, "productId" FROM product_variants`;
if (products.length < 3) {
  console.error("Poucos produtos para simular; rode o seed ou a atualização do ERP primeiro.");
  process.exit(1);
}
if (args.includes("--clean")) {
  await prisma.$executeRawUnsafe("TRUNCATE analytics.events, analytics.daily_product_stats, analytics.daily_funnel, analytics.daily_quality, analytics.product_price_daily");
  await prisma.$executeRawUnsafe("DELETE FROM order_items; DELETE FROM orders");
}

// popularidade desigual: o primeiro produto é muito visto e pouco comprado (oportunidade de preço); o último, pouco visto e muito comprado (joia escondida)
const weight = (i: number) => (i === 0 ? 8 : i === products.length - 1 ? 0.7 : 2 + (i % 3));
const pBuy = (i: number) => (i === 0 ? 0.01 : i === products.length - 1 ? 0.5 : 0.1);
const pick = <T,>(items: T[], w: (i: number) => number): [T, number] => {
  const total = items.reduce((s, _, i) => s + w(i), 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= w(i);
    if (r <= 0) return [items[i]!, i];
  }
  return [items[items.length - 1]!, items.length - 1];
};

type Row = Record<string, unknown>;
const rows: Row[] = [];
const sources = ["direto", "instagram", "google", "whatsapp"];
const deviceOf = (w: number) => (w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop");
const ev = (at: Date, s: { aid: string; sid: string; device: number; utm?: string }, event: string, extra: Row = {}) => rows.push({ occurred_at: at.toISOString(), event, anonymous_id: s.aid, session_id: s.sid, viewport_w: s.device, device_type: deviceOf(s.device), utm_source: s.utm ?? null, ...extra });
const purchases: { at: Date; variant: string; price: string }[] = [];

for (let d = days; d >= 0; d--) {
  for (let n = 0; n < perDay; n++) {
    const t0 = new Date(Date.now() - d * 86_400_000 - Math.floor(Math.random() * 12 * 3_600_000));
    let t = t0.getTime();
    const tick = (ms = 4000) => new Date((t += Math.floor(Math.random() * ms) + 500));
    const device = Math.random() < 0.7 ? 390 : Math.random() < 0.5 ? 820 : 1440;
    const sess = { aid: randomUUID(), sid: randomUUID(), device, utm: sources[Math.floor(Math.random() * sources.length)] === "direto" ? undefined : sources[Math.floor(Math.random() * 3) + 1] };
    ev(tick(), sess, "page_view", { path: "/" });
    if (Math.random() < 0.3) continue; // rebote
    if (Math.random() < 0.35) ev(tick(), sess, "search", { path: "/produtos", search_term: ["tênis", "bota", "sandália", "chinelo", "preto", "bolsa vermelha"][Math.floor(Math.random() * 6)], results_count: Math.random() < 0.2 ? 0 : Math.floor(Math.random() * 12) + 1 });
    ev(tick(), sess, "page_view", { path: "/produtos" });
    let carted: { product: (typeof products)[number]; idx: number; variant: string } | null = null;
    const looks = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < looks; k++) {
      const [prod, idx] = pick(products, weight);
      ev(tick(), sess, "product_impression", { path: "/produtos", product_id: prod.id, price: prod.price, list_name: "categoria", list_position: idx + 1 });
      if (Math.random() < 0.55) {
        ev(tick(), sess, "product_click", { path: "/produtos", product_id: prod.id, price: prod.price, list_name: "categoria", list_position: idx + 1 });
        ev(tick(), sess, "page_view", { path: `/produtos/${prod.id.slice(0, 8)}` });
        ev(tick(), sess, "product_view", { path: `/produtos/${prod.id.slice(0, 8)}`, product_id: prod.id, price: prod.price, props: { stock: 10 } });
        if (Math.random() < 0.18) ev(tick(), sess, "favorite_add", { product_id: prod.id, props: { origin: "produto" } });
        if (Math.random() < 0.3) ev(tick(), sess, "shipping_quote", { price: 24.9, props: { cep3: "013", days: 3 } });
        if (!carted && Math.random() < 0.3 + (idx === 0 ? 0.1 : 0)) {
          const v = variants.find((x) => x.productId === prod.id);
          if (v) {
            carted = { product: prod, idx, variant: v.id };
            const item = { item_id: prod.id, variant_id: v.id, item_name: prod.name, price: Number(prod.price), quantity: 1 };
            ev(tick(), sess, "add_to_cart", { product_id: prod.id, variant_id: v.id, price: prod.price, quantity: 1, cart_value: prod.price, props: { items: [item] } });
            ev(tick(1500), sess, "cart_updated", { cart_value: prod.price, items_count: 1, props: { items: [item] } });
            if (Math.random() < 0.15) {
              ev(tick(), sess, "remove_from_cart", { product_id: prod.id, variant_id: v.id, price: prod.price, quantity: 1, cart_value: 0 });
              ev(tick(1500), sess, "cart_updated", { cart_value: 0, items_count: 0, props: { items: [] } });
              carted = null;
            }
          }
        }
      }
    }
    if (carted && Math.random() < 0.55) {
      ev(tick(), sess, "page_view", { path: "/checkout" });
      ev(tick(), sess, "begin_checkout", { path: "/checkout", cart_value: carted.product.price, items_count: 1 });
      if (Math.random() < pBuy(carted.idx) * 4) {
        const at = tick();
        ev(at, sess, "purchase", { path: "/checkout", cart_value: carted.product.price, items_count: 1, props: { server: true } });
        purchases.push({ at, variant: carted.variant, price: carted.product.price });
      }
    }
    // problemas de experiência
    if (Math.random() < 0.06) ev(tick(), sess, "js_error", { path: "/produtos", error_code: "TypeError: x is undefined" });
    if (Math.random() < 0.05) ev(tick(), sess, "api_error", { path: "/checkout", error_code: Math.random() < 0.5 ? "500" : "409", props: { endpoint: "/orders", method: "POST" } });
    if (Math.random() < 0.04) ev(tick(), sess, "rage_click", { path: "/produtos", props: { target: "button.btn" } });
    if (Math.random() < 0.7) ev(tick(), sess, "web_vital", { path: "/produtos", value_num: 1200 + Math.random() * 3800 + (device === 390 ? 800 : 0), props: { metric: "LCP", rating: "good" } });
  }
}

// grava em blocos
const cols = ["occurred_at", "event", "anonymous_id", "session_id", "viewport_w", "device_type", "utm_source", "path", "product_id", "variant_id", "price", "quantity", "cart_value", "items_count", "search_term", "results_count", "list_name", "list_position", "value_num", "error_code", "props"];
let inserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const values: unknown[] = [];
  const tuples = chunk.map((r, j) => {
    const base = j * cols.length;
    values.push(...cols.map((c) => (c === "props" ? JSON.stringify(r[c] ?? {}) : (r[c] ?? null))));
    return `(${cols.map((c, k) => (c === "occurred_at" ? `$${base + k + 1}::timestamptz` : c === "props" ? `$${base + k + 1}::jsonb` : c === "anonymous_id" || c === "session_id" ? `$${base + k + 1}::uuid` : `$${base + k + 1}`)).join(",")})`;
  });
  await prisma.$executeRawUnsafe(`INSERT INTO analytics.events (${cols.join(",")}) VALUES ${tuples.join(",")}`, ...values);
  inserted += chunk.length;
}
// pedidos de verdade para cada compra simulada (as vendas dos resumos vêm dos pedidos)
const profile = (await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM profiles LIMIT 1`)[0];
if (profile) {
  for (const p of purchases) {
    const orderId = randomUUID();
    await prisma.$executeRaw`INSERT INTO orders (id, "profileId", status, total, "shippingAddress", "createdAt", "updatedAt") VALUES (${orderId}, ${profile.id}::uuid, 'PAID'::"OrderStatus", ${p.price}::numeric, '{}'::jsonb, ${p.at.toISOString()}::timestamptz, ${p.at.toISOString()}::timestamptz)`;
    await prisma.$executeRaw`INSERT INTO order_items (id, "orderId", "variantId", quantity, "unitPrice", "unitCost") VALUES (${randomUUID()}, ${orderId}, ${p.variant}, 1, ${p.price}::numeric, ${(Number(p.price) * 0.4).toFixed(2)}::numeric)`;
  }
}
await prisma.$queryRawUnsafe(`SELECT analytics.refresh_range((now() AT TIME ZONE 'America/Sao_Paulo')::date - ${days}, (now() AT TIME ZONE 'America/Sao_Paulo')::date)`);
console.log(`${purchases.length} pedidos de teste criados. ${inserted} eventos de teste gravados (${days + 1} dias × ~${perDay} visitas) e resumos refeitos.`);
await prisma.$disconnect();
