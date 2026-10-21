/**
 * Registro das métricas abertas a BI e a agentes de IA. Cada métrica é uma view do esquema bi (contrato versionado).
 * As colunas e seus significados vêm dos COMMENT do banco; aqui ficam a pergunta de negócio, a granularidade, o que pode ser somado e os
 * cuidados de leitura. Daqui saem a API de métricas, o servidor MCP, o catálogo (docs/analytics/metrics-catalog.md), a camada
 * semântica (semantic-layer.yaml), o OpenAPI e os painéis de partida.
 */
export interface MetricDef {
  name: string;
  view: string;
  title: string;
  /** A pergunta de negócio que a métrica responde. */
  question: string;
  grain: string;
  /** Coluna de data (fuso de Brasília) usada por from/to; ausente = retrato atual, sem filtro de período. */
  dateColumn?: string;
  defaultOrder: string;
  /** Colunas que podem ser somadas entre linhas. */
  additive: readonly string[];
  /** Colunas que NÃO podem ser somadas, com o motivo (razões, ranks, contagens distintas…). */
  nonAdditive: Readonly<Record<string, string>>;
  /** Colunas numéricas que são dimensões (ordem de etapa, janela em dias…), e não medidas. */
  numericDimensions?: readonly string[];
  /** Como ler e o que pode enganar. */
  caveats: readonly string[];
  /** Exemplo de uso em SQL (esquema bi). */
  exampleSql: string;
}

const RATIO = "razão calculada por linha: some os numeradores e denominadores e divida de novo";
const DISTINCT = "contagem de distintos: somar entre linhas conta a mesma pessoa mais de uma vez";

