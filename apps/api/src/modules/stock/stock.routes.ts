import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { adjustStock } from "./stock.service.js";

/** Rotas de estoque do admin (o `requireAdmin` vem do adminRouter). */
export const stockRouter = Router();

const adjustBody = z
  .object({ delta: z.coerce.number().int().optional(), set: z.coerce.number().int().min(0).optional(), note: z.string().trim().max(200).optional() })
  .refine((b) => (b.delta === undefined) !== (b.set === undefined), "Informe `delta` (somar/subtrair) ou `set` (definir o total)")
  .refine((b) => b.delta !== 0, "O ajuste não pode ser zero");

stockRouter.post("/:variantId/adjust", async (req, res) => {
  const { delta, set, note } = adjustBody.parse(req.body);
  res.json(await adjustStock(req.params.variantId, set !== undefined ? { set } : { delta: delta! }, note));
});

/** Histórico de movimentações (mais recentes primeiro), de uma variação ou de toda a loja. */
stockRouter.get("/movements", async (req, res) => {
  const { variantId, limit } = z.object({ variantId: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
  res.json(
    await prisma.stockMovement.findMany({
      where: variantId ? { variantId } : {},
      include: { variant: { select: { sku: true, color: true, size: true, product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
});
