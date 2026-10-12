-- Categorias, classes e marcas passam a poder ser desativadas (somem da loja com seus produtos).
ALTER TABLE "categories" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product_classes" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "brands" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
