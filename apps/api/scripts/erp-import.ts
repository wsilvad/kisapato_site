/**
 * Importa um produto do ERP pela referência do fornecedor (todas as cores dele), em modo simulado por padrão.
 *   ERP_URL=http://host:porta/ControleWS/ControleWS npm run erp:import -w @ki-sapato/api -- --ref 58650400
 *   ... --ref 58650400 --apply        grava no banco (produto novo nasce inativo)
 *   ... --items 1.700,1.701           usa estes itens em vez de varrer os códigos do ERP
 * Só lê do ERP; nada é gravado nele.
 */
import { findItems, getBrands, getItem, getStock } from "../src/modules/erp/client.js";
import { applyPlan } from "../src/modules/erp/import.js";
import { buildPlan, titleCase } from "../src/modules/erp/mapping.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const ref = value("ref");
const itemCodes = value("items")?.split(",").map((c) => c.trim()).filter(Boolean);
if (!ref && !itemCodes) {
  console.error("Informe --ref <referência do fornecedor> (ou --items 1.700,1.701).");
  process.exit(1);
}

const items = itemCodes
  ? (await Promise.all(itemCodes.map((c) => getItem(c)))).filter((i) => i !== null)
  : await findItems((i) => i.supplierRef.toUpperCase() === ref!.toUpperCase());
if (items.length === 0) {
  console.error(`Nenhum item do ERP com a referência ${ref}.`);
  process.exit(1);
}
const brands = new Set(items.map((i) => i.brandCode));
if (brands.size > 1) {
  console.error(`A referência ${ref} aparece em mais de uma marca (${[...brands].join(", ")}). Informe --items com os itens da marca certa.`);
  process.exit(1);
}

const erpBrand = (await getBrands()).find((b) => b.code === items[0]!.brandCode);
const plan = buildPlan(await Promise.all(items.map(async (item) => ({ item, stock: await getStock(item.pkItem) }))), { brandName: erpBrand ? titleCase(erpBrand.name) : undefined });
const p = plan.product;
console.log(`\nProduto: ${p.name}  (ref ${p.reference}, marca ERP ${plan.key.brandCode})`);
console.log(`  nome no ERP: ${p.erpName}`);
console.log(`  slug ${p.slug} | categoria ${p.category ?? "?"} | ${p.ageGroup ?? "?"}/${p.gender ?? "?"} | grade ${p.sizeScheme ?? "?"}`);
console.log(`  preço R$ ${p.price.toFixed(2)}${p.compareAtPrice ? ` (de ${p.compareAtPrice.toFixed(2)})` : ""} | custo R$ ${p.costPrice.toFixed(2)} | nasce INATIVO`);
console.log(`\nCores (${plan.colors.length}), na ordem do código do item:`);
for (const c of plan.colors) {
  const sizes = c.sizes.map((s) => `${s.label}:${s.stock}${s.erpStock < 0 ? "*" : ""}`).join(" ");
  console.log(`  ${c.position + 1}. ${c.name.padEnd(9)} item ${c.erpItemCode.padEnd(7)} ${c.flagged ? "marcada " : "sem marca"} R$ ${c.price.toFixed(2).padStart(7)} | estoque ${String(c.totalStock).padStart(2)} | ${sizes}`);
}
console.log("  (* saldo negativo no ERP, entra como 0)");
if (plan.warnings.length) console.log(`\nAvisos:\n${plan.warnings.map((w) => `  - ${w}`).join("\n")}`);
if (plan.errors.length) console.log(`\nERROS (impedem gravar):\n${plan.errors.map((w) => `  - ${w}`).join("\n")}`);

if (!flag("apply")) {
  console.log("\nModo simulado: nada foi gravado. Use --apply para gravar.");
  process.exit(plan.errors.length ? 2 : 0);
}
const result = await applyPlan(plan);
console.log(`\nGravado: produto ${result.created ? "criado" : "atualizado"} (${result.productId}); cores +${result.colors.created}/~${result.colors.updated}; numerações +${result.variants.created}/~${result.variants.updated}; movimentos de estoque ${result.variants.stockChanges}.`);
process.exit(0);
