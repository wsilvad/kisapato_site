# Memória do projeto — Ki Sapato Chic

Última consolidação: 01/10/2026 (America/Sao_Paulo).

## Contexto do negócio

- E-commerce da Ki Sapato, loja de calçados, bolsas e acessórios femininos, masculinos e infantis de Santo Antônio da Patrulha/RS.
- Idioma da interface, documentação e comunicação com o proprietário: português do Brasil.
- Referências visuais informadas: Luz da Lua, TF e Studio M Shop.
- O visual é editorial e elegante: fundo creme, preto como cor principal, tipografia Jost no texto e Cormorant Garamond em títulos, cantos retos e fotografias de moda em destaque.

## Estado atual e origem

- Repositório de trabalho/destino: `git@github.com:wsilvad/kisapato_site.git`.
- Branch de desenvolvimento e pré-produção: `pre-prod`. Nunca enviar alterações diretamente para `main`.
- O projeto atual foi copiado integralmente de `wsilvad/patrulha-style-emporium`, branch `main`, commit `0517206aee74d55d0bfd2bf99c9da8df0fb27903`.
- A cópia fiel foi publicada inicialmente no commit `65ea3223ab0c794e967d3fa218d085bc4ee088f8`, com árvore idêntica à origem: `250fc03648b64acaf8e9c2775b62e9e745749c35` (110 arquivos).
- O merge `785bbbf1041197a333b8dd63b09bcc1becc48510` reintroduziu acidentalmente o monorepo antigo e fez a Discloud tentar compilar Prisma.
- O estado correto foi restaurado e preparado para a Discloud no commit `1c20be0fcb7a86c06b5e3a4d6a4fb949495d2157`.
- A primeira correção foi promovida para `main` pelo PR #3, no merge `85aa4d981681f8d92e6651eff05b5bbe6d24e483`.
- A primeira tentativa de corrigir a falha de runtime da Discloud ao carregar a pasta oculta `.output` foi publicada no commit `3434a545fd12bf0b67aeff2dc12eb1e7b01767dc`.
- Essa correção foi promovida para `main` pelo PR #4; o merge de produção atual é `d0bfa275ebd4ccbc653f56b02ecfc2c6f54ce7b7`.
- A Discloud também não promoveu a pasta `build/`. A correção revisada usa a saída automática reservada `dist/` e aceita os layouts `server/index.mjs` e `dist/server/index.mjs` no commit `65789e31bc7c3ee00259ee75870d5e5b455c4d69`.
- O endereço público correto informado pelo proprietário é `https://kisapato.discloud.dev`. O `discloud.config` usa `ID=kisapato`, documentado e publicado no commit `e142b269ee35029a88a9438f7af4bfbb5b0da139`, atual HEAD remoto de `pre-prod`.
- Após registrar/associar o subdomínio e concluir o deploy, o proprietário confirmou em 01/10/2026 que o site está funcionando na Discloud. Os logs apresentados mostraram `node start.mjs` e `Listening on: http://localhost:8080/ (all interfaces)`.
- A correção validada permanece em `pre-prod` no commit `e142b26`; o último commit remoto de `main` consultado em 01/10/2026 é `d0bfa275ebd4ccbc653f56b02ecfc2c6f54ce7b7`. Não presumir que a versão implantada já foi promovida para `main`.
- Projeto Lovable associado: `https://lovable.dev/projects/82e7340c-505e-45b7-8e92-3990530d2150`.
- Não reescrever histórico publicado ligado ao Lovable: não usar force-push nem rebase, amend ou squash de commits que já foram enviados.

### Atenção ao checkout local

- Na data desta consolidação, o checkout local ainda aponta para o commit antigo `2bfcc6d8648b5018fc044d2f4a4d19cd2e650399` e não representa o estado remoto atual.
- Há alterações locais do proprietário em `CLAUDE.md`, `README.md`, `apps/api/.env.example`, `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/web/.env.example` e `apps/web/next.config.ts`.
- Esses arquivos pertencem ao trabalho local anterior. Não apagar, restaurar ou sobrescrever sem solicitação explícita. Antes de atualizar o checkout, preservar essas mudanças em commit, stash nomeado ou cópia segura conforme a orientação do proprietário.
- A arquitetura antiga local (Next.js + Express + Prisma) foi substituída na branch remota `pre-prod` pelo projeto TanStack/Lovable descrito abaixo.

