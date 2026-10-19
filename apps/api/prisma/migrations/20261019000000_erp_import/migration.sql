-- Base da importação do ERP: só acrescenta colunas anuláveis (ou com padrão) e um índice único. Nada existente muda.
CREATE TYPE "SizeScheme" AS ENUM ('NUMERACAO', 'CONFECCAO');

ALTER TABLE "brands" ADD COLUMN "erpCode" TEXT;
CREATE UNIQUE INDEX "brands_erpCode_key" ON "brands"("erpCode");

ALTER TABLE "products" ADD COLUMN "sizeScheme" "SizeScheme" NOT NULL DEFAULT 'NUMERACAO',
ADD COLUMN "erpRef" TEXT,
ADD COLUMN "erpBrandCode" TEXT,
ADD COLUMN "erpSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "products_erpBrandCode_erpRef_key" ON "products"("erpBrandCode", "erpRef");

ALTER TABLE "product_colors" ADD COLUMN "erpItemCode" TEXT,
ADD COLUMN "costPrice" DECIMAL(10,2);
CREATE UNIQUE INDEX "product_colors_erpItemCode_key" ON "product_colors"("erpItemCode");

ALTER TABLE "product_variants" ADD COLUMN "erpSizeCode" TEXT,
ADD COLUMN "ean" TEXT;
