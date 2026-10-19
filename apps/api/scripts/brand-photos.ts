/**
 * Traz as fotos das cores de um produto do site do fabricante (loja VTEX, pela API pública de catálogo) para as cores do
 * produto no nosso banco, até 4 por cor. A cor é ligada pelo nome (a palavra antes da "/" no nome do produto do fabricante).
 *   npm run photos:brand -w @ki-sapato/api -- --ref 58650400 --site https://www.luzdalua.com.br           (simulado)
 *   ... --apply                                                                                             (baixa e grava)
 * Cores sem correspondência ficam sem foto (e, por serem do ERP, ocultas na loja) e aparecem no relatório.
 */
import path from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { slugify } from "../src/modules/erp/mapping.js";
import { MAX_COLOR_PHOTOS } from "../src/modules/products/colors.js";
import { saveImage } from "../src/modules/uploads/image.js";

const args = process.argv.slice(2);
const value = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const ref = value("ref");
const site = (value("site") ?? "").replace(/\/+$/, "");
if (!ref || !/^https:\/\/[a-z0-9.-]+$/i.test(site)) {
  console.error("Uso: --ref <referência> --site https://www.exemplo.com.br [--apply]");
  process.exit(1);
}
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "uploads");

interface VtexProduct {
  productName: string;
  link: string;
  items?: { images?: { imageUrl: string }[] }[];
}
const res = await fetch(`${site}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(ref)}&_from=0&_to=49`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(40_000) });
if (!res.ok) throw new Error(`O site respondeu ${res.status}`);
const products = ((await res.json()) as VtexProduct[]).filter((p) => p.productName.includes(ref));
/** "Tênis Space Knit Trufa/gorgorão Trufa - 58650400" → "trufa" (a palavra que vem logo antes da barra). */
const leadColor = (name: string) => slugify(name.split("/")[0]!.trim().split(/\s+/).at(-1) ?? "");
const bySiteColor = new Map(products.map((p) => [leadColor(p.productName), p]));

const product = await prisma.product.findFirst({ where: { erpRef: ref }, include: { colors: { orderBy: { position: "asc" } } } });
if (!product) throw new Error(`Produto com referência ${ref} não encontrado no banco (importe do ERP antes).`);

console.log(`${products.length} produto(s) do fabricante para ${ref}: ${[...bySiteColor.keys()].join(", ")}\n`);
let saved = 0;
for (const color of product.colors) {
  const match = bySiteColor.get(slugify(color.name));
  const urls = (match?.items?.[0]?.images ?? []).map((i) => i.imageUrl).slice(0, MAX_COLOR_PHOTOS);
  if (!match || urls.length === 0) {
    console.log(`  ${color.name.padEnd(9)} sem correspondência no site do fabricante: fica sem fotos`);
    continue;
  }
  console.log(`  ${color.name.padEnd(9)} ← ${match.productName} (${urls.length} foto(s))`);
  if (!args.includes("--apply")) continue;
  const images: string[] = [];
  for (const url of urls) {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`Falha ao baixar ${url}: ${r.status}`);
    images.push(await saveImage(Buffer.from(await r.arrayBuffer()), uploadDir));
  }
  await prisma.productColor.update({ where: { id: color.id }, data: { images } });
  saved += images.length;
}
console.log(args.includes("--apply") ? `\nGravado: ${saved} foto(s).` : "\nModo simulado: nada foi baixado nem gravado. Use --apply.");
await prisma.$disconnect();
