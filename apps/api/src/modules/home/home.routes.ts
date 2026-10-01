import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const homeRouter = Router();

/** Banners vigentes + vitrines já com os produtos selecionados pela regra (selo). */
homeRouter.get("/", async (_req, res) => {
  const now = new Date();
  const [campaigns, showcases] = await Promise.all([
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
  ]);

  const withProducts = await Promise.all(
    showcases.map(async (showcase) => ({
      ...showcase,
      products: await prisma.product.findMany({
        where: { active: true, badge: showcase.selectionRule },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: showcase.itemLimit,
      }),
    })),
  );

  res.json({ campaigns, showcases: withProducts });
});
