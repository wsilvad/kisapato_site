# LookML gerado das views bi.v1_* (ponto de partida; ver docs/analytics/README.md).

view: v1_products {
  sql_table_name: bi.v1_products ;;
  label: "Produtos (dimensão)"
  description: "Quais produtos existem, em que categoria e marca, a que preço e com quanto estoque? (1 linha por produto (estado atual))"

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto (products.id)."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome exibido na loja."
  }

  dimension: slug {
    type: string
    sql: ${TABLE}.slug ;;
    description: "Endereço do produto na loja."
  }

  dimension: reference {
    type: string
    sql: ${TABLE}.reference ;;
    description: "Referência do fornecedor, quando houver."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca (nula se o produto não tem marca)."
  }

  dimension: active {
    type: yesno
    sql: ${TABLE}.active ;;
    description: "Produto ativo na loja."
  }

  dimension: badge {
    type: string
    sql: ${TABLE}.badge ;;
    description: "Selo: LANCAMENTO, PROMOCAO, DESTAQUE ou nulo."
  }

  measure: total_stock_total {
    type: sum
    sql: ${TABLE}.stock_total ;;
    description: "Unidades em estoque somando todas as numerações."
  }
}

view: v1_traffic_daily {
  sql_table_name: bi.v1_traffic_daily ;;
  label: "Tráfego por dia"
  description: "Quanta gente acessa o site, de onde vem e em que aparelho? (dia × aparelho × origem)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia da visita (fuso de Brasília)."
  }

  dimension: device_type {
    type: string
    sql: ${TABLE}.device_type ;;
    description: "mobile, tablet, desktop ou desconhecido."
  }

  dimension: source {
    type: string
    sql: ${TABLE}.source ;;
    description: "Origem: utm_source, domínio de origem ou 'direto'."
  }

  measure: total_sessions {
    type: sum
    sql: ${TABLE}.sessions ;;
    description: "Visitas (30 minutos de inatividade encerram uma visita)."
  }

  measure: total_page_views {
    type: sum
    sql: ${TABLE}.page_views ;;
    description: "Páginas abertas."
  }

  measure: total_sessions_with_product_view {
    type: sum
    sql: ${TABLE}.sessions_with_product_view ;;
    description: "Visitas que abriram ao menos um produto."
  }

  measure: total_sessions_with_issues {
    type: sum
    sql: ${TABLE}.sessions_with_issues ;;
    description: "Visitas com erro, cliques repetidos, 404 ou imagem quebrada."
  }

  measure: total_bounced_sessions {
    type: sum
    sql: ${TABLE}.bounced_sessions ;;
    description: "Visitas de uma página só, sem ver produto nem usar a sacola."
  }
}

view: v1_page_ranking {
  sql_table_name: bi.v1_page_ranking ;;
  label: "Páginas mais acessadas"
  description: "O que o cliente mais acessa? (dia × caminho)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: path {
    type: string
    sql: ${TABLE}.path ;;
    description: "Caminho da página (ids viram :id)."
  }

  measure: total_page_views {
    type: sum
    sql: ${TABLE}.page_views ;;
    description: "Páginas abertas."
  }
}

view: v1_search_terms {
  sql_table_name: bi.v1_search_terms ;;
  label: "Termos buscados"
  description: "O que o cliente busca e o que não encontra? (dia × termo)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: search_term {
    type: string
    sql: ${TABLE}.search_term ;;
    description: "Termo buscado, sem dados pessoais."
  }

  measure: total_searches {
    type: sum
    sql: ${TABLE}.searches ;;
    description: "Buscas."
  }

  measure: total_zero_result_searches {
    type: sum
    sql: ${TABLE}.zero_result_searches ;;
    description: "Buscas que não trouxeram nenhum produto."
  }
}

