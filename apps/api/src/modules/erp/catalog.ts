import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getBrands } from "./client.js";
import { slugify, titleCase } from "./mapping.js";

/** Cadastros do site (marca, classe, categoria) que a importação precisou criar, para mostrar no resumo do painel. */
export interface CatalogCreated {
  brands: string[];
  classes: string[];
  categories: string[];
}
export const emptyCreated = (): CatalogCreated => ({ brands: [], classes: [], categories: [] });

const same = (a: string, b: string) => slugify(a) === slugify(b);

/** Uma criação de cadastro por vez: a importação roda produtos em paralelo e dois deles podem precisar da mesma marca ou categoria. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

async function uniqueSlug(name: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(name) || "item";
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * Marca do site para o código do ERP: pelo `erpCode` já gravado; na primeira vez, pelo nome (e então grava o código);
 * se não existir no site, cria com o nome do ERP em título (o nome pode ser ajustado depois no painel; o vínculo é o código).
 */
export function ensureBrand(brandCode: string, created: CatalogCreated) {
  return serial(async () => {
    const linked = await prisma.brand.findUnique({ where: { erpCode: brandCode } });
    if (linked) return linked;
    const erpBrand = (await getBrands()).find((b) => b.code === brandCode);
    if (!erpBrand) throw new AppError(`Marca ${brandCode} não existe no ERP.`, 404);
    const matches = (await prisma.brand.findMany({ where: { erpCode: null } })).filter((b) => same(b.name, erpBrand.name));
    if (matches.length > 1) throw new AppError(`Marca "${erpBrand.name}" (${brandCode}) tem mais de um cadastro no site: deixe só um antes de importar.`, 409);
    if (matches.length === 1) return prisma.brand.update({ where: { id: matches[0]!.id }, data: { erpCode: brandCode } });
    const name = titleCase(erpBrand.name);
    const brand = await prisma.brand.create({ data: { name, slug: await uniqueSlug(name, async (s) => !!(await prisma.brand.findUnique({ where: { slug: s } }))), erpCode: brandCode } });
    created.brands.push(name);
    return brand;
  });
}

async function classByName(name: string, created: CatalogCreated) {
  const found = (await prisma.productClass.findMany()).find((c) => same(c.name, name));
  if (found) return found;
  const productClass = await prisma.productClass.create({ data: { name, slug: await uniqueSlug(name, async (s) => !!(await prisma.productClass.findUnique({ where: { slug: s } }))) } });
  created.classes.push(name);
  return productClass;
}

/** Categoria do site pelo nome (sem diferenciar acento e maiúscula); se não existir, cria na classe indicada (e a classe, se também faltar). */
export function ensureCategory(name: string, className: string, created: CatalogCreated) {
  return serial(async () => {
    const found = (await prisma.category.findMany()).find((c) => same(c.name, name));
    if (found) return found;
    const productClass = await classByName(className, created);
    const category = await prisma.category.create({
      data: { name, slug: await uniqueSlug(name, async (s) => !!(await prisma.category.findUnique({ where: { slug: s } }))), classId: productClass.id },
    });
    created.categories.push(name);
    return category;
  });
}
