-- Nome do produto como vem do ERP, separado do nome exibido no site. Só acrescenta uma coluna anulável.
ALTER TABLE "products" ADD COLUMN "erpName" TEXT;
