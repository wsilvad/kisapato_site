# Guia para agentes de IA: métricas do site Ki Sapato

Você vai ajudar a loja a entender o comportamento dos clientes e a montar dashboards. Este arquivo é o ponto de partida. Tudo o que está em `docs/analytics/` é lido por você; o que está marcado como *gerado* vem do código e do banco e é sempre atual.

## 1. O que existe

- A loja (`Ki Sapato`, calçados e acessórios) registra eventos de navegação, produto, sacola, favoritos, busca e erros. Eles ficam num esquema interno (`analytics`) **que você não lê**.
- Você lê o **esquema `bi`**: 15 views versionadas `bi.v1_*`, sem dado pessoal, com nomes e colunas documentados. Cada view é uma **métrica**.
- Fuso: `America/Sao_Paulo`. Valores em **reais**. Datas `AAAA-MM-DD`.

## 2. Como acessar (escolha um)

| Caminho | Quando usar | Como |
|---|---|---|
| **Servidor MCP** `ki-sapato-metrics` | Você é um agente com ferramentas (Claude, etc.) | Ferramentas `list_metrics`, `describe_metric`, `query_metric`, `run_sql`, `get_agent_guide` |
| **API de métricas** (HTTP) | Você chama URLs | `GET /api/metrics/v1/metrics` → `/{nome}` → `/{nome}/data?from=&to=`. Contrato em [openapi.json](openapi.json). Chave no cabeçalho `Authorization: Bearer …` (pergunte ao responsável; nunca peça para colar a chave no chat) |
| **SQL direto** | Power BI, Grafana, Tableau, Metabase, Looker | Usuário somente leitura `bi_reader` sobre `bi.*` |

## 3. Passo a passo para responder uma pergunta

1. `list_metrics` e escolha a métrica pela **pergunta que ela responde**. [metrics-catalog.md](metrics-catalog.md) tem a lista completa.
2. `describe_metric` da escolhida: veja as colunas, o que é **somável** e os **cuidados**. [data-dictionary.md](data-dictionary.md) tem o mesmo em arquivo.
3. Consulte **sempre com período** (`from`/`to`) nas métricas que têm `date_column`, e com `limit`.
4. Calcule razões (taxas, CTR, conversão) **depois de somar** numeradores e denominadores. Nunca some percentuais, ranks, médias nem contagens de distintos (`visitors`, `unique_viewers`).
5. Diga o **tamanho da amostra** junto com qualquer percentual. Poucas visitas = número frágil; fale isso.

## 4. Mapa: pergunta → métrica

| Pergunta | Métrica (`bi.v1_…`) |
|---|---|
| O que o cliente mais acessa? De onde vem? | `traffic_daily`, `page_ranking`, `search_terms` |
| Onde desiste antes de comprar? | `funnel` |
| Itens na sacola que não foram comprados? | `abandoned_carts`, `cart_items` |
| Itens colocados e retirados da sacola? | `cart_add_remove` |
| Itens com mais cliques? Favoritados? | `product_engagement` |
| Itens que merecem destaque? | `product_scorecard` (índice e `hidden_gem`) |
| Itens que poderiam vender com preço menor? | `price_opportunity` (+ `price_history` para o efeito) |
| Experiências ruins (erros, lentidão)? | `experience_issues`, `api_errors` |
| O que foi vendido, com que margem? | `sales`, `products` (dimensão) |

## 5. Regras (valem sempre)

1. **Só leitura.** Nunca tente gravar, apagar ou alterar nada. Nunca leia fora do esquema `bi`.
2. **Sem dados pessoais.** Não existem nas views e não devem ser pedidos. Se algo parecer pessoal (um termo de busca com número de telefone, por exemplo), pare e avise. `visitor_key` é um código pseudonimizado: não tente identificar ninguém.
3. **Segredos**: nunca peça a chave da API nem a senha do banco no chat. O responsável configura no ambiente.
4. **Custo de produto não é exposto**; só margem em % e o desconto máximo (`max_discount_pct`). Não tente reconstruir o custo.
5. **Interesse sem compra não prova que o preço é o motivo.** Frete, estoque, tamanho e foto também pesam. Ao falar de preço, mostre esses fatores e sugira teste controlado antes de mexer em muitos produtos.
6. **Cuidado com fatos que a medição não vê**: bloqueadores de anúncio e "Não rastrear" reduzem os números; robôs são filtrados; a compra sem os cabeçalhos da visita não entra no funil. Cite essas limitações quando importarem.
7. O funil tem a etapa "Escolheu pagamento" **vazia** enquanto o checkout com pagamento não estiver no ar.

## 6. Montar dashboards

Veja [dashboards-playbook.md](dashboards-playbook.md): cada painel já tem SQL testado. Os 6 dashboards de partida do Grafana estão em `grafana/dashboards/*.json`; para Power BI use `powerbi/measures.dax` e o modelo descrito em `powerbi/README.md`; para Looker, `lookml/`; a camada semântica em [semantic-layer.yaml](semantic-layer.yaml) serve para gerar modelos em outras ferramentas.

## 7. Se algo não bater

- Compare com a venda real em `bi.v1_sales` (vem dos pedidos, não da medição).
- Confira a idade dos dados: os resumos do dia são refeitos a cada 15 minutos; `funnel`, `product_engagement`, `cart_add_remove` e `experience_issues` dependem deles.
- Mudanças no contrato ficam em [CHANGELOG.md](CHANGELOG.md). Views nunca mudam de significado dentro da mesma versão (`v1`).

## 8. Para quem mantém

Operação, variáveis, criação do usuário `bi_reader`, retenção e solução de problemas: [OPERATIONS.md](OPERATIONS.md). Privacidade: [privacy.md](privacy.md).