view: v1_funnel {
  sql_table_name: bi.v1_funnel ;;
  label: "Funil de compra"
  description: "Em que etapa o cliente desiste antes de comprar? (dia × aparelho × origem × etapa)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: device_type {
    type: string
    sql: ${TABLE}.device_type ;;
    description: "mobile, tablet, desktop ou desconhecido."
  }

  dimension: source {
    type: string
    sql: ${TABLE}.source ;;
    description: "Origem da visita."
  }

  dimension: step_order {
    type: number
    sql: ${TABLE}.step_order ;;
    description: "Ordem da etapa (1 a 6)."
  }

  dimension: step {
    type: string
    sql: ${TABLE}.step ;;
    description: "Nome da etapa."
  }

  measure: total_sessions {
    type: sum
    sql: ${TABLE}.sessions ;;
    description: "Visitas que chegaram à etapa."
  }

  measure: total_sessions_previous_step {
    type: sum
    sql: ${TABLE}.sessions_previous_step ;;
    description: "Visitas na etapa anterior."
  }
}

view: v1_abandoned_carts {
  sql_table_name: bi.v1_abandoned_carts ;;
  label: "Carrinhos abandonados"
  description: "Quanto dinheiro está parado em sacolas que não viraram compra? (1 linha por visitante com sacola abandonada (últimos 30 dias))"

  dimension: visitor_key {
    type: string
    sql: ${TABLE}.visitor_key ;;
    description: "Identificador pseudonimizado do visitante (não é dado pessoal)."
  }

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia da última mudança na sacola."
  }

  dimension: last_update {
    type: time
    sql: ${TABLE}.last_update ;;
    description: "Última mudança na sacola."
  }

  dimension: device_type {
    type: string
    sql: ${TABLE}.device_type ;;
    description: "Aparelho."
  }

  dimension: stage {
    type: string
    sql: ${TABLE}.stage ;;
    description: "checkout se entrou no checkout depois de montar a sacola; senão sacola."
  }

  measure: total_cart_value {
    type: sum
    sql: ${TABLE}.cart_value ;;
    description: "Valor da sacola em reais."
  }

  measure: total_items_count {
    type: sum
    sql: ${TABLE}.items_count ;;
    description: "Linhas (variações) na sacola."
  }
}

view: v1_cart_items {
  sql_table_name: bi.v1_cart_items ;;
  label: "Itens das sacolas"
  description: "Quais itens ficam nas sacolas e não são comprados? (visitante × item da sacola mais recente (últimos 30 dias))"

  dimension: visitor_key {
    type: string
    sql: ${TABLE}.visitor_key ;;
    description: "Identificador pseudonimizado do visitante."
  }

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia da última mudança na sacola."
  }

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto (ou slug em sacolas antigas)."
    primary_key: no
  }

  dimension: variant_id {
    type: string
    sql: ${TABLE}.variant_id ;;
    description: "Variação (cor + numeração)."
  }

  dimension: item_name {
    type: string
    sql: ${TABLE}.item_name ;;
    description: "Nome do produto."
  }

  dimension: abandoned {
    type: yesno
    sql: ${TABLE}.abandoned ;;
    description: "Sacola abandonada (ver view bi.v1_abandoned_carts)."
  }

  measure: total_quantity {
    type: sum
    sql: ${TABLE}.quantity ;;
    description: "Quantidade."
  }

  measure: total_line_value {
    type: sum
    sql: ${TABLE}.line_value ;;
    description: "price × quantity."
  }
}

view: v1_cart_add_remove {
  sql_table_name: bi.v1_cart_add_remove ;;
  label: "Colocado e retirado da sacola"
  description: "Quais produtos o cliente coloca e depois tira da sacola? (dia × produto)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome do produto."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca."
  }

  measure: total_adds {
    type: sum
    sql: ${TABLE}.adds ;;
    description: "Vezes que foi colocado na sacola."
  }

  measure: total_removes {
    type: sum
    sql: ${TABLE}.removes ;;
    description: "Vezes que foi retirado da sacola."
  }
}

