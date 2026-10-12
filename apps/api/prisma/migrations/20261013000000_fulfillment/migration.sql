-- Nova situação entre "Pagamento aprovado" e "Pedido enviado".
ALTER TYPE "OrderStatus" ADD VALUE 'PICKING' AFTER 'PAID';

-- Rastreio e observação interna do pedido.
ALTER TABLE "orders" ADD COLUMN "carrier" TEXT,
ADD COLUMN "trackingCode" TEXT,
ADD COLUMN "trackingUrl" TEXT,
ADD COLUMN "internalNote" TEXT;

-- Conferência de cada item na separação.
ALTER TABLE "order_items" ADD COLUMN "picked" BOOLEAN NOT NULL DEFAULT false;

-- Histórico de situações.
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
