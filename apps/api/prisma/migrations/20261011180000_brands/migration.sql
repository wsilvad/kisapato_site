-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "brandId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O texto livre "brand" vira cadastro: uma marca para cada nome distinto (sem diferenciar maiúsculas).
INSERT INTO "brands" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, b."name", b."slug", (row_number() OVER (ORDER BY b."name") - 1)::int
FROM (
  SELECT DISTINCT ON (lower(trim("brand")))
         trim("brand") AS "name",
         btrim(regexp_replace(lower(translate(trim("brand"), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'), '-') AS "slug"
  FROM "products"
  WHERE "brand" IS NOT NULL AND trim("brand") <> ''
  ORDER BY lower(trim("brand")), trim("brand")
) b;

UPDATE "products" p SET "brandId" = b."id"
FROM "brands" b
WHERE p."brand" IS NOT NULL AND lower(trim(p."brand")) = lower(b."name");

ALTER TABLE "products" DROP COLUMN "brand";
