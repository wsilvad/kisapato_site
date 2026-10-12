import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { active: true, OR: [{ classId: null }, { productClass: { active: true } }] },
    include: { productClass: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json(categories);
});

/** Classes (Calçados, Acessórios…) e públicos (Feminino, Masculino…) usados nos filtros da loja. */
export const classesRouter = Router();
classesRouter.get("/", async (_req, res) => {
  res.json(await prisma.productClass.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
});

export const audiencesRouter = Router();
audiencesRouter.get("/", async (_req, res) => {
  res.json(await prisma.audience.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
});

/** Marcas cadastradas, usadas no filtro da loja. */
export const brandsRouter = Router();
brandsRouter.get("/", async (_req, res) => {
  res.json(await prisma.brand.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }));
});
