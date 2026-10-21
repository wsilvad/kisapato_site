# API de analytics — referência

Duas APIs, com públicos diferentes. Base de produção: `https://kisapatoback.discloud.dev` (dev: `http://localhost:3333`).

| API | Para quê | Quem usa | Autenticação |
|---|---|---|---|
| **Eventos** `POST /api/events` | Receber o que acontece no site | O site (SDK `track()`) | Nenhuma (pública, sempre 204) |
| **Métricas** `GET /api/metrics/v1/*` | Ler números prontos | Power BI, Grafana, scripts, agentes de IA | Chave `METRICS_API_KEY` (Bearer) |

Contrato máquina-legível da API de métricas: [`openapi.json`](openapi.json), também servido sem chave em `/api/metrics/openapi.json`.
Para consultar com SQL direto no banco (Power BI, Tableau, Grafana), veja [README.md](README.md) e [powerbi/README.md](powerbi/README.md); as views `bi.v1_*` são o mesmo dado que esta API expõe.

---

## 1. API de eventos — `POST /api/events`

Recebe um **lote de até 50 eventos**. Responde **sempre `204 No Content`**, inclusive quando descarta (o navegador não deve repetir nem mostrar nada). Por isso, `204` não prova que o evento foi gravado.

- `Content-Type`: `text/plain` (usado pelo `sendBeacon`, sem pré-checagem de CORS) ou `application/json`; corpo em JSON, até 64 KB.
- Limite: 120 envios por minuto por IP.
- Descartado em silêncio: robôs (User-Agent), navegadores com `DNT: 1` ou `Sec-GPC: 1`, JSON inválido, evento desconhecido, ids que não são UUID.
- Gravado em lote no banco: aparece em `analytics.events` em até ~5 s.
- O IP não é gravado. O aparelho e o navegador vêm do User-Agent; o tipo de aparelho vem de `viewport_w`.

### Corpo

```json
{
  "sent_at": 1761000000000,
  "events": [
    {
      "event": "page_view",
      "ts": 1760999999000,
      "anonymous_id": "11111111-1111-4111-8111-111111111111",
      "session_id": "22222222-2222-4222-8222-222222222222",
      "path": "/produtos",
      "viewport_w": 390
    }
  ]
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `sent_at` | recomendado | Relógio do aparelho no envio (ms). Com `ts`, corrige aparelhos com hora errada: vale a idade do evento (`sent_at − ts`), e se ela for negativa ou maior que 48 h, vale a hora de recebimento. |
| `events[].event` | sim | Nome do evento. Lista completa em [events-catalog.md](events-catalog.md). Eventos só do servidor (ex.: `purchase`) são recusados aqui. |
| `events[].ts` | não | Quando ocorreu (ms). Sem ele vale a hora de recebimento. |
| `events[].anonymous_id` | sim | UUID do visitante (guardado 13 meses no aparelho). |
| `events[].session_id` | sim | UUID da sessão (renova após 30 min parado). |
| `events[].path` | em `page_view` | Caminho da página, começando por `/`. Query string e `#` são removidos; UUIDs e números longos viram `:id`. |
| `events[].viewport_w` | não | Largura da janela (200–10000); define `mobile`/`tablet`/`desktop`. |
| `referrer_host`, `utm_source`, `utm_medium`, `utm_campaign` | não | Origem do visitante (texto curto). |
| `product_id`, `variant_id`, `list_name`, `list_position`, `price`, `quantity`, `cart_value`, `items_count`, `search_term`, `results_count`, `value_num`, `error_code` | conforme o evento | Só as colunas que o evento declara são guardadas; as obrigatórias de cada evento estão no catálogo. |
| `props` | não | Objeto com chaves simples e curtas. Chaves com nome de dado pessoal (e-mail, CPF, telefone etc.) são descartadas. |

Privacidade aplicada na entrada: termos de busca com e-mail, CPF ou telefone viram `[removido]` (corte em 80 caracteres); CEP guarda só 3 dígitos; `/admin` nunca é medido. Detalhes em [privacy.md](privacy.md).

### Exemplo

```bash
NOW=$(($(date +%s)*1000))
curl -X POST https://kisapatoback.discloud.dev/api/events \
  -H 'content-type: text/plain' \
  -d "{\"sent_at\":$NOW,\"events\":[{\"event\":\"page_view\",\"ts\":$NOW,\"anonymous_id\":\"11111111-1111-4111-8111-111111111111\",\"session_id\":\"22222222-2222-4222-8222-222222222222\",\"path\":\"/produtos\",\"viewport_w\":390}]}"
```

Sem `User-Agent` de navegador o evento é tratado como robô e descartado: para testar com `curl`, envie `-H 'User-Agent: Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36'`. Evento de teste apaga-se com `DELETE FROM analytics.events WHERE anonymous_id = '<uuid de teste>'`.

