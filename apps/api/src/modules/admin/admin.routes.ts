import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAdmin, requirePanelPermission } from "../../middlewares/auth.js";
import { erpConfigured } from "../erp/client.js";
import { listIssues, refreshFromErp } from "../erp/sync.js";
import { getSiteSettings, saveSiteSettings } from "../settings/settings.service.js";
import { recordMovement } from "../stock/stock.service.js";
import { stockRouter } from "../stock/stock.routes.js";
import { reportsRouter } from "../reports/reports.routes.js";
import { fulfillmentRouter } from "../fulfillment/fulfillment.routes.js";
import { MAX_COLOR_PHOTOS } from "../products/colors.js";
import { genderWhere } from "../products/segment.js";
import { usersRouter } from "../users/users.routes.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin, requirePanelPermission);
adminRouter.use("/stock", stockRouter);
adminRouter.use("/reports", reportsRouter);
adminRouter.use("/orders", fulfillmentRouter);
adminRouter.use("/users", usersRouter);

const slug = z.string().trim().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífen");
const money = z.coerce.number().nonnegative().transform((v) => v.toFixed(2));
const badge = z.enum(["LANCAMENTO", "PROMOCAO", "DESTAQUE"]);

/** Ativar/desativar direto da tabela (sem reenviar o cadastro inteiro). Inativo some da loja com os produtos ligados. */
const activeBody = z.object({ active: z.boolean() });
adminRouter.patch("/categories/:id/active", async (req, res) => {
  res.json(await prisma.category.update({ where: { id: req.params.id }, data: activeBody.parse(req.body) }));
});
adminRouter.patch("/classes/:id/active", async (req, res) => {
  res.json(await prisma.productClass.update({ where: { id: req.params.id }, data: activeBody.parse(req.body) }));
});
adminRouter.patch("/brands/:id/active", async (req, res) => {
  res.json(await prisma.brand.update({ where: { id: req.params.id }, data: activeBody.parse(req.body) }));
});
adminRouter.patch("/products/:id/active", async (req, res) => {
  res.json(await prisma.product.update({ where: { id: req.params.id }, data: activeBody.parse(req.body) }));
});

/* Classes (Calçados, Acessórios…) */
const classBody = z.object({ name: z.string().trim().min(1), slug, sortOrder: z.coerce.number().int().default(0) });

