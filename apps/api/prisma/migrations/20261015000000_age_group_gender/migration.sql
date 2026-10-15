-- Faixa etária e gênero passam a ser campos do produto (antes: vínculo com públicos).
CREATE TYPE "AgeGroup" AS ENUM ('ADULTO', 'INFANTIL');
CREATE TYPE "Gender" AS ENUM ('FEMININO', 'MASCULINO', 'UNISSEX');

ALTER TABLE "products"
  ADD COLUMN "ageGroup" "AgeGroup" NOT NULL DEFAULT 'ADULTO',
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNISSEX';
CREATE INDEX "products_ageGroup_gender_idx" ON "products"("ageGroup", "gender");

-- Públicos viram atalhos: cada um guarda a faixa e/ou o gênero que filtra.
ALTER TABLE "audiences"
  ADD COLUMN "ageGroup" "AgeGroup",
  ADD COLUMN "gender" "Gender";

-- Preenche a partir dos vínculos atuais (a tabela antiga continua até o deploy do novo código).
UPDATE "products" p SET "ageGroup" = 'INFANTIL'
WHERE EXISTS (SELECT 1 FROM "_AudienceToProduct" ap JOIN "audiences" a ON a.id = ap."A" WHERE ap."B" = p.id AND a.slug = 'infantil');

UPDATE "products" p SET "gender" = CASE
  WHEN f AND NOT m THEN 'FEMININO'::"Gender"
  WHEN m AND NOT f THEN 'MASCULINO'::"Gender"
  ELSE 'UNISSEX'::"Gender" END
FROM (
  SELECT ap."B" AS id, bool_or(a.slug = 'feminino') AS f, bool_or(a.slug = 'masculino') AS m
  FROM "_AudienceToProduct" ap JOIN "audiences" a ON a.id = ap."A" GROUP BY ap."B"
) links
WHERE links.id = p.id;

UPDATE "audiences" SET "ageGroup" = 'ADULTO', "gender" = 'FEMININO' WHERE slug = 'feminino';
UPDATE "audiences" SET "ageGroup" = 'ADULTO', "gender" = 'MASCULINO' WHERE slug = 'masculino';
UPDATE "audiences" SET "ageGroup" = 'INFANTIL' WHERE slug = 'infantil';
UPDATE "audiences" SET "gender" = 'UNISSEX' WHERE slug = 'unissex';
