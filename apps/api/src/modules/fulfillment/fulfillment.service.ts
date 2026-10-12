import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { restockOrder } from "../stock/stock.service.js";

type Tx = Prisma.TransactionClient;

export const STATUSES = ["PENDING", "PAID", "PICKING", "SHIPPED", "DELIVERED", "CANCELED"] as const;
export type Status = (typeof STATUSES)[number];

/** Pedido cancelado não pode ser reaberto (o estoque já voltou); as demais situações podem ser corrigidas em qualquer direção. */
export function assertTransition(from: Status, to: Status) {
  if (from === "CANCELED" && to !== "CANCELED") throw new AppError("Pedido cancelado não pode ser reaberto", 409);
}

export interface TrackingInput {
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
}

/** Texto vazio limpa o campo (null); `undefined` mantém o que já existe. */
export const trackingData = (t: TrackingInput) => ({
  ...(t.carrier !== undefined && { carrier: t.carrier || null }),
  ...(t.trackingCode !== undefined && { trackingCode: t.trackingCode || null }),
  ...(t.trackingUrl !== undefined && { trackingUrl: t.trackingUrl || null }),
});

/** O que o painel de expedição precisa de cada pedido. A observação interna só sai aqui, nunca para o cliente. */
export const orderForFulfillment = {
  omit: { internalNote: false },
  include: {
    profile: { select: { name: true, email: true, phone: true } },
    items: { orderBy: { id: "asc" as const }, include: { variant: { include: { product: true } } } },
    events: { orderBy: { createdAt: "asc" as const } },
  },
} satisfies Prisma.OrderDefaultArgs;

/** Muda a situação, registra no histórico e, ao cancelar, devolve os itens ao estoque. */
export async function changeStatus(tx: Tx, orderId: string, status: Status, opts: { note?: string; tracking?: TrackingInput } = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Pedido não encontrado", 404);
  assertTransition(order.status, status);

  if (order.status !== status) {
    if (status === "CANCELED") await restockOrder(tx, order.id);
    await tx.orderEvent.create({ data: { orderId, status, note: opts.note || null } });
  }
  return tx.order.update({
    where: { id: orderId },
    data: { status, ...trackingData(opts.tracking ?? {}) },
    ...orderForFulfillment,
  });
}