## Arquitetura vigente em `origin/pre-prod`

- Aplicação única TanStack Start com React 19.2 e TypeScript 5.8, em ESM.
- Vite 8 como servidor de desenvolvimento e ferramenta de build.
- TanStack Router com rotas baseadas em arquivos e árvore gerada em `src/routeTree.gen.ts`.
- TanStack Query para cache e carregamento de dados.
- Tailwind CSS 4 e componentes Radix/shadcn em `src/components/ui`.
- Supabase/Lovable Cloud como fonte persistente de catálogo, perfis, categorias, campanhas e vitrines.
- Nitro usa o preset `node-server` e gera `dist/server/index.mjs`, pois `dist/` é a saída reservada pela Discloud para `TYPE=site` com `BUILD` automático.
- `start.mjs` inicia o servidor em `0.0.0.0:8080`, preserva uma variável `PORT` fornecida pelo ambiente e aceita `server/index.mjs` ou `dist/server/index.mjs` conforme o layout entregue pelo runtime.
- `discloud.config` reinstala as dependências de desenvolvimento antes do build, pois Vite, Nitro e o adaptador Lovable são necessários no builder.
- `.discloudignore` exclui dependências, caches e artefatos locais do pacote enviado.
- `tslib` é uma dependência direta de produção porque o bundle Nitro a externaliza no servidor gerado.
- Carrinho mantido no navegador em `localStorage`, chave `ki-sapato-cart`.
- Checkout é demonstrativo nesta fase; não efetua cobrança real.

## Estrutura e rotas principais

- `src/routes/index.tsx`: página inicial editorial, hero, novidades, categorias e benefícios.
- `src/routes/produtos.index.tsx`: catálogo com busca, gênero, categoria, ordenação e carregamento incremental.
- `src/routes/produtos.$slug.tsx`: detalhe do produto e seleção de tamanho/cor.
- `src/routes/sacola.tsx`: carrinho.
- `src/routes/checkout.tsx`: checkout demonstrativo.
- `src/routes/auth.tsx` e `src/routes/reset-password.tsx`: autenticação e recuperação via Supabase/Lovable.
- `src/routes/conta.tsx`: área do cliente.
- `src/routes/admin.tsx`: administração de catálogo e conteúdo.
- `src/components/shop-shell.tsx`: cabeçalho, navegação, menu móvel e rodapé.
- `src/components/product-card.tsx`: cartão editorial de produto.
- `src/hooks/use-catalog.ts`: leitura de produtos/categorias no Supabase e URLs assinadas do bucket.
- `src/lib/catalog.ts`: tipos, formatação monetária e catálogo de fallback com 14 produtos.
- `src/lib/cart.tsx`: contexto e persistência do carrinho.
- `src/integrations/supabase`: clientes, autenticação, middleware e tipos gerados.
- `supabase/migrations`: esquema e políticas RLS.

## Dados e Supabase

