import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { STATUSES, changeStatus, orderForFulfillment, trackingData } from "./fulfillment.service.js";

/** Pedidos e expedição do painel (o `requireAdmin` vem do adminRouter). */
export const fulfillmentRouter = Router();

const link = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "O link deve começar com http:// ou https://");
const tracking = {
  carrier: z.string().trim().max(60).optional(),
  trackingCode: z.string().trim().max(60).optional(),
  trackingUrl: link.optional(),
};

fulfillmentRouter.get("/", async (_req, res) => {
  res.json(await prisma.order.findMany({ ...orderForFulfillment, orderBy: { createdAt: "asc" } }));
});

export const statusBody = z.object({ status: z.enum(STATUSES), note: z.string().trim().max(300).optional(), ...tracking });
fulfillmentRouter.patch("/:id/status", async (req, res) => {
  const { status, note, ...rest } = statusBody.parse(req.body);
  res.json(await prisma.$transaction((tx) => changeStatus(tx, req.params.id, status, { note, tracking: rest })));
});

/** Corrige transportadora, código ou link depois de enviado; o ajuste entra no histórico. */
fulfillmentRouter.patch("/:id/tracking", async (req, res) => {
  const body = z.object(tracking).parse(req.body);
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: req.params.id } });
    if (!current) throw new AppError("Pedido não encontrado", 404);
    await tx.orderEvent.create({ data: { orderId: current.id, status: current.status, note: "Rastreio atualizado" } });
    return tx.order.update({ where: { id: current.id }, data: trackingData(body), ...orderForFulfillment });
  });
  res.json(order);
});

fulfillmentRouter.patch("/:id/note", async (req, res) => {
  const { internalNote } = z.object({ internalNote: z.string().trim().max(1000) }).parse(req.body);
  res.json(await prisma.order.update({ where: { id: req.params.id }, data: { internalNote: internalNote || null }, ...orderForFulfillment }));
});

/** Marca o item como conferido na separação do estoque. */
fulfillmentRouter.patch("/:id/items/:itemId/picked", async (req, res) => {
  const { picked } = z.object({ picked: z.boolean() }).parse(req.body);
  const { count } = await prisma.orderItem.updateMany({ where: { id: req.params.itemId, orderId: req.params.id }, data: { picked } });
  if (count === 0) throw new AppError("Item não encontrado neste pedido", 404);
  res.json({ id: req.params.itemId, picked });
});
