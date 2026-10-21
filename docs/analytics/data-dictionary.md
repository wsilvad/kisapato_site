<!-- Gerado por `npm run analytics:docs -w @ki-sapato/api`. Não edite à mão: mude o código e gere de novo. -->

# Dicionário de dados (esquema `bi`)

Lido dos `COMMENT` do banco. **Medida** soma = pode somar linhas; **medida (não somar)** = razão, percentual, rank ou contagem de distintos; **dimensão** = para agrupar e filtrar.

## bi.v1_products

Dimensão de produtos (1 linha por produto, estado atual). Junte pelas colunas product_id das outras views.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `product_id` | text | dimensão | Id do produto (products.id). |
| `product_name` | text | dimensão | Nome exibido na loja. |
| `slug` | text | dimensão | Endereço do produto na loja. |
| `reference` | text | dimensão | Referência do fornecedor, quando houver. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca (nula se o produto não tem marca). |
| `active` | boolean | dimensão | Produto ativo na loja. |
| `price` | numeric(10,2) | medida (não somar: preço unitário) | Preço atual em reais. |
| `compare_at_price` | numeric(10,2) | medida (não somar: preço unitário) | Preço "de" (riscado) em reais, se houver. |
| `badge` | text | dimensão | Selo: LANCAMENTO, PROMOCAO, DESTAQUE ou nulo. |
| `stock_total` | integer | medida (soma) | Unidades em estoque somando todas as numerações. |

## bi.v1_traffic_daily

Visitas por dia × aparelho × origem. Granularidade: date_sp × device_type × source.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia da visita (fuso de Brasília). |
| `device_type` | text | dimensão | mobile, tablet, desktop ou desconhecido. |
| `source` | text | dimensão | Origem: utm_source, domínio de origem ou "direto". |
| `sessions` | integer | medida (soma) | Visitas (30 minutos de inatividade encerram uma visita). |
| `visitors` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes anônimos distintos. |
| `new_visitors` | integer | medida (não somar: visitantes que apareceram pela 1ª vez no dia; somar dias é válido, mas some entre origens só dentro do mesmo dia e aparelho) | Visitantes cuja primeira aparição foi neste dia. |
| `page_views` | integer | medida (soma) | Páginas abertas. |
| `sessions_with_product_view` | integer | medida (soma) | Visitas que abriram ao menos um produto. |
| `sessions_with_issues` | integer | medida (soma) | Visitas com erro, cliques repetidos, 404 ou imagem quebrada. |
| `bounced_sessions` | integer | medida (soma) | Visitas de uma página só, sem ver produto nem usar a sacola. |

## bi.v1_page_ranking

O que mais se acessa. Granularidade: date_sp × path.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `path` | text | dimensão | Caminho da página (ids viram :id). |
| `page_views` | integer | medida (soma) | Páginas abertas. |
| `visitors` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes distintos. |

## bi.v1_search_terms

O que buscam e o que não encontram. Granularidade: date_sp × search_term (minúsculo).

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `search_term` | text | dimensão | Termo buscado, sem dados pessoais. |
| `searches` | integer | medida (soma) | Buscas. |
| `visitors` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes distintos. |
| `avg_results` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Média de resultados devolvidos. |
| `zero_result_searches` | integer | medida (soma) | Buscas que não trouxeram nenhum produto. |

## bi.v1_funnel

Funil de compra por sessão. Granularidade: date_sp × device_type × source × step_order. Hoje é atualizado a cada 15 minutos. O passo "Escolheu pagamento" só existe quando o checkout com pagamento estiver no ar.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `device_type` | text | dimensão | mobile, tablet, desktop ou desconhecido. |
| `source` | text | dimensão | Origem da visita. |
| `step_order` | integer | dimensão | Ordem da etapa (1 a 6). |
| `step` | text | dimensão | Nome da etapa. |
| `sessions` | integer | medida (soma) | Visitas que chegaram à etapa. |
| `sessions_previous_step` | integer | medida (soma) | Visitas na etapa anterior. |
| `pct_of_previous_step` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | % que passou da etapa anterior para esta. |
| `pct_of_visits` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | % das visitas que chegou a esta etapa. |

