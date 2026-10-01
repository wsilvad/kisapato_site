import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middlewares/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const slug = z.string().trim().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífen");
const money = z.coerce.number().nonnegative().transform((v) => v.toFixed(2));
const badge = z.enum(["LANCAMENTO", "PROMOCAO", "DESTAQUE"]);

/* Categorias */
const categoryBody = z.object({ name: z.string().trim().min(1), slug });

adminRouter.get("/categories", async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
});
adminRouter.post("/categories", async (req, res) => {
  res.status(201).json(await prisma.category.create({ data: categoryBody.parse(req.body) }));
});
adminRouter.put("/categories/:id", async (req, res) => {
  res.json(await prisma.category.update({ where: { id: req.params.id }, data: categoryBody.parse(req.body) }));
});
adminRouter.delete("/categories/:id", async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/* Produtos */
const variantBody = z.object({
  sku: z.string().trim().min(1),
  size: z.coerce.number().int().positive(),
  color: z.string().trim().min(1),
  stock: z.coerce.number().int().min(0),
});

const productBody = z.object({
  name: z.string().trim().min(1),
  slug,
  description: z.string().nullish(),
  careInstructions: z.string().nullish(),
  brand: z.string().nullish(),
  gender: z.string().nullish(),
  reference: z.string().nullish(),
  price: money,
  compareAtPrice: money.nullish(),
  badge: badge.nullish(),
  images: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  categoryId: z.string().min(1),
  variants: z.array(variantBody).default([]),
});

adminRouter.get("/products", async (_req, res) => {
  res.json(
    await prisma.product.findMany({
      include: { category: true, variants: true },
      orderBy: { createdAt: "desc" },
    }),
  );
});
adminRouter.post("/products", async (req, res) => {
  const { variants, ...data } = productBody.parse(req.body);
  res.status(201).json(
    await prisma.product.create({
      data: { ...data, variants: { create: variants } },
      include: { category: true, variants: true },
    }),
  );
});
/** Atualiza o produto e substitui o conjunto de variantes (numeração/cor/estoque). */
adminRouter.put("/products/:id", async (req, res) => {
  const { variants, ...data } = productBody.parse(req.body);
  const id = req.params.id;
  const [, product] = await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId: id, orderItems: { none: {} } } }),
    prisma.product.update({
      where: { id },
      data: {
        ...data,
        variants: {
          upsert: variants.map((v) => ({
            where: { productId_size_color: { productId: id, size: v.size, color: v.color } },
            update: { sku: v.sku, stock: v.stock },
            create: v,
          })),
        },
      },
      include: { category: true, variants: true },
    }),
  ]);
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
const campaignBody = z.object({
  eyebrow: z.string().nullish(),
  title: z.string().trim().min(1),
  body: z.string().nullish(),
  buttonLabel: z.string().nullish(),
  buttonUrl: z.string().nullish(),
  desktopImageUrl: z.string().nullish(),
  mobileImageUrl: z.string().nullish(),
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

/* Pedidos */
adminRouter.get("/orders", async (_req, res) => {
  res.json(
    await prisma.order.findMany({
      include: { profile: { select: { name: true, email: true } }, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  );
});
adminRouter.patch("/orders/:id/status", async (req, res) => {
  const { status } = z.object({ status: z.enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"]) }).parse(req.body);
  res.json(await prisma.order.update({ where: { id: req.params.id }, data: { status } }));
});