view: v1_product_engagement {
  sql_table_name: bi.v1_product_engagement ;;
  label: "Engajamento por produto"
  description: "Quais itens têm mais cliques, visualizações, favoritos e vendas? (dia × produto)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome do produto."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca."
  }

  measure: total_impressions {
    type: sum
    sql: ${TABLE}.impressions ;;
    description: "Vezes que o card apareceu em listas."
  }

  measure: total_clicks {
    type: sum
    sql: ${TABLE}.clicks ;;
    description: "Cliques no card."
  }

  measure: total_views {
    type: sum
    sql: ${TABLE}.views ;;
    description: "Aberturas da página do produto."
  }

  measure: total_adds {
    type: sum
    sql: ${TABLE}.adds ;;
    description: "Colocações na sacola."
  }

  measure: total_fav_adds {
    type: sum
    sql: ${TABLE}.fav_adds ;;
    description: "Favoritos adicionados."
  }

  measure: total_fav_removes {
    type: sum
    sql: ${TABLE}.fav_removes ;;
    description: "Favoritos removidos."
  }

  measure: total_fav_net {
    type: sum
    sql: ${TABLE}.fav_net ;;
    description: "fav_adds − fav_removes."
  }

  measure: total_orders {
    type: sum
    sql: ${TABLE}.orders ;;
    description: "Pedidos não cancelados com o produto."
  }

  measure: total_units {
    type: sum
    sql: ${TABLE}.units ;;
    description: "Unidades vendidas."
  }

  measure: total_revenue {
    type: sum
    sql: ${TABLE}.revenue ;;
    description: "Receita em reais."
  }
}

view: v1_product_scorecard {
  sql_table_name: bi.v1_product_scorecard ;;
  label: "Índice de destaque"
  description: "Quais itens merecem destaque na loja? (1 linha por produto ativo (janela móvel))"

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca."
  }

  dimension: hidden_gem {
    type: yesno
    sql: ${TABLE}.hidden_gem ;;
    description: "Joia escondida: converte bem, aparece pouco."
  }

  dimension: enough_data {
    type: yesno
    sql: ${TABLE}.enough_data ;;
    description: "Visualizações suficientes (min_views) para confiar no número."
  }

  measure: total_impressions {
    type: sum
    sql: ${TABLE}.impressions ;;
    description: "Exibições em listas na janela."
  }

  measure: total_clicks {
    type: sum
    sql: ${TABLE}.clicks ;;
    description: "Cliques na janela."
  }

  measure: total_views {
    type: sum
    sql: ${TABLE}.views ;;
    description: "Aberturas da página do produto."
  }

  measure: total_adds {
    type: sum
    sql: ${TABLE}.adds ;;
    description: "Colocações na sacola."
  }

  measure: total_fav_adds {
    type: sum
    sql: ${TABLE}.fav_adds ;;
    description: "Favoritos adicionados."
  }

  measure: total_orders {
    type: sum
    sql: ${TABLE}.orders ;;
    description: "Pedidos."
  }
}

view: v1_price_opportunity {
  sql_table_name: bi.v1_price_opportunity ;;
  label: "Oportunidade de preço"
  description: "Quais itens o cliente olha, mas não compra, e quanto de desconto cabe mantendo a margem mínima? (1 linha por produto candidato (janela móvel))"

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca."
  }

  dimension: cost_known {
    type: yesno
    sql: ${TABLE}.cost_known ;;
    description: "O custo do produto está cadastrado."
  }

  dimension: on_sale {
    type: yesno
    sql: ${TABLE}.on_sale ;;
    description: "Já está em promoção (tem preço 'de')."
  }

  measure: total_views {
    type: sum
    sql: ${TABLE}.views ;;
    description: "Visualizações na janela."
  }

  measure: total_adds {
    type: sum
    sql: ${TABLE}.adds ;;
    description: "Colocações na sacola."
  }

  measure: total_fav_adds {
    type: sum
    sql: ${TABLE}.fav_adds ;;
    description: "Favoritos adicionados."
  }

  measure: total_orders {
    type: sum
    sql: ${TABLE}.orders ;;
    description: "Pedidos."
  }

  measure: total_adds_not_bought {
    type: sum
    sql: ${TABLE}.adds_not_bought ;;
    description: "adds − orders (aproximação de intenção sem compra)."
  }

  measure: total_stock_total {
    type: sum
    sql: ${TABLE}.stock_total ;;
    description: "Unidades em estoque."
  }
}

