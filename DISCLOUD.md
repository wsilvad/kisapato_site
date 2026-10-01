# Implantação na Discloud

Este projeto usa o build automático da Discloud para uma aplicação
`TYPE=site`. O Nitro gera o servidor em `dist/`, diretório reservado pela
plataforma para a saída de `BUILD`. O inicializador aceita o conteúdo exposto
na raiz do runtime e também a pasta `dist/` preservada.

## 1. Pré-requisitos

- Plano da Discloud compatível com sites e pelo menos 512 MB de RAM.
- Subdomínio `kisapato` registrado e disponível na mesma conta da Discloud
  usada no deploy. O endereço final será `https://kisapato.discloud.app`.
- Integração do GitHub autorizada para o repositório
  `wsilvad/kisapato_site`.
- Branch de produção: `main`. Alterações devem chegar nela por pull request
  vindo de `pre-prod`.

## 2. Variáveis de ambiente

Na criação pela integração do GitHub, informe estas variáveis na seção
**Environment Variables** antes de iniciar o deploy:

```dotenv
SUPABASE_PROJECT_ID=<id do projeto>
SUPABASE_URL=<url do projeto Lovable/Supabase>
SUPABASE_PUBLISHABLE_KEY=<chave pública>
VITE_SUPABASE_PROJECT_ID=<mesmo id do projeto>
VITE_SUPABASE_URL=<mesma url do projeto>
VITE_SUPABASE_PUBLISHABLE_KEY=<mesma chave pública>
```

As variáveis `VITE_*` precisam existir durante o build porque são incorporadas
ao bundle do navegador. As versões sem prefixo são usadas pelo SSR e pela
autenticação no servidor.

`SUPABASE_SERVICE_ROLE_KEY` não é necessária para iniciar o site atual. Só a
configure quando houver uma função administrativa executada no servidor. Ela
é secreta: nunca use o prefixo `VITE_`, nunca coloque o valor em um commit e
nunca a exponha em logs ou capturas de tela.

`LOVABLE_CRON_SECRET` e `LOVABLE_CRON_SECRET_PREVIOUS` também são opcionais e
só devem ser configuradas caso rotas de cron sejam ativadas.

Não é necessário configurar `PORT` ou `HOST`: `start.mjs` usa
`0.0.0.0:8080` por padrão e respeita valores fornecidos pela plataforma.

## 3. Criar ou atualizar pelo GitHub

1. No painel da Discloud, abra **Subdomínio** e registre `kisapato` pelo botão
   **+ Subdomínio**, se ele ainda não aparecer como **Disponível**. O nome já
   registrado deve pertencer à mesma conta usada no deploy.
2. Abra **GitHub Integration** e autorize a conta que é proprietária do
   repositório.
3. Selecione `wsilvad/kisapato_site` e a branch `pre-prod` para validar esta
   correção. Depois da validação e do merge, use `main` para produção.
4. Selecione o subdomínio `kisapato` e confirme o ID `kisapato`.
5. Preencha as seis variáveis públicas da seção anterior.
6. Confirme pelo conteúdo de `discloud.config`:

   ```ini
   NAME=Ki Sapato Chic
   TYPE=site
   ID=kisapato
   MAIN=start.mjs
   RAM=512
   VERSION=22
   BUILD=npm install --include=dev --package-lock=false && npm run build
   START=npm run start
   ```

7. Inicie o deploy e acompanhe os logs até aparecerem a geração de
   `dist/server/index.mjs`, `dist/nitro.json` e a mensagem de servidor ouvindo
   na porta 8080.
8. Abra `https://kisapato.discloud.app` e valide `/`, `/produtos`, `/sacola` e
   `/auth`.

## 4. Atualizar por arquivo ZIP

Use esta alternativa somente se não estiver usando a integração do GitHub.

1. Gere o ZIP a partir do commit aprovado da `main`, com os arquivos do
   projeto diretamente na raiz do ZIP. Não crie uma pasta externa adicional.
2. Não inclua `.git/`, `node_modules/`, `dist/`, `build/`, `.output/` ou caches.
   A pasta `dist/` será criada pela própria Discloud durante `BUILD`.
3. Inclua um `.env` na raiz do ZIP com as seis variáveis públicas, sem nenhuma
   chave secreta, ou configure-as no painel se essa opção estiver disponível.
4. Faça o commit/upload sobre a aplicação ligada ao subdomínio `kisapato` e
   acompanhe os logs.

## 5. Sinais de build correto

O processo esperado é:

1. instalação das dependências;
2. execução de `vite build` com Node.js 22;
3. geração de `dist/public`, `dist/server/index.mjs` e `dist/nitro.json`;
4. disponibilização da saída reservada `dist/` no runtime;
5. `npm run start`, com `start.mjs` carregando `server/index.mjs` ou
   `dist/server/index.mjs`, conforme o layout entregue pela plataforma;
6. servidor disponível em `0.0.0.0:8080`.

Se o log mencionar `.output/server/index.mjs` ou `build/server/index.mjs`, o
deploy está usando um commit antigo. Confirme a branch e o SHA selecionados no
painel antes de tentar novamente.

O aviso `failed to configure registry cache importer ... not found` indica
apenas ausência de cache anterior quando as etapas seguintes continuam; ele
não é a causa de uma falha posterior do build.

## 6. Configuração externa de autenticação

No painel do Lovable Cloud/Supabase, adicione o domínio final da Discloud aos
URLs permitidos de autenticação:

- `https://kisapato.discloud.app`;
- `https://kisapato.discloud.app/auth`;
- `https://kisapato.discloud.app/reset-password`.

Sem essa configuração, o site pode abrir normalmente, mas login social,
confirmação de e-mail e recuperação de senha podem redirecionar para um domínio
incorreto.
