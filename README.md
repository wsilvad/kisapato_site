# Ki Sapato Chic

vamos criar um ecomerce para ki sapato, uma loja de sapatos, bolsas e acessórios masculino e feminino sediada em santo Antonio da patrulha/RS.  utilize como base os sites:

https://www.luzdalua.com.br/
https://www.tf.com.br
https://www.studiomshop.com.br/todos-os-modelos

em anexo o .md do protótipo do site e a logo para se basear nas cores para utiizar

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/82e7340c-505e-45b7-8e92-3990530d2150).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploy na Discloud

O projeto inclui `discloud.config`, `.discloudignore` e um inicializador
Node.js para o servidor Nitro. Faça o deploy a partir da branch `pre-prod`;
um pacote que contenha `apps/api` ou `apps/web` pertence à arquitetura
anterior e não corresponde a esta versão.

A etapa de build reinstala também as dependências de desenvolvimento porque
Vite, Nitro e o adaptador do Lovable são necessários para gerar o servidor.
O processo inicia em `0.0.0.0:8080`, conforme a exigência da Discloud.
O servidor compilado fica em `build/server/index.mjs`, uma pasta não oculta
que é preservada entre as etapas de build e execução da plataforma.

Configure no ambiente da aplicação as variáveis públicas do Supabase e, para
as operações administrativas do servidor, `SUPABASE_SERVICE_ROLE_KEY`.