---

## 2. API de métricas — `GET /api/metrics/v1/…`

Somente leitura. Cada **métrica** é uma view `bi.v1_*` com pergunta de negócio, granularidade, colunas aditivas e cuidados de leitura.

### Autenticação

```
Authorization: Bearer <METRICS_API_KEY>
```

| Situação | Resposta |
|---|---|
| Chave correta | 200 |
| Sem chave ou chave errada | `401` `{"error":"Chave inválida.","code":"BAD_KEY"}` |
| `METRICS_API_KEY` não definida no servidor | `503` `{"code":"METRICS_DISABLED"}` |
| Mais de 60 consultas/min por IP | `429` |

`/api/metrics/openapi.json` não pede chave (não contém dados).

### Endpoints

| Método e caminho | Retorna |
|---|---|
| `GET /api/metrics/v1/metrics` | Lista das 15 métricas: `name`, `title`, `question`, `grain`, `view`, `date_column`, `additive_columns`, `non_additive_columns`, `caveats`, `example_sql`. |
| `GET /api/metrics/v1/metrics/{name}` | Uma métrica com **todas as colunas**: tipo, significado e se pode ser somada. |
| `GET /api/metrics/v1/metrics/{name}/data` | As linhas (JSON ou CSV). |

Métricas: `products`, `traffic_daily`, `page_ranking`, `search_terms`, `funnel`, `abandoned_carts`, `cart_items`, `cart_add_remove`, `product_engagement`, `product_scorecard`, `price_opportunity`, `experience_issues`, `api_errors`, `price_history`, `sales`. O que cada uma responde está em [metrics-catalog.md](metrics-catalog.md); as colunas, em [data-dictionary.md](data-dictionary.md).

### Parâmetros de `/data`

| Parâmetro | Descrição |
|---|---|
| `from`, `to` | Datas `AAAA-MM-DD`, inclusivas. Só em métricas com `date_column`. |
| `limit` | 1 a 10.000 (padrão 1.000). |
| `offset` | Paginação. |
| `order` | Coluna de ordenação; prefixo `-` para decrescente (`-views`). Só colunas da métrica. |
| `format` | `csv` devolve CSV (UTF-8) em vez de JSON. |
| qualquer coluna | Filtro de igualdade, ex.: `?device_type=mobile`. Coluna inexistente é rejeitada. |

Tudo é validado contra as colunas da métrica e roda em transação somente leitura, com limite de 10 s. Não há como enviar SQL por esta API.

### Resposta de `/data` (JSON)

```json
{ "metric": "traffic_daily", "view": "bi.v1_traffic_daily", "row_count": 30, "limit": 1000, "offset": 0, "columns": [ ... ], "rows": [ ... ] }
```

Ao somar, use só as `additive_columns`. Colunas não aditivas (preços unitários, taxas, visitantes únicos) somam errado entre linhas; a lista e os motivos vêm em `non_additive_columns` e `caveats`.

### Exemplos

```bash
KEY=...   # sua METRICS_API_KEY
B=https://kisapatoback.discloud.dev/api/metrics/v1

# o que existe
curl -s -H "Authorization: Bearer $KEY" $B/metrics

# colunas de uma métrica
curl -s -H "Authorization: Bearer $KEY" $B/metrics/funnel

# tráfego dos últimos dias, só celular, mais recentes primeiro
curl -s -H "Authorization: Bearer $KEY" "$B/metrics/traffic_daily/data?from=2026-10-01&device_type=mobile&order=-date_sp"

# CSV para planilha
curl -s -H "Authorization: Bearer $KEY" "$B/metrics/product_scorecard/data?format=csv&limit=500" -o scorecard.csv
```

### Power BI, Grafana, Tableau

Prefira a conexão SQL com o usuário `bi_reader` (somente leitura) nas views `bi.v1_*`: é mais rápido para volumes grandes. Esta API serve para scripts, Power Query via Web, planilhas e agentes de IA.

### Agentes de IA

Dois caminhos, o mesmo dado: esta API (HTTP + `openapi.json`) ou o servidor MCP (`npm run analytics:mcp` na API), que oferece `list_metrics`, `describe_metric`, `query_metric`, `run_sql` (guardado, só leitura) e `get_agent_guide`. Instruções para o agente: [AGENTS.md](AGENTS.md).

---

## Versionamento

O prefixo `/v1` e as views `bi.v1_*` são um **contrato estável**: colunas não são removidas nem mudam de significado dentro da v1. Mudanças que quebrem ganham `v2` e a v1 segue ativa por um período. Histórico em [CHANGELOG.md](CHANGELOG.md).

## Operação

Variáveis, ordem de publicação e problemas comuns: [OPERATIONS.md](OPERATIONS.md).
