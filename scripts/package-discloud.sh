#!/bin/sh
# Empacota um dos apps em ZIP para criar o projeto na Discloud (Upload no painel).
#   scripts/package-discloud.sh api
#   scripts/package-discloud.sh web https://kisapatoback.discloud.dev/api
# O ZIP sai em deploy-out/. Nunca inclui .env, node_modules nem builds; segredos vão em "Variáveis" no painel.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
app="${1:-}"
out="$root/deploy-out"
mkdir -p "$out"

case "$app" in
  api)
    cd "$root/apps/api"
    rm -f "$out/kisapato-api.zip"
    # A API vai compilada (dist/), como a loja: um commit pelo painel nem sempre refaz o build na Discloud.
    rm -rf dist
    npm run build
    # uploads/ leva as fotos já cadastradas; src/generated é refeito no build (prisma generate).
    zip -rq "$out/kisapato-api.zip" . -x "node_modules/*" ".env" ".env.*" "uploads-originais/*" "src/generated/*" "*.log" ".DS_Store" -x '!.env.example'
    zip -q "$out/kisapato-api.zip" .env.example
    echo "Gerado: $out/kisapato-api.zip"
    ;;
  web)
    api_url="${2:-}"
    [ -n "$api_url" ] || { echo "Informe a URL pública da API: scripts/package-discloud.sh web https://kisapatoback.discloud.dev/api" >&2; exit 1; }
    cd "$root/apps/web"
    rm -f "$out/kisapato-web.zip"
    # NEXT_PUBLIC_API_URL é embutida no build do Next; é só uma URL pública, não um segredo.
    # O build de produção sai em dist/ (ver next.config.ts) e vai pronto no ZIP, sem o cache, além de ser refeito na Discloud.
    rm -rf dist
    NEXT_PUBLIC_API_URL="$api_url" npm run build
    tmp="$(mktemp -d)"
    printf 'NEXT_PUBLIC_API_URL=%s\n' "$api_url" > "$tmp/.env.production"
    zip -rq "$out/kisapato-web.zip" . -x "node_modules/*" ".next/*" "dist/cache/*" ".env" ".env.*" "*.tsbuildinfo" "next-env.d.ts" "*.log" ".DS_Store"
    (cd "$tmp" && zip -q "$out/kisapato-web.zip" .env.production)
    rm -rf "$tmp"
    echo "Gerado: $out/kisapato-web.zip (API: $api_url)"
    ;;
  *)
    echo "Uso: $0 api | web <URL_DA_API>" >&2
    exit 1
    ;;
esac
