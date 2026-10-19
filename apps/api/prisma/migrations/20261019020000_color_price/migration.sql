-- Preço por cor (item do ERP): colunas anuláveis; vazio continua valendo o preço do produto.
ALTER TABLE "product_colors" ADD COLUMN "price" DECIMAL(10,2),
ADD COLUMN "compareAtPrice" DECIMAL(10,2);
