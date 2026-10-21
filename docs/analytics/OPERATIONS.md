# Operação da medição

## Variáveis (servidor da API)
| Variável | Padrão | Para quê |
|---|---|---|
| `ANALYTICS_ENABLED` | `true` | `false` desliga gravação de eventos e a manutenção diária (interruptor geral) |
| `ANALYTICS_IDENTIFY` | `false` | `true` liga o visitante anônimo ao cliente logado (tabela `analytics.identities`). **Decisão de privacidade**, ver [privacy.md](privacy.md) |
| `ANALYTICS_RETENTION_MONTHS` | `13` | Meses de eventos brutos; partições mais antigas são removidas de madrugada |
| `METRICS_API_KEY` | — | Chave da API de métricas (≥ 24 caracteres). Sem ela a API de métricas fica desligada (503). **Quem opera preenche; nunca coloque em chat ou no repositório** |
| `METRICS_DATABASE_URL` | — | Conexão do usuário `bi_reader` (somente leitura) usada pela API de métricas e pelo MCP. Sem ela usam a conexão principal, limitadas a `bi` pelo código |

No **site** (variáveis do build): `NEXT_PUBLIC_ANALYTICS=off` desliga o SDK; `NEXT_PUBLIC_POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_HOST` ligam o destino PostHog (opcional).

## Colocar no ar (ordem)
1. **Migrations** `20261021000000_analytics_foundation` e `20261021010000_analytics_views` (só criam objetos novos nos esquemas `analytics` e `bi`; o app precisa de permissão `CREATE` no banco para criar os esquemas). Simule antes com `npx prisma migrate status`.
2. Suba a **API**, depois o **site**. A API responde `204` ao site mesmo que a medição falhe; o site funciona sem a API de eventos.
3. (Opcional) crie o usuário somente leitura: um administrador do banco roda, com a senha escolhida por ele:
   ```sql
   CREATE ROLE bi_reader LOGIN PASSWORD '<escolha-uma-senha-forte>';
   GRANT CONNECT ON DATABASE <banco> TO bi_reader;
   GRANT USAGE ON SCHEMA bi TO bi_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA bi TO bi_reader;
   ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT SELECT ON TABLES TO bi_reader;
   ```
   As views rodam com os direitos do dono, então `bi_reader` **não precisa** (e não tem) acesso às tabelas de pedidos e clientes.
4. Defina `METRICS_API_KEY` (e `METRICS_DATABASE_URL`, se criou o usuário) nas variáveis do servidor e reinicie.

## O que roda sozinho
- Ao subir: garante as partições (mês anterior, atual e 2 à frente) e refaz os resumos de ontem e hoje.
- A cada 15 minutos: refaz o resumo de hoje (`analytics.refresh_daily`).
- Todo dia às 3 h (Brasília): partições, retenção, resumos de ontem e hoje, retrato diário de preços (`analytics.snapshot_prices`).
- Eventos são gravados em lote a cada 5 s (ou 200 eventos). Se a API reiniciar, no máximo ~5 s de eventos se perdem.

## Comandos úteis
```bash
npm run analytics:docs   -w @ki-sapato/api   # regenera os arquivos gerados em docs/analytics
npm run analytics:report -w @ki-sapato/api -- --days 7 --out relatorio.md   # resumo semanal em Markdown
npm run analytics:mcp    -w @ki-sapato/api   # servidor MCP (stdio) para agentes
npm run analytics:demo   -w @ki-sapato/api -- --days 14 --sessions 80 --clean   # eventos de mentira (SÓ banco descartável)
```
Recalcular um período: `SELECT analytics.refresh_range('2026-10-01', '2026-10-21');`

Ajustar parâmetros das análises (sem mexer no código): `UPDATE analytics.settings SET value = '0.25' WHERE key = 'min_margin';` (chaves: `min_margin`, `abandon_hours`, `min_views`, `window_days`, `w_demand`, `w_interest`, `w_conversion`, `w_margin`, `w_availability`).

## Privacidade e apagamento
Apagar os dados de um visitante: `DELETE FROM analytics.events WHERE anonymous_id = '<uuid>';` (e `analytics.identities`, se houver). Opt-out do cliente: `localStorage ks:optout=1`; o site também respeita "Não rastrear" e Global Privacy Control. Veja [privacy.md](privacy.md).

## Problemas comuns
| Sintoma | Causa provável |
|---|---|
| Sem eventos no banco | `ANALYTICS_ENABLED=false`; migrations não aplicadas (o log mostra `[analytics] falha ao gravar`); bloqueador no navegador; "Não rastrear" |
| `no partition of relation` | Manutenção não rodou; a API cria a partição e tenta de novo sozinha, ou rode `SELECT analytics.ensure_event_partitions(2)` |
| Funil/produtos desatualizados | Resumos refeitos a cada 15 min; rode `analytics.refresh_daily(current_date)` |
| API de métricas devolve 503 | Falta `METRICS_API_KEY` |
| Carrinho aparece como abandonado mas comprou | A compra não trouxe os cabeçalhos da visita (`X-Ks-Aid`/`X-Ks-Sid`) |
| Números diferentes do GA4/PostHog | Cada ferramenta conta de um jeito (bloqueadores, robôs, sessões). A fonte da verdade são as views `bi` |
