/**
 * Acrescenta à configuração JÁ SALVA do site as páginas institucionais novas e os menus do rodapé "Ajuda" e "Institucional"
 * (os padrões do código só valem enquanto nada foi salvo no painel). Não mexe em páginas que já existem, nem no resto
 * (topo, menu, frete, redes sociais…). Guarda uma cópia do valor anterior para desfazer.
 *   npm run site:menus -w @ki-sapato/api -- --backup /caminho/backup.json            (simulado)
 *   ... --backup /caminho/backup.json --apply                                          (grava)
 */
import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma.js";
import { SETTINGS_KEY, defaultPages, defaultSiteSettings, siteSettingsSchema } from "../src/modules/settings/settings.schemas.js";

const args = process.argv.slice(2);
const backup = args.includes("--backup") ? args[args.indexOf("--backup") + 1] : undefined;
const row = await prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
if (!row) {
  console.log("Nada salvo no banco: os padrões do código já valem. Nada a fazer.");
  process.exit(0);
}
const current = siteSettingsSchema.parse(row.value);

const known = new Set(current.pages.map((p) => p.slug));
const added = defaultPages.filter((p) => !known.has(p.slug));
const next = {
  ...current,
  pages: [...current.pages, ...added],
  footer: { ...current.footer, columns: defaultSiteSettings.footer.columns },
};
const parsed = siteSettingsSchema.parse(next);

console.log(`Páginas novas (${added.length}): ${added.map((p) => p.slug).join(", ") || "nenhuma"}`);
console.log(`Páginas que já existiam e ficam como estão: ${current.pages.map((p) => p.slug).join(", ")}`);
console.log("Menus do rodapé depois:");
for (const c of parsed.footer.columns) console.log(`  ${c.title}: ${c.links.map((l) => l.label).join(" | ")}`);

if (!args.includes("--apply")) {
  console.log("\nModo simulado: nada foi gravado. Use --backup <arquivo> --apply.");
  process.exit(0);
}
if (!backup) throw new Error("Informe --backup <arquivo> para guardar o valor anterior antes de gravar.");
await writeFile(backup, JSON.stringify(row.value, null, 2));
await prisma.siteSetting.update({ where: { key: SETTINGS_KEY }, data: { value: parsed } });
console.log(`\nGravado. Cópia do valor anterior em ${backup}.`);
await prisma.$disconnect();