- Tabelas principais: `profiles`, `user_roles`, `categories`, `products`, `product_variants`, `product_images`, `campaigns` e `showcases`.
- Papéis: `admin` e `user`.
- Badges de produto: `Lançamento`, `Promoção` e `Destaque`.
- Conteúdo público só deve expor registros ativos; operações administrativas exigem papel `admin`, conforme as políticas RLS.
- Imagens do catálogo ficam no bucket `catalog-images`; o cliente gera URLs assinadas temporárias.
- Variáveis esperadas, sem registrar valores na memória: `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e equivalentes públicas prefixadas com `VITE_`.
- Nunca incluir chaves secretas, service-role keys ou credenciais em commits, logs ou descrições de PR.

## Design e ativos

- Tokens e estilos globais ficam em `src/styles.css`; cores usam OKLCH e `--radius` é zero.
- Fonte de texto: Jost. Fonte de títulos: Cormorant Garamond.
- Hero: imagem de moda em largura total, overlay escuro e chamada “Estilo para todos os passos.”.
- Seção de novidades em grade de quatro produtos no desktop.
- Seção editorial de categorias em composição 50/50, seguida de benefícios e rodapé preto.
- Ativos principais: `ki-sapato-hero.jpg`, `ki-sapato-categories.jpg`, `product-bag.jpg`, `product-kids.jpg`, `product-sandal.jpg` e `product-sneaker.jpg` em `src/assets`.
- Logo original é referenciada por `src/assets/logo.png.asset.json`.

## Comandos

- Instalação preferencial da origem: `bun install`; npm também consegue instalar as dependências.
- Desenvolvimento: `npm run dev` ou `bun run dev`.
- Build de produção: `npm run build`.
- Preview: `npm run preview`.
- Produção/Discloud: `npm run start` após `npm run build`.
- Lint: `npm run lint`.
- Formatação: `npm run format`.
- Typecheck manual: `npx tsc --noEmit`.

## Estado conhecido de validação

- O build de produção da cópia exata passou em 30/09/2026.
- O build com preset Nitro `node-server` passou em 30/09/2026 após simular uma instalação de produção sem devDependencies.
- Em 01/10/2026, uma instalação totalmente limpa com Node.js 22 e o comando da Discloud passou, sem vulnerabilidades npm conhecidas, gerando `dist/server/index.mjs`, `dist/public` e `dist/nitro.json`.
- O servidor foi testado após simular a promoção da saída `dist/` e reinstalar somente dependências de produção; iniciou em `0.0.0.0:8080`, e as rotas `/`, `/produtos`, `/sacola`, `/auth`, `/conta`, `/admin` e `/favicon.png` responderam HTTP 200.
- O artefato tem 3,8 MB, 101 arquivos e nenhum binário nativo `.node`, `.so` ou `.dylib`.
- Pacote de teste atual da `pre-prod`: `kisapato-discloud-pre-prod-e142b26.zip`, SHA-256 `337ac35a761974a8480b3bc1674343a814ae562d6b5bb8ecda9e93f12b78b4fe`.
- O proprietário confirmou o funcionamento do projeto implantado na Discloud em 01/10/2026. Na mesma data, `https://kisapato.discloud.dev/` foi verificado externamente e respondeu HTTP 200, com `text/html`, 26.249 bytes e cabeçalho `x-powered-by: discloud.com`.
- Pacote limpo do merge atual: `kisapato-discloud-main-d0bfa27.zip`, gerado por `git archive`, testado sem erros e com SHA-256 `bd28e53d9b49cb9d67ddf7bc3ed7f8cd309a1c2de89d3c52b1a07499a8f99202`.
- `npx tsc --noEmit` ainda falha com erros preexistentes em `admin.tsx`, `auth.tsx`, `produtos.index.tsx` e `reset-password.tsx`.
- O lint ainda falha principalmente por formatação Prettier na origem (582 ocorrências na verificação da cópia, sendo 574 corrigíveis automaticamente).
- Não declarar TypeScript ou lint como aprovados até que esses problemas sejam corrigidos e os comandos sejam executados novamente.

## Regras de trabalho

- Preservar o projeto TanStack/Lovable vigente; não reintroduzir a arquitetura Next.js/Express/Prisma antiga sem decisão explícita.
- Manter o Supabase/Lovable Cloud como fonte de verdade para dados administráveis e persistentes.
- Manter o carrinho no navegador e o checkout como demonstração enquanto não houver decisão de implementar pedidos e pagamentos reais.
- Não editar manualmente `src/routeTree.gen.ts` quando ele puder ser regenerado pelo roteador.
- Reutilizar os componentes e tokens do design system antes de criar estilos ou componentes paralelos.
- Interface, mensagens e documentação do produto devem permanecer em pt-BR.
- Executar validação proporcional à alteração; no mínimo, build e as verificações relevantes.

## Git e pull requests

- Todo push deste projeto deve ir para `pre-prod`; nunca fazer push direto para `main`.
- Não usar `--force` e não reescrever histórico publicado.
- Preservar alterações locais não relacionadas do proprietário.
- Sempre que um pull request for aberto, preencher uma descrição clara — nunca abrir PR sem descrição.
- A descrição do PR deve conter: objetivo, resumo das mudanças, testes/validações executados, riscos ou limitações, pendências e referência à tarefa/commit de origem quando aplicável.
- Se alguma verificação falhar, registrar explicitamente o comando e a falha na descrição do PR; não apresentar o PR como totalmente validado.
