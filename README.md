# Ki Sapato

E-commerce de calçados. Monorepo com npm workspaces.

| Pasta | O que é | Stack |
| --- | --- | --- |
| `apps/web` | Loja (frontend) | Next.js 16 (App Router), React 19, TypeScript |
| `apps/api` | API REST | Express 5, TypeScript, Zod, Prisma 7 |
| Banco | PostgreSQL gerenciado | Supabase + Prisma |

## Primeiros passos

1. Crie um projeto no [Supabase](https://supabase.com) e copie as strings de conexão (Project Settings > Database).
2. Configure as variáveis de ambiente:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Instale, gere o client do Prisma, rode a migration e o seed:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate -- --name init
   npm run db:seed
   ```

4. Suba API (`http://localhost:3333/api`) e web (`http://localhost:3000`):

   ```bash
   npm run dev
   ```

## Scripts (raiz)

| Comando | Ação |
| --- | --- |
| `npm run dev` | API e web juntos |
| `npm run build` | Build de produção da API e do web |
| `npm run typecheck` | Checagem de tipos nos dois apps |
| `npm run lint` | ESLint no web |
| `npm run db:migrate` / `db:deploy` | Migrations (dev / produção) |
| `npm run db:seed` | Popula categorias e produtos de exemplo |
| `npm run db:studio` | Prisma Studio |

## Estrutura

```
apps/
  api/
    prisma/            schema.prisma, seed.ts
    prisma.config.ts   conexão do CLI (DIRECT_URL)
    src/
      config/          validação de env (Zod)
      lib/             prisma client, AppError
      middlewares/     erros e 404
      modules/         health, categories, products (routes/service/schemas)
      routes/          agrega os módulos em /api
  web/
    src/
      app/             páginas: /, /produtos, /produtos/[slug]
      components/      Header, ProductCard
      lib/             cliente da API, formatadores
      types/           tipos compartilhados com a API
```

## Endpoints iniciais

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?page=1&pageSize=12&category=tenis&search=urbano`
- `GET /api/products/:slug`

## Supabase

- `DATABASE_URL` (pooler, porta 6543) é usada pela API em runtime; `DIRECT_URL` (porta 5432) é usada pelo CLI do Prisma nas migrations.
- `Profile.id` corresponde ao id de `auth.users` do Supabase Auth, pronto para o login ser plugado depois.

## Próximos passos sugeridos

Autenticação (Supabase Auth + middleware na API), carrinho, criação de pedidos, pagamento, painel admin e upload de imagens (Supabase Storage).
