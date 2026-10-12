import { Router } from "express";
import { z } from "zod";
import { parsePeriod } from "./reports.period.js";
import { customers, inventory, overview } from "./reports.service.js";

/** Indicadores de gestão (o `requireAdmin` vem do adminRouter). Datas no formato AAAA-MM-DD, horário de Brasília. */
export const reportsRouter = Router();

const periodQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  // recortes opcionais pelo nome (os mesmos nomes que aparecem nos rankings)
  classe: z.string().optional(),
  categoria: z.string().optional(),
  marca: z.string().optional(),
  publico: z.string().optional(),
  produto: z.string().optional(),
});

reportsRouter.get("/overview", async (req, res) => {
  const { from, to, classe, categoria, marca, publico, produto } = periodQuery.parse(req.query);
  res.json(await overview(parsePeriod(from, to), { className: classe, categoryName: categoria, brandName: marca, audienceName: publico, productName: produto }));
});

reportsRouter.get("/inventory", async (_req, res) => {
  res.json(await inventory());
});

reportsRouter.get("/customers", async (_req, res) => {
  res.json(await customers());
});
