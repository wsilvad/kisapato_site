-- CreateTable
CREATE TABLE "product_classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audiences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "audiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AudienceToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AudienceToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- AlterTable
ALTER TABLE "categories" ADD COLUMN "classId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "product_classes_slug_key" ON "product_classes"("slug");
CREATE UNIQUE INDEX "audiences_slug_key" ON "audiences"("slug");
CREATE INDEX "_AudienceToProduct_B_index" ON "_AudienceToProduct"("B");
CREATE INDEX "categories_classId_idx" ON "categories"("classId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_classId_fkey" FOREIGN KEY ("classId") REFERENCES "product_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_AudienceToProduct" ADD CONSTRAINT "_AudienceToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "audiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AudienceToProduct" ADD CONSTRAINT "_AudienceToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados iniciais: classes e públicos padrão da loja.
INSERT INTO "product_classes" ("id", "name", "slug", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Calçados', 'calcados', 0),
  (gen_random_uuid()::text, 'Acessórios', 'acessorios', 1);

INSERT INTO "audiences" ("id", "name", "slug", "sortOrder") VALUES
  (gen_random_uuid()::text, 'Feminino', 'feminino', 0),
  (gen_random_uuid()::text, 'Masculino', 'masculino', 1),
  (gen_random_uuid()::text, 'Infantil', 'infantil', 2),
  (gen_random_uuid()::text, 'Unissex', 'unissex', 3);

-- Todas as categorias existentes são de calçados.
UPDATE "categories" SET "classId" = (SELECT "id" FROM "product_classes" WHERE "slug" = 'calcados');

-- O campo de texto "gender" vira vínculo com Público (valores que não casarem com um público são ignorados).
INSERT INTO "_AudienceToProduct" ("A", "B")
SELECT a."id", p."id" FROM "products" p
JOIN "audiences" a ON lower(a."name") = lower(trim(p."gender"))
WHERE p."gender" IS NOT NULL;

ALTER TABLE "products" DROP COLUMN "gender";