view: v1_experience_issues {
  sql_table_name: bi.v1_experience_issues ;;
  label: "Qualidade da experiência"
  description: "Onde o cliente está tendo uma experiência ruim (erros, lentidão, cliques repetidos)? (dia × página)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: path {
    type: string
    sql: ${TABLE}.path ;;
    description: "Caminho da página."
  }

  measure: total_page_views {
    type: sum
    sql: ${TABLE}.page_views ;;
    description: "Páginas abertas."
  }

  measure: total_js_errors {
    type: sum
    sql: ${TABLE}.js_errors ;;
    description: "Erros de JavaScript."
  }

  measure: total_api_errors {
    type: sum
    sql: ${TABLE}.api_errors ;;
    description: "Chamadas à API que falharam (4xx exceto 401, 5xx ou rede)."
  }

  measure: total_rage_clicks {
    type: sum
    sql: ${TABLE}.rage_clicks ;;
    description: "Cliques repetidos (3+ em 1 s no mesmo ponto)."
  }

  measure: total_form_errors {
    type: sum
    sql: ${TABLE}.form_errors ;;
    description: "Campos recusados pela validação do navegador."
  }

  measure: total_not_found {
    type: sum
    sql: ${TABLE}.not_found ;;
    description: "Páginas 404."
  }

  measure: total_image_errors {
    type: sum
    sql: ${TABLE}.image_errors ;;
    description: "Imagens que não carregaram."
  }
}

view: v1_api_errors {
  sql_table_name: bi.v1_api_errors ;;
  label: "Erros de API por rota"
  description: "Quais chamadas à API estão falhando para o cliente? (dia × rota × método × código × origem do registro)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia (fuso de Brasília)."
  }

  dimension: endpoint {
    type: string
    sql: ${TABLE}.endpoint ;;
    description: "Rota da API sem ids."
  }

  dimension: method {
    type: string
    sql: ${TABLE}.method ;;
    description: "GET, POST…"
  }

  dimension: error_code {
    type: string
    sql: ${TABLE}.error_code ;;
    description: "Código HTTP ou 'network'."
  }

  dimension: from_server {
    type: yesno
    sql: ${TABLE}.from_server ;;
    description: "Registrado pelo servidor (erro 5xx) e não pelo navegador."
  }

  measure: total_occurrences {
    type: sum
    sql: ${TABLE}.occurrences ;;
    description: "Ocorrências."
  }
}

view: v1_price_history {
  sql_table_name: bi.v1_price_history ;;
  label: "Histórico de preço"
  description: "Como o preço e o estoque de cada produto mudaram ao longo do tempo? (dia × produto)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia do retrato (fuso de Brasília)."
  }

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome."
  }
}

view: v1_sales {
  sql_table_name: bi.v1_sales ;;
  label: "Vendas por item"
  description: "O que foi vendido, por quanto e com que margem? (pedido × item)"

  dimension_group: date_sp {
    type: time
    timeframes: [date, week, month, year]
    datatype: date
    sql: ${TABLE}.date_sp ;;
    description: "Dia do pedido (fuso de Brasília)."
  }

  dimension: order_id {
    type: string
    sql: ${TABLE}.order_id ;;
    description: "Id do pedido."
  }

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
    description: "PENDING, PAID, PICKING, SHIPPED, DELIVERED ou CANCELED."
  }

  dimension: product_id {
    type: string
    sql: ${TABLE}.product_id ;;
    description: "Id do produto."
    primary_key: no
  }

  dimension: product_name {
    type: string
    sql: ${TABLE}.product_name ;;
    description: "Nome."
  }

  dimension: category {
    type: string
    sql: ${TABLE}.category ;;
    description: "Categoria."
  }

  dimension: brand {
    type: string
    sql: ${TABLE}.brand ;;
    description: "Marca."
  }

  dimension: color {
    type: string
    sql: ${TABLE}.color ;;
    description: "Cor."
  }

  dimension: size {
    type: string
    sql: ${TABLE}.size ;;
    description: "Numeração ou tamanho."
  }

  measure: total_quantity {
    type: sum
    sql: ${TABLE}.quantity ;;
    description: "Quantidade."
  }

  measure: total_line_revenue {
    type: sum
    sql: ${TABLE}.line_revenue ;;
    description: "Receita da linha em reais."
  }
}