## bi.v1_abandoned_carts

Carrinhos com itens parados há mais de abandon_hours (padrão 24 h) e sem compra depois. Um por visitante (últimos 30 dias). Compra sem os cabeçalhos da visita não é ligada ao visitante.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `visitor_key` | text | dimensão | Identificador pseudonimizado do visitante (não é dado pessoal). |
| `date_sp` | date | dimensão | Dia da última mudança na sacola. |
| `last_update` | timestamp with time zone | dimensão | Última mudança na sacola. |
| `hours_since` | numeric | medida (não somar: idade do retrato) | Horas desde a última mudança. |
| `cart_value` | numeric(10,2) | medida (soma) | Valor da sacola em reais. |
| `items_count` | integer | medida (soma) | Linhas (variações) na sacola. |
| `device_type` | text | dimensão | Aparelho. |
| `stage` | text | dimensão | checkout se entrou no checkout depois de montar a sacola; senão sacola. |

## bi.v1_cart_items

Itens das sacolas mais recentes (últimos 30 dias), um por linha. abandoned = parado há mais de abandon_hours e sem compra depois. product_id pode ser o slug em sacolas antigas, de antes da medição.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `visitor_key` | text | dimensão | Identificador pseudonimizado do visitante. |
| `date_sp` | date | dimensão | Dia da última mudança na sacola. |
| `product_id` | text | dimensão | Id do produto (ou slug em sacolas antigas). |
| `variant_id` | text | dimensão | Variação (cor + numeração). |
| `item_name` | text | dimensão | Nome do produto. |
| `price` | numeric(10,2) | medida (não somar: preço unitário) | Preço unitário em reais. |
| `quantity` | integer | medida (soma) | Quantidade. |
| `line_value` | numeric(10,2) | medida (soma) | price × quantity. |
| `abandoned` | boolean | dimensão | Sacola abandonada (ver view bi.v1_abandoned_carts). |

## bi.v1_cart_add_remove

Itens colocados e retirados da sacola. Granularidade: date_sp × product_id. Hoje é atualizado a cada 15 minutos.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome do produto. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca. |
| `adds` | integer | medida (soma) | Vezes que foi colocado na sacola. |
| `removes` | integer | medida (soma) | Vezes que foi retirado da sacola. |
| `remove_rate` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | removes ÷ adds (pode passar de 1 se a sacola veio de outro dia). |

## bi.v1_product_engagement

Cliques, visualizações, favoritos e vendas por produto e dia. Granularidade: date_sp × product_id. Hoje é atualizado a cada 15 minutos.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome do produto. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca. |
| `impressions` | integer | medida (soma) | Vezes que o card apareceu em listas. |
| `clicks` | integer | medida (soma) | Cliques no card. |
| `ctr` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | clicks ÷ impressions. |
| `views` | integer | medida (soma) | Aberturas da página do produto. |
| `unique_viewers` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez (a soma por dia conta quem volta em outro dia de novo)) | Visitantes distintos que abriram o produto. |
| `adds` | integer | medida (soma) | Colocações na sacola. |
| `fav_adds` | integer | medida (soma) | Favoritos adicionados. |
| `fav_removes` | integer | medida (soma) | Favoritos removidos. |
| `fav_net` | integer | medida (soma) | fav_adds − fav_removes. |
| `orders` | integer | medida (soma) | Pedidos não cancelados com o produto. |
| `units` | integer | medida (soma) | Unidades vendidas. |
| `revenue` | numeric(12,2) | medida (soma) | Receita em reais. |
| `margin_pct` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Margem do dia em % da receita. |

## bi.v1_product_scorecard

