import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { seloWhere, visibleProductWhere } from "../products/products.service.js";

export const categoriesRouter = Router();

/** Categorias ativas; com `?selo=` e/ou `?audience=` só as que têm produtos visíveis naquela seleção (menu da loja). */
categoriesRouter.get("/", async (req, res) => {
  const { selo, audience } = z.object({ selo: z.enum(["lancamento", "promocao", "destaque"]).optional(), audience: z.string().optional() }).parse(req.query);
  const categories = await prisma.category.findMany({
    where: {
      active: true,
      OR: [{ classId: null }, { productClass: { active: true } }],
      ...((selo || audience) && {
        products: { some: { AND: [visibleProductWhere, ...(selo ? [seloWhere(selo)] : []), ...(audience ? [{ audiences: { some: { slug: audience } } }] : [])] } },
      }),
    },
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
