import type { Order } from "@/types/product";

export type OrderStatus = Order["status"];

/** Nomes das situações, iguais em todo o painel e na conta do cliente. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "ok" | "warn" | "off" | "muted" }> = {
  PENDING: { label: "Em processamento", tone: "warn" },
  PAID: { label: "Pagamento aprovado", tone: "ok" },
  PICKING: { label: "Em separação", tone: "ok" },
  SHIPPED: { label: "Pedido enviado", tone: "ok" },
  DELIVERED: { label: "Pedido entregue", tone: "muted" },
  CANCELED: { label: "Cancelado", tone: "off" },
};

/** Ordem natural do pedido, do recebimento à entrega. */
export const FLOW: OrderStatus[] = ["PENDING", "PAID", "PICKING", "SHIPPED", "DELIVERED"];
export const ALL_STATUSES: OrderStatus[] = [...FLOW, "CANCELED"];

/** Próximo passo da expedição e o texto do botão que o executa. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  PENDING: { to: "PAID", label: "Aprovar pagamento" },
  PAID: { to: "PICKING", label: "Iniciar separação" },
  PICKING: { to: "SHIPPED", label: "Marcar como enviado" },
  SHIPPED: { to: "DELIVERED", label: "Marcar como entregue" },
};

/** Pedido com pagamento aprovado: conta como venda (e já está comprometido com o estoque). */
export const REALIZED_STATUSES: OrderStatus[] = ["PAID", "PICKING", "SHIPPED", "DELIVERED"];

/**
 * Transportadoras de uso comum. O link é a página OFICIAL de rastreio da transportadora (o cliente digita ou
 * cola o código lá); quem tiver um link direto para o objeto pode colá-lo no campo, que continua editável.
 */
export const CARRIERS: { name: string; url: string }[] = [
  { name: "Correios", url: "https://www.correios.com.br/rastreamento" },
  { name: "Jadlog", url: "https://www.jadlog.com.br/tracking" },
  { name: "Loggi", url: "" },
  { name: "Azul Cargo", url: "" },
  { name: "Entrega própria / motoboy", url: "" },
  { name: "Outra", url: "" },
];

/** Só links http(s) viram link clicável (o campo é digitado por pessoas). */
export const safeUrl = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);
