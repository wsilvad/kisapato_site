<!-- Gerado por `npm run analytics:docs -w @ki-sapato/api`. Não edite à mão: mude o código e gere de novo. -->

# Catálogo de métricas

Cada métrica é uma view versionada do esquema `bi`. Fuso `America/Sao_Paulo`, valores em reais. Colunas, tipos e significados: [data-dictionary.md](data-dictionary.md). API: [openapi.json](openapi.json).

| Métrica | Pergunta que responde | Granularidade | View |
|---|---|---|---|
| [`products`](#products) | Quais produtos existem, em que categoria e marca, a que preço e com quanto estoque? | 1 linha por produto (estado atual) | `bi.v1_products` |
| [`traffic_daily`](#traffic_daily) | Quanta gente acessa o site, de onde vem e em que aparelho? | dia × aparelho × origem | `bi.v1_traffic_daily` |
| [`page_ranking`](#page_ranking) | O que o cliente mais acessa? | dia × caminho | `bi.v1_page_ranking` |
| [`search_terms`](#search_terms) | O que o cliente busca e o que não encontra? | dia × termo | `bi.v1_search_terms` |
| [`funnel`](#funnel) | Em que etapa o cliente desiste antes de comprar? | dia × aparelho × origem × etapa | `bi.v1_funnel` |
| [`abandoned_carts`](#abandoned_carts) | Quanto dinheiro está parado em sacolas que não viraram compra? | 1 linha por visitante com sacola abandonada (últimos 30 dias) | `bi.v1_abandoned_carts` |
| [`cart_items`](#cart_items) | Quais itens ficam nas sacolas e não são comprados? | visitante × item da sacola mais recente (últimos 30 dias) | `bi.v1_cart_items` |
| [`cart_add_remove`](#cart_add_remove) | Quais produtos o cliente coloca e depois tira da sacola? | dia × produto | `bi.v1_cart_add_remove` |
| [`product_engagement`](#product_engagement) | Quais itens têm mais cliques, visualizações, favoritos e vendas? | dia × produto | `bi.v1_product_engagement` |
| [`product_scorecard`](#product_scorecard) | Quais itens merecem destaque na loja? | 1 linha por produto ativo (janela móvel) | `bi.v1_product_scorecard` |
| [`price_opportunity`](#price_opportunity) | Quais itens o cliente olha, mas não compra, e quanto de desconto cabe mantendo a margem mínima? | 1 linha por produto candidato (janela móvel) | `bi.v1_price_opportunity` |
| [`experience_issues`](#experience_issues) | Onde o cliente está tendo uma experiência ruim (erros, lentidão, cliques repetidos)? | dia × página | `bi.v1_experience_issues` |
| [`api_errors`](#api_errors) | Quais chamadas à API estão falhando para o cliente? | dia × rota × método × código × origem do registro | `bi.v1_api_errors` |
| [`price_history`](#price_history) | Como o preço e o estoque de cada produto mudaram ao longo do tempo? | dia × produto | `bi.v1_price_history` |
| [`sales`](#sales) | O que foi vendido, por quanto e com que margem? | pedido × item | `bi.v1_sales` |

## products

**Produtos (dimensão).** Quais produtos existem, em que categoria e marca, a que preço e com quanto estoque?

- **View:** `bi.v1_products` · **Granularidade:** 1 linha por produto (estado atual)
- **Período:** retrato atual, sem filtro de período
- **Pode somar:** `stock_total`
- **Não somar:** `price` (preço unitário); `compare_at_price` (preço unitário)

**Cuidados**

- Use para juntar nomes, categorias e marcas às outras views pelo product_id.

**Exemplo**

```sql
SELECT category, count(*) AS produtos, sum(stock_total) AS estoque FROM bi.v1_products WHERE active GROUP BY 1 ORDER BY 3 DESC;
```

## traffic_daily

**Tráfego por dia.** Quanta gente acessa o site, de onde vem e em que aparelho?

- **View:** `bi.v1_traffic_daily` · **Granularidade:** dia × aparelho × origem
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `sessions`, `page_views`, `sessions_with_product_view`, `sessions_with_issues`, `bounced_sessions`
- **Não somar:** `visitors` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez); `new_visitors` (visitantes que apareceram pela 1ª vez no dia; somar dias é válido, mas some entre origens só dentro do mesmo dia e aparelho)

**Cuidados**

- Visita = sequência de eventos com até 30 minutos de intervalo.
- Origem é utm_source, o domínio de origem ou 'direto'.
- Robôs e quem ativou 'Não rastrear' ficam de fora.

**Exemplo**

```sql
SELECT date_sp, sum(sessions) AS visitas, sum(page_views) AS paginas FROM bi.v1_traffic_daily WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 1;
```

## page_ranking

**Páginas mais acessadas.** O que o cliente mais acessa?

- **View:** `bi.v1_page_ranking` · **Granularidade:** dia × caminho
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `page_views`
- **Não somar:** `visitors` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez)

**Cuidados**

- Caminhos de produto têm o slug; ids longos viram :id.

**Exemplo**

```sql
SELECT path, sum(page_views) AS vistas FROM bi.v1_page_ranking WHERE date_sp >= current_date - 7 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

## search_terms

**Termos buscados.** O que o cliente busca e o que não encontra?

- **View:** `bi.v1_search_terms` · **Granularidade:** dia × termo
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `searches`, `zero_result_searches`
- **Não somar:** `visitors` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez); `avg_results` (razão calculada por linha: some os numeradores e denominadores e divida de novo)

**Cuidados**

- E-mail, CPF e telefone digitados viram [removido].
- Termos com poucas buscas são ruído: veja o total no período.

**Exemplo**

```sql
SELECT search_term, sum(searches) AS buscas, sum(zero_result_searches) AS sem_resultado FROM bi.v1_search_terms WHERE date_sp >= current_date - 30 GROUP BY 1 HAVING sum(zero_result_searches) > 0 ORDER BY 3 DESC LIMIT 20;
```

## funnel

**Funil de compra.** Em que etapa o cliente desiste antes de comprar?

- **View:** `bi.v1_funnel` · **Granularidade:** dia × aparelho × origem × etapa
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `sessions`, `sessions_previous_step`
- **Não somar:** `pct_of_previous_step` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `pct_of_visits` (razão calculada por linha: some os numeradores e denominadores e divida de novo)

**Cuidados**

- Some sessions por etapa e depois calcule a taxa; não some os percentuais.
- A etapa 'Escolheu pagamento' só tem dados quando o checkout com pagamento estiver no ar.
- A compra é gravada pelo servidor; sem os cabeçalhos da visita ela não entra no funil.

**Exemplo**

```sql
SELECT step_order, step, sum(sessions) AS sessoes FROM bi.v1_funnel WHERE date_sp >= current_date - 30 GROUP BY 1, 2 ORDER BY 1;
```

## abandoned_carts

**Carrinhos abandonados.** Quanto dinheiro está parado em sacolas que não viraram compra?

- **View:** `bi.v1_abandoned_carts` · **Granularidade:** 1 linha por visitante com sacola abandonada (últimos 30 dias)
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `cart_value`, `items_count`
- **Não somar:** `hours_since` (idade do retrato)

**Cuidados**

- Abandonado = sem mudança há mais de abandon_hours (padrão 24 h) e sem compra depois.
- visitor_key é pseudonimizado: não identifica ninguém.
- Compra sem os cabeçalhos da visita não é ligada ao visitante e pode deixar um carrinho como abandonado por engano.

**Exemplo**

```sql
SELECT stage, count(*) AS carrinhos, sum(cart_value) AS valor FROM bi.v1_abandoned_carts GROUP BY 1;
```

## cart_items

**Itens das sacolas.** Quais itens ficam nas sacolas e não são comprados?

- **View:** `bi.v1_cart_items` · **Granularidade:** visitante × item da sacola mais recente (últimos 30 dias)
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `quantity`, `line_value`
- **Não somar:** `price` (preço unitário)

**Cuidados**

- Filtre abandoned = true para o que ficou parado.
- product_id pode ser o slug em sacolas criadas antes da medição.

**Exemplo**

```sql
SELECT item_name, count(*) AS sacolas, sum(line_value) AS valor FROM bi.v1_cart_items WHERE abandoned GROUP BY 1 ORDER BY 3 DESC LIMIT 20;
```

## cart_add_remove

**Colocado e retirado da sacola.** Quais produtos o cliente coloca e depois tira da sacola?

- **View:** `bi.v1_cart_add_remove` · **Granularidade:** dia × produto
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `adds`, `removes`
- **Não somar:** `remove_rate` (razão calculada por linha: some os numeradores e denominadores e divida de novo)

**Cuidados**

- remove_rate pode passar de 1 quando a sacola foi montada em outro dia.

**Exemplo**

```sql
SELECT product_name, sum(adds) AS adicionou, sum(removes) AS retirou, round(sum(removes)::numeric / nullif(sum(adds), 0), 2) AS taxa FROM bi.v1_cart_add_remove WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

## product_engagement

**Engajamento por produto.** Quais itens têm mais cliques, visualizações, favoritos e vendas?

- **View:** `bi.v1_product_engagement` · **Granularidade:** dia × produto
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `impressions`, `clicks`, `views`, `adds`, `fav_adds`, `fav_removes`, `fav_net`, `orders`, `units`, `revenue`
- **Não somar:** `unique_viewers` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez (a soma por dia conta quem volta em outro dia de novo)); `ctr` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `margin_pct` (razão calculada por linha: some os numeradores e denominadores e divida de novo)

**Cuidados**

- CTR = clicks ÷ impressions. Exibições são amostradas (1 por card e página, depois de 1 s visível).
- Vendas vêm dos pedidos não cancelados.

**Exemplo**

```sql
SELECT product_name, sum(clicks) AS cliques, sum(impressions) AS exibicoes, round(sum(clicks)::numeric / nullif(sum(impressions), 0), 3) AS ctr FROM bi.v1_product_engagement WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```

## product_scorecard

**Índice de destaque.** Quais itens merecem destaque na loja?

- **View:** `bi.v1_product_scorecard` · **Granularidade:** 1 linha por produto ativo (janela móvel)
- **Período:** retrato atual, sem filtro de período
- **Pode somar:** `impressions`, `clicks`, `views`, `adds`, `fav_adds`, `orders`
- **Não somar:** `score` (índice 0 a 100); `ctr` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `conversion_rate` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `margin_pct` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `unique_viewers` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez); `price` (preço unitário); `in_stock_sizes` (estado atual do produto); `total_sizes` (estado atual do produto); `demand_rank` (rank percentual dentro da categoria (0 a 1)); `interest_rank` (rank percentual (0 a 1)); `conversion_rank` (rank percentual (0 a 1)); `margin_rank` (rank percentual (0 a 1)); `exposure_rank` (rank percentual (0 a 1)); `availability` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `window_days` (parâmetro da janela (igual em todas as linhas))

**Cuidados**

- Ranks são percentuais dentro da categoria (0 a 1). Peso de cada sinal em analytics.settings.
- enough_data = false significa poucas visualizações: o número é frágil.
- hidden_gem: converte no top 25% da categoria e aparece no 25% de baixo.

**Exemplo**

```sql
SELECT product_name, category, score, hidden_gem FROM bi.v1_product_scorecard WHERE enough_data ORDER BY score DESC LIMIT 20;
```

## price_opportunity

**Oportunidade de preço.** Quais itens o cliente olha, mas não compra, e quanto de desconto cabe mantendo a margem mínima?

- **View:** `bi.v1_price_opportunity` · **Granularidade:** 1 linha por produto candidato (janela móvel)
- **Período:** retrato atual, sem filtro de período
- **Pode somar:** `views`, `adds`, `fav_adds`, `orders`, `adds_not_bought`, `stock_total`
- **Não somar:** `conversion_rate` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `margin_pct` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `max_discount_pct` (desconto máximo por produto); `unique_viewers` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez); `repeat_viewers` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez); `price` (preço unitário); `conversion_rank` (rank percentual dentro da categoria (0 a 1)); `days_since_last_sale` (estado atual do produto); `price_window_start` (preço unitário); `price_change_pct` (variação por produto); `min_margin_used` (parâmetro (igual em todas as linhas))

**Cuidados**

- É um sinal para investigar, não prova de que o preço é o motivo: frete, estoque, foto e tamanho também pesam.
- max_discount_pct é nulo quando o custo do produto não está cadastrado.
- Para saber o efeito de um desconto, compare antes e depois com bi.v1_price_history.

**Exemplo**

```sql
SELECT product_name, views, fav_adds, orders, max_discount_pct, stock_total FROM bi.v1_price_opportunity WHERE cost_known ORDER BY views DESC LIMIT 20;
```

## experience_issues

**Qualidade da experiência.** Onde o cliente está tendo uma experiência ruim (erros, lentidão, cliques repetidos)?

- **View:** `bi.v1_experience_issues` · **Granularidade:** dia × página
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `page_views`, `js_errors`, `api_errors`, `rage_clicks`, `form_errors`, `not_found`, `image_errors`
- **Não somar:** `issues_per_1k_views` (razão calculada por linha: some os numeradores e denominadores e divida de novo); `lcp_p75_ms` (percentil: não se soma nem se tira média sem peso); `inp_p75_ms` (percentil); `cls_p75` (percentil); `lcp_rating` (classificação)

**Cuidados**

- Velocidade só existe para páginas com medições; poucas medições deixam o percentil instável.
- Metas: LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0,1.

**Exemplo**

```sql
SELECT path, sum(page_views) AS vistas, sum(js_errors + api_errors) AS erros, max(lcp_p75_ms) AS lcp_pior FROM bi.v1_experience_issues WHERE date_sp >= current_date - 7 GROUP BY 1 ORDER BY 3 DESC LIMIT 20;
```

## api_errors

**Erros de API por rota.** Quais chamadas à API estão falhando para o cliente?

- **View:** `bi.v1_api_errors` · **Granularidade:** dia × rota × método × código × origem do registro
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `occurrences`
- **Não somar:** `visitors` (contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez)

**Cuidados**

- from_server = true são erros 5xx registrados pelo servidor, sem ligação com a visita.

**Exemplo**

```sql
SELECT endpoint, error_code, sum(occurrences) AS vezes FROM bi.v1_api_errors WHERE date_sp >= current_date - 7 GROUP BY 1, 2 ORDER BY 3 DESC;
```

## price_history

**Histórico de preço.** Como o preço e o estoque de cada produto mudaram ao longo do tempo?

- **View:** `bi.v1_price_history` · **Granularidade:** dia × produto
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** nada (valores por produto/dia)
- **Não somar:** `price` (preço unitário); `compare_at_price` (preço unitário); `stock_total` (retrato do dia)

**Cuidados**

- O histórico começa quando a medição entra no ar.

**Exemplo**

```sql
SELECT date_sp, price, stock_total FROM bi.v1_price_history WHERE product_name ILIKE '%Luz da Lua%' ORDER BY date_sp;
```

## sales

**Vendas por item.** O que foi vendido, por quanto e com que margem?

- **View:** `bi.v1_sales` · **Granularidade:** pedido × item
- **Período:** filtre por `date_sp` (API: `from` e `to`)
- **Pode somar:** `quantity`, `line_revenue`
- **Não somar:** `unit_price` (preço unitário); `margin_pct` (razão calculada por linha: some os numeradores e denominadores e divida de novo)

**Cuidados**

- Inclui pedidos cancelados (status CANCELED): filtre conforme a análise.
- Não traz dados do cliente.

**Exemplo**

```sql
SELECT category, sum(line_revenue) AS receita, sum(quantity) AS unidades FROM bi.v1_sales WHERE status <> 'CANCELED' AND date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC;
```

