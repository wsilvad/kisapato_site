# Ki Sapato

E-commerce de calçados. Monorepo com npm workspaces.

| Pasta | O que é | Stack |
| --- | --- | --- |
| `apps/web` | Loja (frontend) | Next.js 16 (App Router), React 19, TypeScript |
| `apps/api` | API REST | Express 5, TypeScript, Zod, Prisma 7 |
| Banco | PostgreSQL hospedado na Discloud | Prisma |

## Primeiros passos

1. Crie o PostgreSQL pelo [template da Discloud](https://discloud.com/templates) e copie as credenciais do painel (usuário, senha, host, porta e nome do banco).
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
    prisma.config.ts   conexão do CLI (DIRECT_URL ou DATABASE_URL)
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

## Banco de dados (Discloud)

- `DATABASE_URL` (`postgresql://USUARIO:SENHA@HOST:PORTA/BANCO`) é usada pela API em runtime e, por padrão, pelo CLI do Prisma nas migrations. `DIRECT_URL` é opcional e, se definida, só o CLI a usa.
- Rodando a API na sua máquina, o acesso ao banco na Discloud é pelo túnel TCP da própria Discloud; use o host e a porta que ele informar (normalmente `localhost`). Rodando a API dentro da Discloud, use o host interno do painel.
- Se a Discloud exigir SSL, acrescente `?sslmode=require` à URL. Caracteres especiais na senha precisam ser codificados na URL (`@` vira `%40`).
- `Profile.id` é um UUID gerado pelo banco; a autenticação de clientes ainda será definida.

## Próximos passos sugeridos

Autenticação de clientes (login e middleware na API), carrinho, criação de pedidos, pagamento, painel admin e armazenamento das fotos dos produtos.