adminRouter.get("/classes", async (_req, res) => {
  res.json(
    await prisma.productClass.findMany({
      include: { _count: { select: { categories: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  );
});
adminRouter.post("/classes", async (req, res) => {
  res.status(201).json(await prisma.productClass.create({ data: classBody.parse(req.body) }));
});
adminRouter.put("/classes/:id", async (req, res) => {
  res.json(await prisma.productClass.update({ where: { id: req.params.id }, data: classBody.parse(req.body) }));
});
adminRouter.delete("/classes/:id", async (req, res) => {
  const categories = await prisma.category.count({ where: { classId: req.params.id } });
  if (categories > 0) {
    throw new AppError(`Esta classe tem ${categories} categoria(s). Mova-as para outra classe antes de excluir.`, 409);
  }
  await prisma.productClass.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Públicos-alvo: atalhos (Feminino, Infantil, Menina…) que apontam para uma faixa etária e/ou um gênero. */
const audienceBody = classBody.extend({
  imageUrl: z.string().nullish(),
  ageGroup: z.enum(["ADULTO", "INFANTIL"]).nullish(),
  gender: z.enum(["FEMININO", "MASCULINO", "UNISSEX"]).nullish(),
});

/** Cada atalho vem com quantos produtos ativos ele traz, pela mesma regra da loja. */
adminRouter.get("/audiences", async (_req, res) => {
  const audiences = await prisma.audience.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const counts = await Promise.all(
    audiences.map((a) =>
      prisma.product.count({
        where: { active: true, ...(a.ageGroup && { ageGroup: a.ageGroup }), ...(a.gender && genderWhere([a.gender])) },
      }),
    ),
  );
  res.json(audiences.map((a, i) => ({ ...a, _count: { products: counts[i] } })));
});
adminRouter.post("/audiences", async (req, res) => {
  res.status(201).json(await prisma.audience.create({ data: audienceBody.parse(req.body) }));
});
adminRouter.put("/audiences/:id", async (req, res) => {
  res.json(await prisma.audience.update({ where: { id: req.params.id }, data: audienceBody.parse(req.body) }));
});
/** Excluir um atalho não mexe nos produtos. */
adminRouter.delete("/audiences/:id", async (req, res) => {
  await prisma.audience.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Marcas */
const brandBody = z.object({
  name: z.string().trim().min(1),
  /** Opcional: na criação é gerado a partir do nome; na edição o atual é mantido. */
  slug: slug.optional(),
  sortOrder: z.coerce.number().int().default(0),
});

adminRouter.get("/brands", async (_req, res) => {
  res.json(
    await prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  );
});
adminRouter.post("/brands", async (req, res) => {
  const { slug: given, ...data } = brandBody.parse(req.body);
  res.status(201).json(await prisma.brand.create({ data: { ...data, slug: given ?? (await uniqueBrandSlug(data.name)) } }));
});
adminRouter.put("/brands/:id", async (req, res) => {
  const { slug: given, ...data } = brandBody.parse(req.body);
  res.json(await prisma.brand.update({ where: { id: req.params.id }, data: { ...data, ...(given && { slug: given }) } }));
});
adminRouter.delete("/brands/:id", async (req, res) => {
  const products = await prisma.product.count({ where: { brandId: req.params.id } });
  if (products > 0) {
    throw new AppError(`Esta marca tem ${products} produto(s). Troque a marca deles antes de excluir.`, 409);
  }
  await prisma.brand.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Categorias */
const toSlug = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Slug a partir do nome; se `taken` disser que já existe, acrescenta -2, -3… */
async function uniqueSlug(name: string, fallback: string, taken: (slug: string) => Promise<boolean>) {
  const base = toSlug(name) || fallback;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}
const uniqueCategorySlug = (name: string) => uniqueSlug(name, "categoria", async (s) => !!(await prisma.category.findUnique({ where: { slug: s } })));
const uniqueBrandSlug = (name: string) => uniqueSlug(name, "marca", async (s) => !!(await prisma.brand.findUnique({ where: { slug: s } })));

const categoryBody = z.object({
  name: z.string().trim().min(1),
  /** Opcional: na criação é gerado a partir do nome; na edição o atual é mantido. */
  slug: slug.optional(),
  classId: z.string().min(1, "Escolha a classe da categoria"),
  imageUrl: z.string().nullish(),
  sortOrder: z.coerce.number().int().default(0),
  showOnHome: z.boolean().default(false),
});

adminRouter.get("/categories", async (_req, res) => {
  res.json(
    await prisma.category.findMany({
      include: { productClass: true, _count: { select: { products: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  );
});
adminRouter.post("/categories", async (req, res) => {
  const { slug: given, ...data } = categoryBody.parse(req.body);
  res.status(201).json(await prisma.category.create({ data: { ...data, slug: given ?? (await uniqueCategorySlug(data.name)) } }));
});
adminRouter.put("/categories/:id", async (req, res) => {
  const { slug: given, ...data } = categoryBody.parse(req.body);
  res.json(await prisma.category.update({ where: { id: req.params.id }, data: { ...data, ...(given && { slug: given }) } }));
});
adminRouter.delete("/categories/:id", async (req, res) => {
  const products = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (products > 0) {
    throw new AppError(`Esta categoria tem ${products} produto(s). Mova-os para outra categoria antes de excluir.`, 409);
  }
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Produtos */
const variantBody = z.object({
  /** Opcional: sem SKU, a API monta slug-cor-numeração. */
  sku: z.string().trim().optional(),
  /** Número da numeração (34…) ou posição da grade (Único = 0, P = 2…). */
  size: z.coerce.number().int().min(0),
  /** Rótulo da grade de confecção ("P", "Único"…); vazio na numeração. */
  sizeLabel: z.string().trim().max(20).nullish(),
  color: z.string().trim().min(1),
  stock: z.coerce.number().int().min(0),
});

const productBody = z.object({
  name: z.string().trim().min(1),
  slug,
  description: z.string().nullish(),
  careInstructions: z.string().nullish(),
  brandId: z.string().nullish(),
  reference: z.string().nullish(),
  price: money,
  compareAtPrice: money.nullish(),
  costPrice: money.nullish(),
  badge: badge.nullish(),
  images: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  categoryId: z.string().min(1),
  /** Como as numerações são lidas: NUMERACAO (34, 35…) ou CONFECCAO (P, M, G, Único…). */
  sizeScheme: z.enum(["NUMERACAO", "CONFECCAO"]).default("NUMERACAO"),
  ageGroup: z.enum(["ADULTO", "INFANTIL"]).default("ADULTO"),
  gender: z.enum(["FEMININO", "MASCULINO", "UNISSEX"]).default("UNISSEX"),
  variants: z.array(variantBody).default([]),
  /** Fotos de cada cor (até 4); a ordem da lista é a ordem das cores na loja, e a primeira abre a página do produto. */
  colors: z
    .array(z.object({ name: z.string().trim().min(1), price: money.nullish(), compareAtPrice: money.nullish(), images: z.array(z.string().min(1)).max(MAX_COLOR_PHOTOS, `Cada cor aceita no máximo ${MAX_COLOR_PHOTOS} fotos.`).default([]) }))
    .default([]),
});

const productInclude = { brand: true, category: { include: { productClass: true } }, variants: true, colors: { orderBy: { position: "asc" as const } } };

/** Só cores que existem nas numerações do produto entram, na ordem em que vieram (sem repetir o nome). */
function colorRows(colors: z.infer<typeof productBody>["colors"], variants: { color: string }[]) {
  const valid = new Set(variants.map((v) => v.color));
  const seen = new Set<string>();
  return colors
    .filter((c) => valid.has(c.name) && !seen.has(c.name) && seen.add(c.name))
    .map((c, position) => ({ name: c.name, position, images: c.images, price: c.price ?? null, compareAtPrice: c.price != null ? (c.compareAtPrice ?? null) : null }));
}
/** No admin o produto vem com o custo (omitido por padrão no cliente do Prisma). */
const withCost = { omit: { costPrice: false } } as const;

/** Preenche o SKU das variações que vieram sem um: slug do produto + cor + numeração. */
const withSkus = (productSlug: string, variants: z.infer<typeof variantBody>[]) =>
  variants.map((v) => ({ ...v, sku: v.sku || [productSlug, toSlug(v.color), v.size].join("-") }));

/** Botão "Atualizar do ERP": traz os itens marcados para o site (produtos novos entram desativados) e confere os já importados. */
adminRouter.post("/products/erp-refresh", async (_req, res) => {
  if (!erpConfigured()) throw new AppError("A integração com o ERP não está configurada neste servidor (falta ERP_URL).", 503);
  res.json(await refreshFromErp());
});

/** Pendências da importação do ERP (aviso "precisam da sua atenção" em Produtos). */
adminRouter.get("/products/erp-issues", async (_req, res) => {
  res.json(await listIssues());
});

adminRouter.get("/products", async (_req, res) => {
  res.json(
    await prisma.product.findMany({
      ...withCost,
      include: productInclude,
      orderBy: { createdAt: "desc" },
    }),
  );
});
adminRouter.get("/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    ...withCost,
    include: { ...productInclude, variants: { orderBy: [{ color: "asc" }, { size: "asc" }] } },
  });
  if (!product) throw new AppError("Produto não encontrado", 404);
  res.json(product);
});
adminRouter.post("/products", async (req, res) => {
  const { variants, colors, ...data } = productBody.parse(req.body);
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...data, variants: { create: withSkus(data.slug, variants) }, colors: { create: colorRows(colors, variants) } },
      ...withCost,
      include: productInclude,
    });
    for (const v of created.variants) {
      if (v.stock > 0) await recordMovement(tx, { variantId: v.id, type: "ADJUSTMENT", quantity: v.stock, balance: v.stock, note: "Estoque inicial" });
    }
    return created;
  });
  res.status(201).json(product);
});
/**
 * Atualiza o produto e sincroniza as variantes (numeração/cor/estoque): as que saíram da lista são
 * removidas, salvo as já vendidas, e as demais mantêm o id para não quebrar sacolas em aberto.
 */
adminRouter.put("/products/:id", async (req, res) => {
  const { variants: rawVariants, colors: rawColors, ...data } = productBody.parse(req.body);
  const variants = withSkus(data.slug, rawVariants);
  const colors = colorRows(rawColors, variants);
  const id = req.params.id;
  const kept = variants.map((v) => ({ size: v.size, color: v.color }));
  const product = await prisma.$transaction(async (tx) => {
    const before = await tx.productVariant.findMany({ where: { productId: id }, select: { size: true, color: true, stock: true } });
    await tx.productVariant.deleteMany({
      where: { productId: id, orderItems: { none: {} }, ...(kept.length > 0 && { NOT: { OR: kept } }) },
    });
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...data,
        variants: {
          upsert: variants.map((v) => ({
            where: { productId_size_color: { productId: id, size: v.size, color: v.color } },
            update: { sku: v.sku, stock: v.stock, sizeLabel: v.sizeLabel ?? null },
            create: v,
          })),
        },
        colors: {
          deleteMany: { name: { notIn: colors.map((c) => c.name) } },
          upsert: colors.map((c) => ({
            where: { productId_name: { productId: id, name: c.name } },
            update: { position: c.position, images: c.images, price: c.price, compareAtPrice: c.compareAtPrice },
            create: c,
          })),
        },
      },
      ...withCost,
      include: productInclude,
    });
    // Mudanças de estoque feitas pelo formulário entram no histórico como ajuste.
    const previous = new Map(before.map((v) => [`${v.size}|${v.color}`, v.stock]));
    for (const v of updated.variants) {
      const known = previous.get(`${v.size}|${v.color}`);
      const delta = v.stock - (known ?? 0);
      if (delta !== 0) await recordMovement(tx, { variantId: v.id, type: "ADJUSTMENT", quantity: delta, balance: v.stock, note: known === undefined ? "Estoque inicial" : "Edição do produto" });
    }
    return updated;
  });
  res.json(product);
});
adminRouter.delete("/products/:id", async (req, res) => {
  // Produtos já vendidos só são desativados, para preservar o histórico de pedidos.
  const sold = await prisma.orderItem.count({ where: { variant: { productId: req.params.id } } });
  if (sold > 0) {
    await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  } else {
    await prisma.product.delete({ where: { id: req.params.id } });
  }
  res.status(204).end();
});

/* Campanhas */
const date = z.coerce.date().nullish();
const focus = z.coerce.number().min(0).max(100).default(50);
const zoom = z.coerce.number().min(1).max(3).default(1);
const campaignBody = z.object({
  eyebrow: z.string().nullish(),
  title: z.string().trim().min(1),
  body: z.string().nullish(),
  buttonLabel: z.string().nullish(),
  buttonUrl: z.string().nullish(),
  desktopImageUrl: z.string().nullish(),
  mobileImageUrl: z.string().nullish(),
  desktopFocusX: focus,
  desktopFocusY: focus,
  desktopZoom: zoom,
  mobileFocusX: focus,
  mobileFocusY: focus,
  mobileZoom: zoom,
  startsAt: date,
  endsAt: date,
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

adminRouter.get("/campaigns", async (_req, res) => {
  res.json(await prisma.campaign.findMany({ orderBy: { sortOrder: "asc" } }));
});
adminRouter.post("/campaigns", async (req, res) => {
  res.status(201).json(await prisma.campaign.create({ data: campaignBody.parse(req.body) }));
});
adminRouter.put("/campaigns/:id", async (req, res) => {
  res.json(await prisma.campaign.update({ where: { id: req.params.id }, data: campaignBody.parse(req.body) }));
});
adminRouter.delete("/campaigns/:id", async (req, res) => {
  await prisma.campaign.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Stories da home (cartões verticais com GIF) */
const storyBody = z.object({
  title: z.string().trim().max(60).nullish().transform((v) => v || null),
  mediaUrl: z.string().trim().min(1, "Envie o vídeo, o GIF ou a foto do cartão"),
  linkUrl: z.string().trim().max(300).nullish().transform((v) => v || null),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

adminRouter.get("/stories", async (_req, res) => {
  res.json(await prisma.story.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }));
});
adminRouter.post("/stories", async (req, res) => {
  res.status(201).json(await prisma.story.create({ data: storyBody.parse(req.body) }));
});
adminRouter.put("/stories/:id", async (req, res) => {
  res.json(await prisma.story.update({ where: { id: req.params.id }, data: storyBody.parse(req.body) }));
});
adminRouter.patch("/stories/:id/active", async (req, res) => {
  res.json(await prisma.story.update({ where: { id: req.params.id }, data: activeBody.parse(req.body) }));
});
adminRouter.delete("/stories/:id", async (req, res) => {
  await prisma.story.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Vitrines */
const showcaseBody = z.object({
  title: z.string().trim().min(1),
  selectionRule: badge.default("DESTAQUE"),
  itemLimit: z.coerce.number().int().min(1).max(24).default(4),
  sortOrder: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

adminRouter.get("/showcases", async (_req, res) => {
  res.json(await prisma.showcase.findMany({ orderBy: { sortOrder: "asc" } }));
});
adminRouter.post("/showcases", async (req, res) => {
  res.status(201).json(await prisma.showcase.create({ data: showcaseBody.parse(req.body) }));
});
adminRouter.put("/showcases/:id", async (req, res) => {
  res.json(await prisma.showcase.update({ where: { id: req.params.id }, data: showcaseBody.parse(req.body) }));
});
adminRouter.delete("/showcases/:id", async (req, res) => {
  await prisma.showcase.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Pedidos e expedição: modules/fulfillment */

/* Conteúdo do site (topo, menu, faixa promocional, benefícios, rodapé) */
adminRouter.get("/settings", async (_req, res) => {
  res.json(await getSiteSettings());
});
adminRouter.put("/settings", async (req, res) => {
  res.json(await saveSiteSettings(req.body));
});

/* Páginas do site (permissão "paginas"): lista e edição de título/texto de uma página existente; não cria nem exclui. */
adminRouter.get("/pages", async (_req, res) => {
  res.json((await getSiteSettings()).pages);
});
adminRouter.put("/pages/:slug", async (req, res) => {
  const body = z.object({ title: z.string().trim().min(1).max(80), body: z.string().max(20000) }).parse(req.body);
  const settings = await getSiteSettings();
  if (!settings.pages.some((p) => p.slug === req.params.slug)) throw new AppError("Página não encontrada", 404);
  const saved = await saveSiteSettings({ ...settings, pages: settings.pages.map((p) => (p.slug === req.params.slug ? { ...p, ...body } : p)) });
  res.json(saved.pages.find((p) => p.slug === req.params.slug));
});

/* Resumo do painel */
const LOW_STOCK = 3;
adminRouter.get("/stats", async (_req, res) => {
  const now = new Date();
  const [activeProducts, inactiveProducts, lowStock, categories, campaigns, showcases, ordersByStatus] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: false } }),
    prisma.productVariant.count({ where: { stock: { lte: LOW_STOCK }, product: { active: true } } }),
    prisma.category.count(),
    prisma.campaign.count({
      where: {
        active: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    }),
    prisma.showcase.count({ where: { active: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  res.json({
    products: { active: activeProducts, inactive: inactiveProducts, lowStock, lowStockThreshold: LOW_STOCK },
    categories,
    campaigns,
    showcases,
    orders: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count._all])),
  });
});
