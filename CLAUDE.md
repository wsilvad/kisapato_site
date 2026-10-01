# Ki Sapato — guia para o Claude

E-commerce de calçados. Idioma: português (pt-BR). Monorepo npm workspaces.

## Estrutura
- `apps/web` — Next.js (App Router) com o layout do protótipo; consome a API. Sessão e sacola no navegador (`src/lib/session.tsx`, `src/lib/cart.tsx`).
- `apps/api` — Express + TypeScript + Prisma (PostgreSQL). Módulos em `src/modules/<nome>`: auth (JWT + bcrypt), products, categories, home, orders (checkout demonstrativo), admin (CRUD), uploads (fotos em disco).
- Banco: PostgreSQL hospedado na Discloud. Migrations em `apps/api/prisma/migrations`.

## Comandos
- `npm run dev` (api + web), `npm run typecheck`, `npm run lint`.
- `npm run db:migrate` (dev), `npm run db:deploy` (produção), `npm run db:seed`.

## Regras
- Nunca digitar senhas/segredos em `.env`: o usuário preenche. `.env` não é versionado.
- Admin inicial vem do seed com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
- Fotos de produtos ficam em `UPLOAD_DIR` (servidas em `/uploads`); em produção use um diretório persistente e faça backup junto do `pg_dump`.
- Deploy: dois apps na Discloud, `apps/api/discloud.config` (`kisapato-api`) e `apps/web/discloud.config` (`kisapato`). O web precisa de `NEXT_PUBLIC_API_URL` na hora do build.
- Git: push só na branch `pre-prod`, com mensagem de commit completa. Sem commit/push sem o usuário pedir.
- O front gerado no Lovable (TanStack Start + Supabase) foi abandonado; está no histórico (`e142b26`) só como referência.
