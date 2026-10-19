-- Permissões por usuário do painel. Os administradores que já existem ficam com acesso total ("*").
ALTER TABLE "profiles" ADD COLUMN "adminPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "profiles" SET "adminPermissions" = ARRAY['*'] WHERE "role" = 'ADMIN';
