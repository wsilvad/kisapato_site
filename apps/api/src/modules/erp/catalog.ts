import type { Brand, Category, ProductClass } from "../../generated/prisma/client.js";
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

/**
 * Contexto de uma rodada de importação: o que foi criado e o que já foi encontrado. O banco fica longe (cada ida e volta
 * custa ~170 ms), então marcas, classes e categorias são lidas uma vez por rodada e reaproveitadas pelos produtos seguintes.
 */
export interface CatalogContext {
  created: CatalogCreated;
  brands: Map<string, Promise<Brand>>;
  categories: Map<string, Promise<Category>>;
  erpBrands?: Promise<{ code: string; name: string }[]>;
  allBrands?: Promise<Brand[]>;
  allClasses?: Promise<ProductClass[]>;
  allCategories?: Promise<Category[]>;
}
export const newCatalog = (): CatalogContext => ({ created: { brands: [], classes: [], categories: [] }, brands: new Map(), categories: new Map() });

const same = (a: string, b: string) => slugify(a) === slugify(b);

/** Uma criação de cadastro por vez: a importação roda produtos em paralelo e dois deles podem precisar da mesma marca ou categoria. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

async function uniqueSlug(name: string, taken: (slug: string) => boolean): Promise<string> {
  const base = slugify(name) || "item";
  let slug = base;
  for (let n = 2; taken(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Guarda a promessa no cache já na primeira chamada (dois produtos da mesma marca esperam a mesma busca); se falhar, sai do cache. */
function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let hit = map.get(key);
  if (!hit) {
    hit = load();
    map.set(key, hit);
    hit.catch(() => map.delete(key));
  }
  return hit;
}

/**
 * Marca do site para o código do ERP: pelo `erpCode` já gravado; na primeira vez, pelo nome (e então grava o código);
 * se não existir no site, cria com o nome do ERP em título (o nome pode ser ajustado depois no painel; o vínculo é o código).
 */
export function ensureBrand(brandCode: string, ctx: CatalogContext): Promise<Brand> {
  return cached(ctx.brands, brandCode, () =>
    serial(async () => {
      const brands = await (ctx.allBrands ??= prisma.brand.findMany());
      const linked = brands.find((b) => b.erpCode === brandCode);
      if (linked) return linked;
      const erpBrand = (await (ctx.erpBrands ??= getBrands())).find((b) => b.code === brandCode);
      if (!erpBrand) throw new AppError(`Marca ${brandCode} não existe no ERP.`, 404);
      const matches = brands.filter((b) => b.erpCode === null && same(b.name, erpBrand.name));
      if (matches.length > 1) throw new AppError(`Marca "${erpBrand.name}" (${brandCode}) tem mais de um cadastro no site: deixe só um antes de importar.`, 409);
      if (matches.length === 1) {
        const brand = await prisma.brand.update({ where: { id: matches[0]!.id }, data: { erpCode: brandCode } });
        brands.splice(brands.indexOf(matches[0]!), 1, brand);
        return brand;
      }
      const name = titleCase(erpBrand.name);
      const brand = await prisma.brand.create({ data: { name, slug: await uniqueSlug(name, (s) => brands.some((b) => b.slug === s)), erpCode: brandCode } });
      brands.push(brand);
      ctx.created.brands.push(name);
      return brand;
    }),
  );
}

/** Categoria do site pelo nome (sem diferenciar acento e maiúscula); se não existir, cria na classe indicada (e a classe, se também faltar). */
export function ensureCategory(name: string, className: string, ctx: CatalogContext): Promise<Category> {
  return cached(ctx.categories, slugify(name), () =>
    serial(async () => {
      const categories = await (ctx.allCategories ??= prisma.category.findMany());
      const found = categories.find((c) => same(c.name, name));
      if (found) return found;
      const classes = await (ctx.allClasses ??= prisma.productClass.findMany());
      let productClass = classes.find((c) => same(c.name, className));
      if (!productClass) {
        productClass = await prisma.productClass.create({ data: { name: className, slug: await uniqueSlug(className, (s) => classes.some((c) => c.slug === s)) } });
        classes.push(productClass);
        ctx.created.classes.push(className);
      }
      const category = await prisma.category.create({ data: { name, slug: await uniqueSlug(name, (s) => categories.some((c) => c.slug === s)), classId: productClass.id } });
      categories.push(category);
      ctx.created.categories.push(name);
      return category;
    }),
  );
}
