# Ki Sapato

E-commerce de calçados. Monorepo npm workspaces: `apps/web` (Next.js 16, App Router) e `apps/api` (Express 5 + Prisma 7 sobre Supabase/Postgres). Conversa e textos de UI em pt-BR.

## Comandos

- `npm run dev` sobe API (:3333) e web (:3000)
- `npm run typecheck` / `npm run lint` / `npm run build`
- `npm run db:migrate -- --name <nome>`, `db:seed`, `db:studio`

## Convenções

- API: um módulo por domínio em `apps/api/src/modules/<nome>` (`*.routes.ts`, `*.service.ts`, `*.schemas.ts`). Validação com Zod; erros de negócio via `AppError`. ESM com NodeNext: imports relativos terminam em `.js`.
- Prisma 7: client gerado em `apps/api/src/generated/prisma` (não versionado) e usado com driver adapter (`src/lib/prisma.ts`). O CLI lê `DIRECT_URL` em `prisma.config.ts`; a API lê `DATABASE_URL` (pooler).
- Web: em Next 16 `params` e `searchParams` são `Promise`. Acesso à API só por `src/lib/api.ts`.
- Preços são `Decimal` no banco e chegam como `string` no JSON.
- A pasta está no iCloud Drive; o `node_modules` fica nela normalmente (autorizado pelo dono do projeto).
