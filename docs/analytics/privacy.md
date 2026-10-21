# Privacidade da medição (LGPD)

Este documento descreve o que a medição faz. **Não substitui orientação jurídica**: valide a base legal (legítimo interesse com dados anônimos ou consentimento por aviso de cookies) antes de ligar em produção.

## O que é coletado
- Um **identificador anônimo aleatório** do aparelho (13 meses) e um identificador de **visita** (30 minutos de inatividade). Sem cookies de terceiros.
- Páginas abertas, cliques em produtos, sacola, favoritos, buscas, erros e velocidade.
- Origem da visita (UTM e site de origem), tipo de aparelho (pela largura da tela), navegador e sistema (do cabeçalho do navegador).

## O que NUNCA é coletado
Nome, e-mail, CPF, telefone, endereço, cartão. O CEP só entra com os 3 primeiros dígitos. **IP não é guardado** (só serve ao limite de uso na hora). Termos de busca passam por um filtro que troca e-mail, CPF e telefone por `[removido]` e são cortados em 80 caracteres. Chaves de `props` com nomes de dado pessoal são descartadas.

## Controles
- Respeita **Não rastrear** e **Global Privacy Control**; opt-out local (`localStorage ks:optout=1`); nunca mede o painel `/admin`.
- `ANALYTICS_ENABLED=false` (servidor) e `NEXT_PUBLIC_ANALYTICS=off` (site) desligam tudo.
- **Identificação do cliente logado desligada por padrão** (`ANALYTICS_IDENTIFY`). Se ligada, o vínculo fica só em `analytics.identities` e nunca aparece no esquema `bi`.
- BI e IA enxergam só `bi.v1_*`: sem dado pessoal, com `visitor_key` pseudonimizado.
- Retenção: eventos brutos 13 meses (configurável); resumos diários sem prazo.
- Apagamento por visitante: ver [OPERATIONS.md](OPERATIONS.md).

## Para atualizar a Política de privacidade do site
Acrescente um trecho como: "Medimos o uso do site (páginas visitadas, produtos vistos, sacola e buscas) de forma anônima, com um código aleatório guardado no seu navegador, para melhorar a loja. Não usamos seus dados pessoais nessa medição nem a compartilhamos com terceiros para publicidade. Você pode desativá-la ativando 'Não rastrear' no navegador."
Se usar o PostHog, cite-o como operador e mascare campos sensíveis no replay.