Índice de destaque (0 a 100) por produto ativo, na janela de window_days (padrão 30). Ranks são percentuais dentro da categoria (0 a 1). Pesos em analytics.settings. hidden_gem: converte no top 25% da categoria e aparece no 25% de baixo. Com enough_data = false o número é frágil (poucas visualizações).

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca. |
| `price` | numeric(10,2) | medida (não somar: preço unitário) | Preço atual. |
| `margin_pct` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Margem atual em % do preço (nula se o custo é desconhecido). |
| `in_stock_sizes` | integer | medida (não somar: estado atual do produto) | Numerações com estoque. |
| `total_sizes` | integer | medida (não somar: estado atual do produto) | Numerações cadastradas. |
| `impressions` | integer | medida (soma) | Exibições em listas na janela. |
| `clicks` | integer | medida (soma) | Cliques na janela. |
| `ctr` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | clicks ÷ impressions. |
| `views` | integer | medida (soma) | Aberturas da página do produto. |
| `unique_viewers` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes distintos (soma por dia). |
| `adds` | integer | medida (soma) | Colocações na sacola. |
| `fav_adds` | integer | medida (soma) | Favoritos adicionados. |
| `orders` | integer | medida (soma) | Pedidos. |
| `conversion_rate` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | orders ÷ views. |
| `demand_rank` | numeric | medida (não somar: rank percentual dentro da categoria (0 a 1)) | Rank da demanda na categoria (0 a 1). |
| `interest_rank` | numeric | medida (não somar: rank percentual (0 a 1)) | Rank do interesse (CTR e adição à sacola). |
| `conversion_rank` | numeric | medida (não somar: rank percentual (0 a 1)) | Rank da conversão. |
| `margin_rank` | numeric | medida (não somar: rank percentual (0 a 1)) | Rank da margem. |
| `exposure_rank` | numeric | medida (não somar: rank percentual (0 a 1)) | Rank da exposição (impressions). |
| `availability` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | in_stock_sizes ÷ total_sizes. |
| `score` | numeric | medida (não somar: índice 0 a 100) | Índice de destaque de 0 a 100. |
| `hidden_gem` | boolean | dimensão | Joia escondida: converte bem, aparece pouco. |
| `enough_data` | boolean | dimensão | Visualizações suficientes (min_views) para confiar no número. |
| `window_days` | integer | medida (não somar: parâmetro da janela (igual em todas as linhas)) | Janela usada, em dias. |

## bi.v1_price_opportunity

Produtos com interesse sem conversão: visualizações suficientes, demanda acima da mediana da categoria, conversão no 25% de baixo e sinais de intenção (sacola, favorito ou visitas repetidas). max_discount_pct é o maior desconto que preserva a margem mínima (analytics.settings.min_margin); nulo se o custo é desconhecido. É sinal para investigar (frete, estoque, foto também pesam), não prova de que preço é o motivo.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca. |
| `price` | numeric(10,2) | medida (não somar: preço unitário) | Preço atual. |
| `margin_pct` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Margem atual em % do preço. |
| `views` | integer | medida (soma) | Visualizações na janela. |
| `unique_viewers` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes distintos. |
| `adds` | integer | medida (soma) | Colocações na sacola. |
| `fav_adds` | integer | medida (soma) | Favoritos adicionados. |
| `repeat_viewers` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes que abriram o produto 2 vezes ou mais. |
| `orders` | integer | medida (soma) | Pedidos. |
| `adds_not_bought` | integer | medida (soma) | adds − orders (aproximação de intenção sem compra). |
| `conversion_rate` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | orders ÷ views. |
| `conversion_rank` | numeric | medida (não somar: rank percentual dentro da categoria (0 a 1)) | Rank da conversão na categoria (0 a 1). |
| `max_discount_pct` | numeric | medida (não somar: desconto máximo por produto) | Maior desconto que mantém a margem mínima (nulo sem custo). |
| `cost_known` | boolean | dimensão | O custo do produto está cadastrado. |
| `on_sale` | boolean | dimensão | Já está em promoção (tem preço "de"). |
| `stock_total` | integer | medida (soma) | Unidades em estoque. |
| `days_since_last_sale` | integer | medida (não somar: estado atual do produto) | Dias desde a última venda (nulo se nunca vendeu). |
| `price_window_start` | numeric(10,2) | medida (não somar: preço unitário) | Preço no início da janela, do histórico diário (nulo se não há histórico). |
| `price_change_pct` | numeric | medida (não somar: variação por produto) | Variação do preço na janela, em %. |
| `min_margin_used` | numeric(4,2) | medida (não somar: parâmetro (igual em todas as linhas)) | Margem mínima usada no cálculo. |

