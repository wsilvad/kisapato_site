import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

type Tx = Prisma.TransactionClient;
type MovementType = "SALE" | "CANCELLATION" | "ADJUSTMENT";

/** Grava uma entrada/saída no histórico; `balance` é o estoque da variação depois dela. */
export function recordMovement(tx: Tx, data: { variantId: string; type: MovementType; quantity: number; balance: number; note?: string | null; orderId?: string | null }) {
  return tx.stockMovement.create({ data: { ...data, note: data.note ?? null, orderId: data.orderId ?? null } });
}

/** Aplica um ajuste dentro de uma transação já aberta: `delta` soma ou subtrai, `set` define o total. */
export async function applyAdjustment(tx: Tx, variantId: string, change: { delta: number } | { set: number }, note?: string) {
  const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new AppError("Variação não encontrada", 404);
  const next = "set" in change ? change.set : variant.stock + change.delta;
  if (next < 0) throw new AppError(`O estoque não pode ficar negativo (atual: ${variant.stock})`, 409);
  const quantity = next - variant.stock;
  if (quantity === 0) return variant;
  const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stock: next } });
  await recordMovement(tx, { variantId, type: "ADJUSTMENT", quantity, balance: next, note });
  return updated;
}

/** Ajuste manual de estoque (contagem, perda, entrada de mercadoria). */
export const adjustStock = (variantId: string, change: { delta: number } | { set: number }, note?: string) =>
  prisma.$transaction((tx) => applyAdjustment(tx, variantId, change, note));

/** Devolve ao estoque os itens de um pedido cancelado. */
export async function restockOrder(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const variant = await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    await recordMovement(tx, { variantId: item.variantId, type: "CANCELLATION", quantity: item.quantity, balance: variant.stock, orderId, note: "Pedido cancelado" });
  }
}
