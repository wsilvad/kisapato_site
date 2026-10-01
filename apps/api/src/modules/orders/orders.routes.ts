import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middlewares/auth.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const createOrderBody = z.object({
  items: z.array(z.object({ variantId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(20) })).min(1),
  shippingAddress: z.object({
    recipient: z.string().trim().min(1),
    zip: z.string().trim().min(8),
    street: z.string().trim().min(1),
    number: z.string().trim().min(1),
    complement: z.string().optional(),
    district: z.string().trim().min(1),
    city: z.string().trim().min(1),
    state: z.string().trim().length(2),
  }),
});

/** Checkout demonstrativo: valida estoque, baixa e grava o pedido como PENDING (sem pagamento real). */
ordersRouter.post("/", async (req, res) => {
  const { items, shippingAddress } = createOrderBody.parse(req.body);

  const order = await prisma.$transaction(async (tx) => {
    let total = 0;
    const lines: { variantId: string; quantity: number; unitPrice: string }[] = [];

    for (const { variantId, quantity } of items) {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
      if (!variant || !variant.product.active) throw new AppError("Produto indisponível", 409);
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (updated.count === 0) throw new AppError(`Sem estoque de ${variant.product.name} (${variant.color}, ${variant.size})`, 409);
      total += Number(variant.product.price) * quantity;
      lines.push({ variantId, quantity, unitPrice: variant.product.price.toString() });
    }

    return tx.order.create({
      data: {
        profileId: req.auth!.sub,
        total: total.toFixed(2),
        shippingAddress,
        items: { create: lines },
      },
      include: { items: true },
    });
  });

  res.status(201).json(order);
});

ordersRouter.get("/mine", async (req, res) => {
  res.json(
    await prisma.order.findMany({
      where: { profileId: req.auth!.sub },
      include: { items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  );
});
