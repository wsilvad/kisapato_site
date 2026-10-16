import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { visibleProductWhere } from "../products/products.service.js";

export const homeRouter = Router();

/** Banners vigentes, vitrines já com os produtos selecionados pela regra (selo) e categorias em destaque. */
homeRouter.get("/", async (_req, res) => {
  const now = new Date();
  const [campaigns, showcases, categories, audiences, stories] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.showcase.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ where: { showOnHome: true, active: true, OR: [{ classId: null }, { productClass: { active: true } }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.audience.findMany({ where: { imageUrl: { not: null } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    // Os stories são um complemento: se a tabela ainda não existir (migração pendente), a home abre sem eles.
    prisma.story.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }).catch(() => []),
  ]);

  const withProducts = await Promise.all(
    showcases.map(async (showcase) => ({
      ...showcase,
      products: await prisma.product.findMany({
        where: { AND: [visibleProductWhere, { badge: showcase.selectionRule }] },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: showcase.itemLimit,
      }),
    })),
  );

  res.json({ campaigns, showcases: withProducts, categories, audiences, stories });
});