## bi.v1_experience_issues

Erros, cliques repetidos e velocidade por página e dia. Granularidade: date_sp × path. Hoje é atualizado a cada 15 minutos. Percentis só existem se houve medições.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `path` | text | dimensão | Caminho da página. |
| `page_views` | integer | medida (soma) | Páginas abertas. |
| `js_errors` | integer | medida (soma) | Erros de JavaScript. |
| `api_errors` | integer | medida (soma) | Chamadas à API que falharam (4xx exceto 401, 5xx ou rede). |
| `rage_clicks` | integer | medida (soma) | Cliques repetidos (3+ em 1 s no mesmo ponto). |
| `form_errors` | integer | medida (soma) | Campos recusados pela validação do navegador. |
| `not_found` | integer | medida (soma) | Páginas 404. |
| `image_errors` | integer | medida (soma) | Imagens que não carregaram. |
| `issues_per_1k_views` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Problemas por mil páginas abertas. |
| `lcp_p75_ms` | numeric | medida (não somar: percentil: não se soma nem se tira média sem peso) | Maior elemento visível (LCP), percentil 75, em ms. Bom ≤ 2500. |
| `inp_p75_ms` | numeric | medida (não somar: percentil) | Resposta a interações (INP), percentil 75, em ms. Bom ≤ 200. |
| `cls_p75` | numeric | medida (não somar: percentil) | Mudança de layout (CLS), percentil 75. Bom ≤ 0,1. |
| `lcp_rating` | text | medida (não somar: classificação) | good, needs-improvement ou poor (pelo LCP). |

## bi.v1_api_errors

Erros de API por rota. Granularidade: date_sp × endpoint × method × error_code × from_server.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia (fuso de Brasília). |
| `endpoint` | text | dimensão | Rota da API sem ids. |
| `method` | text | dimensão | GET, POST… |
| `error_code` | text | dimensão | Código HTTP ou "network". |
| `from_server` | boolean | dimensão | Registrado pelo servidor (erro 5xx) e não pelo navegador. |
| `occurrences` | integer | medida (soma) | Ocorrências. |
| `visitors` | integer | medida (não somar: contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez) | Visitantes distintos (o servidor, sem cabeçalhos, conta como um só). |

## bi.v1_price_history

Retrato diário de preço e estoque por produto (começa quando a medição entra no ar). Granularidade: date_sp × product_id.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia do retrato (fuso de Brasília). |
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome. |
| `price` | numeric(10,2) | medida (não somar: preço unitário) | Preço em reais. |
| `compare_at_price` | numeric(10,2) | medida (não somar: preço unitário) | Preço "de" em reais. |
| `stock_total` | integer | medida (não somar: retrato do dia) | Estoque somado. |

## bi.v1_sales

Itens vendidos (um por linha de pedido), sem dados do cliente. Granularidade: order_id × item. Inclui pedidos cancelados (status CANCELED): filtre conforme a análise.

| Coluna | Tipo | Papel | Descrição |
|---|---|---|---|
| `date_sp` | date | dimensão | Dia do pedido (fuso de Brasília). |
| `order_id` | text | dimensão | Id do pedido. |
| `status` | text | dimensão | PENDING, PAID, PICKING, SHIPPED, DELIVERED ou CANCELED. |
| `product_id` | text | dimensão | Id do produto. |
| `product_name` | text | dimensão | Nome. |
| `category` | text | dimensão | Categoria. |
| `brand` | text | dimensão | Marca. |
| `color` | text | dimensão | Cor. |
| `size` | text | dimensão | Numeração ou tamanho. |
| `quantity` | integer | medida (soma) | Quantidade. |
| `unit_price` | numeric(10,2) | medida (não somar: preço unitário) | Preço unitário na venda. |
| `line_revenue` | numeric(12,2) | medida (soma) | Receita da linha em reais. |
| `margin_pct` | numeric | medida (não somar: razão calculada por linha: some os numeradores e denominadores e divida de novo) | Margem da linha em % do preço (nula sem custo). |

