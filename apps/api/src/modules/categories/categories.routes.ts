import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { seloWhere, visibleProductWhere } from "../products/products.service.js";
import { ageGroupsOf, genderWhere, gendersOf } from "../products/segment.js";

export const categoriesRouter = Router();

/**
 * Categorias ativas; com `?selo=`, `?ageGroup=` e/ou `?gender=` só as que têm produtos visíveis naquela seleção
 * (menu da loja).
 */
categoriesRouter.get("/", async (req, res) => {
  const { selo, ageGroup, gender } = z
    .object({ selo: z.enum(["lancamento", "promocao", "destaque"]).optional(), ageGroup: z.string().optional(), gender: z.string().optional() })
    .parse(req.query);
  const ages = ageGroupsOf((ageGroup ?? "").split(","));
  const genders = gendersOf((gender ?? "").split(","));
  const conditions = [
    ...(selo ? [seloWhere(selo)] : []),
    ...(ages.length > 0 ? [{ ageGroup: { in: ages } }] : []),
    ...(genders.length > 0 ? [genderWhere(genders)] : []),
  ];
  const categories = await prisma.category.findMany({
    where: {
      active: true,
      OR: [{ classId: null }, { productClass: { active: true } }],
      ...(conditions.length > 0 && { products: { some: { AND: [visibleProductWhere, ...conditions] } } }),
    },
    include: { productClass: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json(categories);
});

/** Classes (Calçados, Acessórios…) e atalhos de público (Feminino, Infantil…) da loja. */
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