export const METRICS: readonly MetricDef[] = [
  {
    name: "products", view: "bi.v1_products", title: "Produtos (dimensão)", question: "Quais produtos existem, em que categoria e marca, a que preço e com quanto estoque?",
    grain: "1 linha por produto (estado atual)", defaultOrder: "product_name", additive: ["stock_total"], nonAdditive: { price: "preço unitário", compare_at_price: "preço unitário" },
    caveats: ["Use para juntar nomes, categorias e marcas às outras views pelo product_id."],
    exampleSql: "SELECT category, count(*) AS produtos, sum(stock_total) AS estoque FROM bi.v1_products WHERE active GROUP BY 1 ORDER BY 3 DESC;",
  },
  {
    name: "traffic_daily", view: "bi.v1_traffic_daily", title: "Tráfego por dia", question: "Quanta gente acessa o site, de onde vem e em que aparelho?",
    grain: "dia × aparelho × origem", dateColumn: "date_sp", defaultOrder: "date_sp DESC, sessions DESC",
    additive: ["sessions", "page_views", "sessions_with_product_view", "sessions_with_issues", "bounced_sessions"],
    nonAdditive: { visitors: DISTINCT, new_visitors: "visitantes que apareceram pela 1ª vez no dia; somar dias é válido, mas some entre origens só dentro do mesmo dia e aparelho" },
    caveats: ["Visita = sequência de eventos com até 30 minutos de intervalo.", "Origem é utm_source, o domínio de origem ou 'direto'.", "Robôs e quem ativou 'Não rastrear' ficam de fora."],
    exampleSql: "SELECT date_sp, sum(sessions) AS visitas, sum(page_views) AS paginas FROM bi.v1_traffic_daily WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 1;",
  },
  {
    name: "page_ranking", view: "bi.v1_page_ranking", title: "Páginas mais acessadas", question: "O que o cliente mais acessa?",
    grain: "dia × caminho", dateColumn: "date_sp", defaultOrder: "date_sp DESC, page_views DESC", additive: ["page_views"], nonAdditive: { visitors: DISTINCT },
    caveats: ["Caminhos de produto têm o slug; ids longos viram :id."],
    exampleSql: "SELECT path, sum(page_views) AS vistas FROM bi.v1_page_ranking WHERE date_sp >= current_date - 7 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;",
  },
  {
    name: "search_terms", view: "bi.v1_search_terms", title: "Termos buscados", question: "O que o cliente busca e o que não encontra?",
    grain: "dia × termo", dateColumn: "date_sp", defaultOrder: "date_sp DESC, searches DESC", additive: ["searches", "zero_result_searches"], nonAdditive: { visitors: DISTINCT, avg_results: RATIO },
    caveats: ["E-mail, CPF e telefone digitados viram [removido].", "Termos com poucas buscas são ruído: veja o total no período."],
    exampleSql: "SELECT search_term, sum(searches) AS buscas, sum(zero_result_searches) AS sem_resultado FROM bi.v1_search_terms WHERE date_sp >= current_date - 30 GROUP BY 1 HAVING sum(zero_result_searches) > 0 ORDER BY 3 DESC LIMIT 20;",
  },
  {
    name: "funnel", view: "bi.v1_funnel", title: "Funil de compra", question: "Em que etapa o cliente desiste antes de comprar?",
    grain: "dia × aparelho × origem × etapa", dateColumn: "date_sp", defaultOrder: "date_sp DESC, step_order", additive: ["sessions", "sessions_previous_step"],
    nonAdditive: { pct_of_previous_step: RATIO, pct_of_visits: RATIO }, numericDimensions: ["step_order"],
    caveats: ["Some sessions por etapa e depois calcule a taxa; não some os percentuais.", "A etapa 'Escolheu pagamento' só tem dados quando o checkout com pagamento estiver no ar.", "A compra é gravada pelo servidor; sem os cabeçalhos da visita ela não entra no funil."],
    exampleSql: "SELECT step_order, step, sum(sessions) AS sessoes FROM bi.v1_funnel WHERE date_sp >= current_date - 30 GROUP BY 1, 2 ORDER BY 1;",
  },
  {
    name: "abandoned_carts", view: "bi.v1_abandoned_carts", title: "Carrinhos abandonados", question: "Quanto dinheiro está parado em sacolas que não viraram compra?",
    grain: "1 linha por visitante com sacola abandonada (últimos 30 dias)", dateColumn: "date_sp", defaultOrder: "last_update DESC", additive: ["cart_value", "items_count"],
    nonAdditive: { hours_since: "idade do retrato" },
    caveats: ["Abandonado = sem mudança há mais de abandon_hours (padrão 24 h) e sem compra depois.", "visitor_key é pseudonimizado: não identifica ninguém.", "Compra sem os cabeçalhos da visita não é ligada ao visitante e pode deixar um carrinho como abandonado por engano."],
    exampleSql: "SELECT stage, count(*) AS carrinhos, sum(cart_value) AS valor FROM bi.v1_abandoned_carts GROUP BY 1;",
  },
  {
    name: "cart_items", view: "bi.v1_cart_items", title: "Itens das sacolas", question: "Quais itens ficam nas sacolas e não são comprados?",
    grain: "visitante × item da sacola mais recente (últimos 30 dias)", dateColumn: "date_sp", defaultOrder: "date_sp DESC", additive: ["quantity", "line_value"], nonAdditive: { price: "preço unitário" },
    caveats: ["Filtre abandoned = true para o que ficou parado.", "product_id pode ser o slug em sacolas criadas antes da medição."],
    exampleSql: "SELECT item_name, count(*) AS sacolas, sum(line_value) AS valor FROM bi.v1_cart_items WHERE abandoned GROUP BY 1 ORDER BY 3 DESC LIMIT 20;",
  },
  {
    name: "cart_add_remove", view: "bi.v1_cart_add_remove", title: "Colocado e retirado da sacola", question: "Quais produtos o cliente coloca e depois tira da sacola?",
    grain: "dia × produto", dateColumn: "date_sp", defaultOrder: "date_sp DESC, adds DESC", additive: ["adds", "removes"], nonAdditive: { remove_rate: RATIO },
    caveats: ["remove_rate pode passar de 1 quando a sacola foi montada em outro dia."],
    exampleSql: "SELECT product_name, sum(adds) AS adicionou, sum(removes) AS retirou, round(sum(removes)::numeric / nullif(sum(adds), 0), 2) AS taxa FROM bi.v1_cart_add_remove WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;",
  },
  {
    name: "product_engagement", view: "bi.v1_product_engagement", title: "Engajamento por produto", question: "Quais itens têm mais cliques, visualizações, favoritos e vendas?",
    grain: "dia × produto", dateColumn: "date_sp", defaultOrder: "date_sp DESC, views DESC",
    additive: ["impressions", "clicks", "views", "adds", "fav_adds", "fav_removes", "fav_net", "orders", "units", "revenue"],
    nonAdditive: { unique_viewers: DISTINCT + " (a soma por dia conta quem volta em outro dia de novo)", ctr: RATIO, margin_pct: RATIO },
    caveats: ["CTR = clicks ÷ impressions. Exibições são amostradas (1 por card e página, depois de 1 s visível).", "Vendas vêm dos pedidos não cancelados."],
    exampleSql: "SELECT product_name, sum(clicks) AS cliques, sum(impressions) AS exibicoes, round(sum(clicks)::numeric / nullif(sum(impressions), 0), 3) AS ctr FROM bi.v1_product_engagement WHERE date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC LIMIT 20;",
  },
  {
    name: "product_scorecard", view: "bi.v1_product_scorecard", title: "Índice de destaque", question: "Quais itens merecem destaque na loja?",
    grain: "1 linha por produto ativo (janela móvel)", defaultOrder: "score DESC",
    additive: ["impressions", "clicks", "views", "adds", "fav_adds", "orders"],
    nonAdditive: {
      score: "índice 0 a 100", ctr: RATIO, conversion_rate: RATIO, margin_pct: RATIO, unique_viewers: DISTINCT, price: "preço unitário", in_stock_sizes: "estado atual do produto", total_sizes: "estado atual do produto",
      demand_rank: "rank percentual dentro da categoria (0 a 1)", interest_rank: "rank percentual (0 a 1)", conversion_rank: "rank percentual (0 a 1)", margin_rank: "rank percentual (0 a 1)", exposure_rank: "rank percentual (0 a 1)",
      availability: RATIO, window_days: "parâmetro da janela (igual em todas as linhas)",
    },
    caveats: ["Ranks são percentuais dentro da categoria (0 a 1). Peso de cada sinal em analytics.settings.", "enough_data = false significa poucas visualizações: o número é frágil.", "hidden_gem: converte no top 25% da categoria e aparece no 25% de baixo."],
    exampleSql: "SELECT product_name, category, score, hidden_gem FROM bi.v1_product_scorecard WHERE enough_data ORDER BY score DESC LIMIT 20;",
  },
  {
    name: "price_opportunity", view: "bi.v1_price_opportunity", title: "Oportunidade de preço", question: "Quais itens o cliente olha, mas não compra, e quanto de desconto cabe mantendo a margem mínima?",
    grain: "1 linha por produto candidato (janela móvel)", defaultOrder: "views DESC",
    additive: ["views", "adds", "fav_adds", "orders", "adds_not_bought", "stock_total"], nonAdditive: {
      conversion_rate: RATIO, margin_pct: RATIO, max_discount_pct: "desconto máximo por produto", unique_viewers: DISTINCT, repeat_viewers: DISTINCT, price: "preço unitário",
      conversion_rank: "rank percentual dentro da categoria (0 a 1)", days_since_last_sale: "estado atual do produto", price_window_start: "preço unitário", price_change_pct: "variação por produto", min_margin_used: "parâmetro (igual em todas as linhas)",
    },
    caveats: ["É um sinal para investigar, não prova de que o preço é o motivo: frete, estoque, foto e tamanho também pesam.", "max_discount_pct é nulo quando o custo do produto não está cadastrado.", "Para saber o efeito de um desconto, compare antes e depois com bi.v1_price_history."],
    exampleSql: "SELECT product_name, views, fav_adds, orders, max_discount_pct, stock_total FROM bi.v1_price_opportunity WHERE cost_known ORDER BY views DESC LIMIT 20;",
  },
  {
    name: "experience_issues", view: "bi.v1_experience_issues", title: "Qualidade da experiência", question: "Onde o cliente está tendo uma experiência ruim (erros, lentidão, cliques repetidos)?",
    grain: "dia × página", dateColumn: "date_sp", defaultOrder: "date_sp DESC, issues_per_1k_views DESC NULLS LAST",
    additive: ["page_views", "js_errors", "api_errors", "rage_clicks", "form_errors", "not_found", "image_errors"],
    nonAdditive: { issues_per_1k_views: RATIO, lcp_p75_ms: "percentil: não se soma nem se tira média sem peso", inp_p75_ms: "percentil", cls_p75: "percentil", lcp_rating: "classificação" },
    caveats: ["Velocidade só existe para páginas com medições; poucas medições deixam o percentil instável.", "Metas: LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0,1."],
    exampleSql: "SELECT path, sum(page_views) AS vistas, sum(js_errors + api_errors) AS erros, max(lcp_p75_ms) AS lcp_pior FROM bi.v1_experience_issues WHERE date_sp >= current_date - 7 GROUP BY 1 ORDER BY 3 DESC LIMIT 20;",
  },
  {
    name: "api_errors", view: "bi.v1_api_errors", title: "Erros de API por rota", question: "Quais chamadas à API estão falhando para o cliente?",
    grain: "dia × rota × método × código × origem do registro", dateColumn: "date_sp", defaultOrder: "date_sp DESC, occurrences DESC", additive: ["occurrences"], nonAdditive: { visitors: DISTINCT },
    caveats: ["from_server = true são erros 5xx registrados pelo servidor, sem ligação com a visita."],
    exampleSql: "SELECT endpoint, error_code, sum(occurrences) AS vezes FROM bi.v1_api_errors WHERE date_sp >= current_date - 7 GROUP BY 1, 2 ORDER BY 3 DESC;",
  },
  {
    name: "price_history", view: "bi.v1_price_history", title: "Histórico de preço", question: "Como o preço e o estoque de cada produto mudaram ao longo do tempo?",
    grain: "dia × produto", dateColumn: "date_sp", defaultOrder: "date_sp DESC", additive: [], nonAdditive: { price: "preço unitário", compare_at_price: "preço unitário", stock_total: "retrato do dia" },
    caveats: ["O histórico começa quando a medição entra no ar."],
    exampleSql: "SELECT date_sp, price, stock_total FROM bi.v1_price_history WHERE product_name ILIKE '%Luz da Lua%' ORDER BY date_sp;",
  },
  {
    name: "sales", view: "bi.v1_sales", title: "Vendas por item", question: "O que foi vendido, por quanto e com que margem?",
    grain: "pedido × item", dateColumn: "date_sp", defaultOrder: "date_sp DESC", additive: ["quantity", "line_revenue"], nonAdditive: { unit_price: "preço unitário", margin_pct: RATIO },
    caveats: ["Inclui pedidos cancelados (status CANCELED): filtre conforme a análise.", "Não traz dados do cliente."],
    exampleSql: "SELECT category, sum(line_revenue) AS receita, sum(quantity) AS unidades FROM bi.v1_sales WHERE status <> 'CANCELED' AND date_sp >= current_date - 30 GROUP BY 1 ORDER BY 2 DESC;",
  },
];

export const METRIC_BY_NAME: ReadonlyMap<string, MetricDef> = new Map(METRICS.map((m) => [m.name, m]));
