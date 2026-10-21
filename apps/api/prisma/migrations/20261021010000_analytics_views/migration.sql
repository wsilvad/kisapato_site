-- Métricas do site (fases 1 a 3): views internas e o contrato público "bi.v1_*".
-- Só cria views e funções novas nos esquemas analytics e bi.

-- ---------------------------------------------------------------------------------------------------------------------
-- Ajudantes
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.setting_num(k text, fallback numeric) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = analytics, pg_temp
AS $$ SELECT coalesce((SELECT value::numeric FROM analytics.settings WHERE key = k), fallback) $$;

-- Comenta várias colunas de uma view de uma vez: pares "coluna|texto".
CREATE OR REPLACE FUNCTION analytics.doc_columns(view_name text, pairs text[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY pairs LOOP
    EXECUTE format('COMMENT ON COLUMN %s.%I IS %L', view_name, split_part(p, '|', 1), substr(p, strpos(p, '|') + 1));
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Views internas (esquema analytics)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE VIEW analytics.v_sessions AS
SELECT s.session_id,
       s.anonymous_id,
       min(s.occurred_at)                                                    AS started_at,
       max(s.occurred_at)                                                    AS ended_at,
       (min(s.occurred_at) AT TIME ZONE 'America/Sao_Paulo')::date           AS date_sp,
       (array_agg(s.device_type ORDER BY s.occurred_at) FILTER (WHERE s.device_type IS NOT NULL))[1] AS device_type,
       coalesce(
         (array_agg(s.utm_source ORDER BY s.occurred_at)    FILTER (WHERE s.utm_source IS NOT NULL))[1],
         (array_agg(s.referrer_host ORDER BY s.occurred_at) FILTER (WHERE s.referrer_host IS NOT NULL))[1],
         'direto')                                                           AS source,
       (array_agg(s.path ORDER BY s.occurred_at) FILTER (WHERE s.event = 'page_view'))[1] AS landing_path,
       count(*) FILTER (WHERE s.event = 'page_view')                         AS page_views,
       count(*) FILTER (WHERE s.event IN ('js_error', 'api_error', 'rage_click', 'form_error', 'image_error', 'not_found')) AS issues,
       bool_or(s.event = 'product_view')                                     AS viewed_product,
       bool_or(s.event = 'add_to_cart')                                      AS added_to_cart,
       bool_or(s.event = 'begin_checkout')                                   AS began_checkout,
       bool_or(s.event = 'payment_method_selected')                          AS chose_payment,
       bool_or(s.event = 'purchase')                                         AS purchased
FROM analytics.events s
WHERE s.session_id <> '00000000-0000-0000-0000-000000000000'
GROUP BY s.session_id, s.anonymous_id;
COMMENT ON VIEW analytics.v_sessions IS 'Uma linha por visita, derivada dos eventos (interna).';

CREATE VIEW analytics.v_first_seen AS
SELECT anonymous_id, min(occurred_at) AS first_seen FROM analytics.events GROUP BY anonymous_id;
COMMENT ON VIEW analytics.v_first_seen IS 'Primeira vez que cada visitante apareceu nos eventos guardados (interna).';

CREATE VIEW analytics.last_cart_per_visitor AS
SELECT DISTINCT ON (e.anonymous_id)
       e.anonymous_id, e.session_id, e.occurred_at AS last_update, e.cart_value, coalesce(e.items_count, 0) AS items_count,
       e.props->'items' AS items, e.device_type
FROM analytics.events e
WHERE e.event = 'cart_updated' AND e.occurred_at > now() - interval '30 days'
ORDER BY e.anonymous_id, e.occurred_at DESC;
COMMENT ON VIEW analytics.last_cart_per_visitor IS 'Último retrato da sacola de cada visitante nos últimos 30 dias (interna).';

-- ---------------------------------------------------------------------------------------------------------------------
-- Contrato público (esquema bi): sem dado pessoal, nomes estáveis, colunas comentadas
-- ---------------------------------------------------------------------------------------------------------------------

-- Dimensão de produtos
CREATE VIEW bi.v1_products AS
SELECT p.id AS product_id, p.name AS product_name, p.slug, p.reference, c.name AS category, b.name AS brand,
       p.active, p.price::numeric(10,2) AS price, p."compareAtPrice"::numeric(10,2) AS compare_at_price, p.badge::text AS badge,
       coalesce(sum(v.stock), 0)::int AS stock_total
FROM products p
JOIN categories c ON c.id = p."categoryId"
LEFT JOIN brands b ON b.id = p."brandId"
LEFT JOIN product_variants v ON v."productId" = p.id
GROUP BY p.id, c.name, b.name;
COMMENT ON VIEW bi.v1_products IS 'Dimensão de produtos (1 linha por produto, estado atual). Junte pelas colunas product_id das outras views.';
SELECT analytics.doc_columns('bi.v1_products', ARRAY[
 'product_id|Id do produto (products.id).','product_name|Nome exibido na loja.','slug|Endereço do produto na loja.','reference|Referência do fornecedor, quando houver.',
 'category|Categoria.','brand|Marca (nula se o produto não tem marca).','active|Produto ativo na loja.','price|Preço atual em reais.','compare_at_price|Preço "de" (riscado) em reais, se houver.',
 'badge|Selo: LANCAMENTO, PROMOCAO, DESTAQUE ou nulo.','stock_total|Unidades em estoque somando todas as numerações.']);

-- Tráfego por dia (ao vivo, a partir das visitas)
CREATE VIEW bi.v1_traffic_daily AS
SELECT s.date_sp, coalesce(s.device_type, 'desconhecido') AS device_type, s.source,
       count(*)::int AS sessions,
       count(DISTINCT s.anonymous_id)::int AS visitors,
       count(DISTINCT s.anonymous_id) FILTER (WHERE (f.first_seen AT TIME ZONE 'America/Sao_Paulo')::date = s.date_sp)::int AS new_visitors,
       sum(s.page_views)::int AS page_views,
       count(*) FILTER (WHERE s.viewed_product)::int AS sessions_with_product_view,
       count(*) FILTER (WHERE s.issues > 0)::int AS sessions_with_issues,
       count(*) FILTER (WHERE s.page_views <= 1 AND NOT s.viewed_product AND NOT s.added_to_cart)::int AS bounced_sessions
FROM analytics.v_sessions s
JOIN analytics.v_first_seen f ON f.anonymous_id = s.anonymous_id
GROUP BY s.date_sp, coalesce(s.device_type, 'desconhecido'), s.source;
COMMENT ON VIEW bi.v1_traffic_daily IS 'Visitas por dia × aparelho × origem. Granularidade: date_sp × device_type × source.';
SELECT analytics.doc_columns('bi.v1_traffic_daily', ARRAY[
 'date_sp|Dia da visita (fuso de Brasília).','device_type|mobile, tablet, desktop ou desconhecido.','source|Origem: utm_source, domínio de origem ou "direto".',
 'sessions|Visitas (30 minutos de inatividade encerram uma visita).','visitors|Visitantes anônimos distintos.','new_visitors|Visitantes cuja primeira aparição foi neste dia.',
 'page_views|Páginas abertas.','sessions_with_product_view|Visitas que abriram ao menos um produto.','sessions_with_issues|Visitas com erro, cliques repetidos, 404 ou imagem quebrada.',
 'bounced_sessions|Visitas de uma página só, sem ver produto nem usar a sacola.']);

-- Páginas mais acessadas
CREATE VIEW bi.v1_page_ranking AS
SELECT (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp, e.path,
       count(*)::int AS page_views, count(DISTINCT e.anonymous_id)::int AS visitors
FROM analytics.events e
WHERE e.event = 'page_view' AND e.path IS NOT NULL
GROUP BY 1, e.path;
COMMENT ON VIEW bi.v1_page_ranking IS 'O que mais se acessa. Granularidade: date_sp × path.';
SELECT analytics.doc_columns('bi.v1_page_ranking', ARRAY['date_sp|Dia (fuso de Brasília).','path|Caminho da página (ids viram :id).','page_views|Páginas abertas.','visitors|Visitantes distintos.']);

-- Buscas
CREATE VIEW bi.v1_search_terms AS
SELECT (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp, lower(e.search_term) AS search_term,
       count(*)::int AS searches, count(DISTINCT e.anonymous_id)::int AS visitors,
       round(avg(e.results_count)::numeric, 1) AS avg_results,
       count(*) FILTER (WHERE e.results_count = 0)::int AS zero_result_searches
FROM analytics.events e
WHERE e.event = 'search' AND e.search_term IS NOT NULL
GROUP BY 1, lower(e.search_term);
COMMENT ON VIEW bi.v1_search_terms IS 'O que buscam e o que não encontram. Granularidade: date_sp × search_term (minúsculo).';
SELECT analytics.doc_columns('bi.v1_search_terms', ARRAY['date_sp|Dia (fuso de Brasília).','search_term|Termo buscado, sem dados pessoais.','searches|Buscas.','visitors|Visitantes distintos.','avg_results|Média de resultados devolvidos.','zero_result_searches|Buscas que não trouxeram nenhum produto.']);

-- Funil (resumo diário)
CREATE VIEW bi.v1_funnel AS
WITH steps AS (
  SELECT date_sp, device_type, source, 1 AS step_order, 'Visita' AS step, sessions AS n FROM analytics.daily_funnel
  UNION ALL SELECT date_sp, device_type, source, 2, 'Viu produto',         viewed_product FROM analytics.daily_funnel
  UNION ALL SELECT date_sp, device_type, source, 3, 'Adicionou à sacola',  added_to_cart  FROM analytics.daily_funnel
  UNION ALL SELECT date_sp, device_type, source, 4, 'Entrou no checkout',  began_checkout FROM analytics.daily_funnel
  UNION ALL SELECT date_sp, device_type, source, 5, 'Escolheu pagamento',  chose_payment  FROM analytics.daily_funnel
  UNION ALL SELECT date_sp, device_type, source, 6, 'Comprou',             purchased      FROM analytics.daily_funnel
)
SELECT date_sp, device_type, source, step_order, step, n AS sessions,
       lag(n) OVER w AS sessions_previous_step,
       round(100.0 * n / nullif(lag(n) OVER w, 0), 1) AS pct_of_previous_step,
       round(100.0 * n / nullif(first_value(n) OVER w, 0), 1) AS pct_of_visits
FROM steps
WINDOW w AS (PARTITION BY date_sp, device_type, source ORDER BY step_order);
COMMENT ON VIEW bi.v1_funnel IS 'Funil de compra por sessão. Granularidade: date_sp × device_type × source × step_order. Hoje é atualizado a cada 15 minutos. O passo "Escolheu pagamento" só existe quando o checkout com pagamento estiver no ar.';
SELECT analytics.doc_columns('bi.v1_funnel', ARRAY['date_sp|Dia (fuso de Brasília).','device_type|mobile, tablet, desktop ou desconhecido.','source|Origem da visita.','step_order|Ordem da etapa (1 a 6).','step|Nome da etapa.','sessions|Visitas que chegaram à etapa.','sessions_previous_step|Visitas na etapa anterior.','pct_of_previous_step|% que passou da etapa anterior para esta.','pct_of_visits|% das visitas que chegou a esta etapa.']);

-- Carrinhos abandonados (um por visitante)
CREATE VIEW bi.v1_abandoned_carts AS
SELECT left(md5(c.anonymous_id::text), 12) AS visitor_key,
       (c.last_update AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp,
       c.last_update,
       round((extract(epoch FROM now() - c.last_update) / 3600)::numeric, 1) AS hours_since,
       c.cart_value, c.items_count, coalesce(c.device_type, 'desconhecido') AS device_type,
       CASE WHEN EXISTS (SELECT 1 FROM analytics.events b WHERE b.anonymous_id = c.anonymous_id AND b.event = 'begin_checkout' AND b.occurred_at >= c.last_update - interval '1 hour')
            THEN 'checkout' ELSE 'sacola' END AS stage
FROM analytics.last_cart_per_visitor c
WHERE c.items_count > 0
  AND c.last_update < now() - make_interval(hours => analytics.setting_num('abandon_hours', 24)::int)
  AND NOT EXISTS (SELECT 1 FROM analytics.events p WHERE p.anonymous_id = c.anonymous_id AND p.event = 'purchase' AND p.occurred_at > c.last_update - interval '1 hour');
COMMENT ON VIEW bi.v1_abandoned_carts IS 'Carrinhos com itens parados há mais de abandon_hours (padrão 24 h) e sem compra depois. Um por visitante (últimos 30 dias). Compra sem os cabeçalhos da visita não é ligada ao visitante.';
SELECT analytics.doc_columns('bi.v1_abandoned_carts', ARRAY['visitor_key|Identificador pseudonimizado do visitante (não é dado pessoal).','date_sp|Dia da última mudança na sacola.','last_update|Última mudança na sacola.','hours_since|Horas desde a última mudança.','cart_value|Valor da sacola em reais.','items_count|Linhas (variações) na sacola.','device_type|Aparelho.','stage|checkout se entrou no checkout depois de montar a sacola; senão sacola.']);

-- Itens das sacolas atuais (um por linha)
CREATE VIEW bi.v1_cart_items AS
SELECT left(md5(c.anonymous_id::text), 12) AS visitor_key,
       (c.last_update AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp,
       i->>'item_id' AS product_id, i->>'variant_id' AS variant_id, i->>'item_name' AS item_name,
       (i->>'price')::numeric(10,2) AS price, (i->>'quantity')::int AS quantity,
       ((i->>'price')::numeric * (i->>'quantity')::int)::numeric(10,2) AS line_value,
       (c.last_update < now() - make_interval(hours => analytics.setting_num('abandon_hours', 24)::int)
         AND NOT EXISTS (SELECT 1 FROM analytics.events p WHERE p.anonymous_id = c.anonymous_id AND p.event = 'purchase' AND p.occurred_at > c.last_update - interval '1 hour')) AS abandoned
FROM analytics.last_cart_per_visitor c
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.items) = 'array' THEN c.items ELSE '[]'::jsonb END) AS i
WHERE c.items_count > 0;
COMMENT ON VIEW bi.v1_cart_items IS 'Itens das sacolas mais recentes (últimos 30 dias), um por linha. abandoned = parado há mais de abandon_hours e sem compra depois. product_id pode ser o slug em sacolas antigas, de antes da medição.';
SELECT analytics.doc_columns('bi.v1_cart_items', ARRAY['visitor_key|Identificador pseudonimizado do visitante.','date_sp|Dia da última mudança na sacola.','product_id|Id do produto (ou slug em sacolas antigas).','variant_id|Variação (cor + numeração).','item_name|Nome do produto.','price|Preço unitário em reais.','quantity|Quantidade.','line_value|price × quantity.','abandoned|Sacola abandonada (ver view bi.v1_abandoned_carts).']);

-- Colocado e retirado da sacola
CREATE VIEW bi.v1_cart_add_remove AS
SELECT d.date_sp, d.product_id, p.name AS product_name, c.name AS category, b.name AS brand,
       d.adds, d.removes, round(d.removes::numeric / nullif(d.adds, 0), 3) AS remove_rate
FROM analytics.daily_product_stats d
JOIN products p ON p.id = d.product_id
JOIN categories c ON c.id = p."categoryId"
LEFT JOIN brands b ON b.id = p."brandId"
WHERE d.adds > 0 OR d.removes > 0;
COMMENT ON VIEW bi.v1_cart_add_remove IS 'Itens colocados e retirados da sacola. Granularidade: date_sp × product_id. Hoje é atualizado a cada 15 minutos.';
SELECT analytics.doc_columns('bi.v1_cart_add_remove', ARRAY['date_sp|Dia (fuso de Brasília).','product_id|Id do produto.','product_name|Nome do produto.','category|Categoria.','brand|Marca.','adds|Vezes que foi colocado na sacola.','removes|Vezes que foi retirado da sacola.','remove_rate|removes ÷ adds (pode passar de 1 se a sacola veio de outro dia).']);

-- Engajamento por produto e dia
CREATE VIEW bi.v1_product_engagement AS
SELECT d.date_sp, d.product_id, p.name AS product_name, c.name AS category, b.name AS brand,
       d.impressions, d.clicks, round(d.clicks::numeric / nullif(d.impressions, 0), 4) AS ctr,
       d.views, d.unique_viewers, d.adds, d.fav_adds, d.fav_removes, (d.fav_adds - d.fav_removes) AS fav_net,
       d.orders, d.units, d.revenue,
       round(100.0 * d.margin_value / nullif(d.revenue, 0), 1) AS margin_pct
FROM analytics.daily_product_stats d
JOIN products p ON p.id = d.product_id
JOIN categories c ON c.id = p."categoryId"
LEFT JOIN brands b ON b.id = p."brandId";
COMMENT ON VIEW bi.v1_product_engagement IS 'Cliques, visualizações, favoritos e vendas por produto e dia. Granularidade: date_sp × product_id. Hoje é atualizado a cada 15 minutos.';
SELECT analytics.doc_columns('bi.v1_product_engagement', ARRAY['date_sp|Dia (fuso de Brasília).','product_id|Id do produto.','product_name|Nome do produto.','category|Categoria.','brand|Marca.','impressions|Vezes que o card apareceu em listas.','clicks|Cliques no card.','ctr|clicks ÷ impressions.','views|Aberturas da página do produto.','unique_viewers|Visitantes distintos que abriram o produto.','adds|Colocações na sacola.','fav_adds|Favoritos adicionados.','fav_removes|Favoritos removidos.','fav_net|fav_adds − fav_removes.','orders|Pedidos não cancelados com o produto.','units|Unidades vendidas.','revenue|Receita em reais.','margin_pct|Margem do dia em % da receita.']);

-- Índice de destaque
CREATE VIEW bi.v1_product_scorecard AS
WITH win AS (SELECT analytics.setting_num('window_days', 30)::int AS days, analytics.setting_num('min_views', 20) AS min_views),
agg AS (
  SELECT d.product_id,
         sum(d.impressions) AS impressions, sum(d.clicks) AS clicks, sum(d.views) AS views, sum(d.unique_viewers) AS unique_viewers,
         sum(d.adds) AS adds, sum(d.fav_adds) AS fav_adds, sum(d.orders) AS orders, sum(d.units) AS units
  FROM analytics.daily_product_stats d, win
  WHERE d.date_sp > (now() AT TIME ZONE 'America/Sao_Paulo')::date - win.days
  GROUP BY d.product_id
),
base AS (
  SELECT p.id AS product_id, p.name AS product_name, p."categoryId" AS category_id, c.name AS category, b.name AS brand,
         p.price, CASE WHEN p."costPrice" IS NOT NULL AND p.price > 0 THEN (p.price - p."costPrice") / p.price END AS margin,
         count(v.id) AS total_sizes, count(v.id) FILTER (WHERE v.stock > 0) AS in_stock_sizes,
         coalesce(a.impressions, 0) AS impressions, coalesce(a.clicks, 0) AS clicks, coalesce(a.views, 0) AS views, coalesce(a.unique_viewers, 0) AS unique_viewers,
         coalesce(a.adds, 0) AS adds, coalesce(a.fav_adds, 0) AS fav_adds, coalesce(a.orders, 0) AS orders
  FROM products p
  JOIN categories c ON c.id = p."categoryId"
  LEFT JOIN brands b ON b.id = p."brandId"
  LEFT JOIN product_variants v ON v."productId" = p.id
  LEFT JOIN agg a ON a.product_id = p.id
  WHERE p.active
  GROUP BY p.id, c.name, b.name, a.impressions, a.clicks, a.views, a.unique_viewers, a.adds, a.fav_adds, a.orders
),
ranked AS (
  SELECT base.*,
         base.clicks::numeric / nullif(base.impressions, 0) AS ctr,
         base.adds::numeric / nullif(base.views, 0) AS add_rate,
         base.orders::numeric / nullif(base.views, 0) AS conversion,
         percent_rank() OVER (PARTITION BY category_id ORDER BY (base.unique_viewers + 2 * base.fav_adds)) AS demand_rank,
         percent_rank() OVER (PARTITION BY category_id ORDER BY (coalesce(base.clicks::numeric / nullif(base.impressions, 0), 0) * 0.5 + coalesce(base.adds::numeric / nullif(base.views, 0), 0) * 0.5)) AS interest_rank,
         percent_rank() OVER (PARTITION BY category_id ORDER BY coalesce(base.orders::numeric / nullif(base.views, 0), 0)) AS conversion_rank,
         percent_rank() OVER (PARTITION BY category_id ORDER BY coalesce(base.margin, 0)) AS margin_rank,
         percent_rank() OVER (PARTITION BY category_id ORDER BY base.impressions) AS exposure_rank
  FROM base
)
SELECT r.product_id, r.product_name, r.category, r.brand, r.price::numeric(10,2) AS price, round(100 * r.margin, 1) AS margin_pct,
       r.in_stock_sizes::int, r.total_sizes::int, r.impressions::int, r.clicks::int, round(r.ctr, 4) AS ctr, r.views::int, r.unique_viewers::int,
       r.adds::int, r.fav_adds::int, r.orders::int, round(r.conversion, 4) AS conversion_rate,
       round(r.demand_rank::numeric, 2) AS demand_rank, round(r.interest_rank::numeric, 2) AS interest_rank,
       round(r.conversion_rank::numeric, 2) AS conversion_rank, round(r.margin_rank::numeric, 2) AS margin_rank,
       round(r.exposure_rank::numeric, 2) AS exposure_rank,
       round((r.in_stock_sizes::numeric / nullif(r.total_sizes, 0)), 2) AS availability,
       round((100 * (analytics.setting_num('w_demand', .25) * r.demand_rank + analytics.setting_num('w_interest', .25) * r.interest_rank
                  + analytics.setting_num('w_conversion', .25) * r.conversion_rank + analytics.setting_num('w_margin', .15) * r.margin_rank
                  + analytics.setting_num('w_availability', .10) * coalesce(r.in_stock_sizes::numeric / nullif(r.total_sizes, 0), 0)))::numeric, 1) AS score,
       (r.views >= win.min_views / 2 AND r.conversion_rank >= 0.75 AND r.exposure_rank <= 0.25 AND r.in_stock_sizes > 0) AS hidden_gem,
       (r.views >= win.min_views) AS enough_data,
       win.days AS window_days
FROM ranked r, win;
COMMENT ON VIEW bi.v1_product_scorecard IS 'Índice de destaque (0 a 100) por produto ativo, na janela de window_days (padrão 30). Ranks são percentuais dentro da categoria (0 a 1). Pesos em analytics.settings. hidden_gem: converte no top 25% da categoria e aparece no 25% de baixo. Com enough_data = false o número é frágil (poucas visualizações).';
SELECT analytics.doc_columns('bi.v1_product_scorecard', ARRAY['product_id|Id do produto.','product_name|Nome.','category|Categoria.','brand|Marca.','price|Preço atual.','margin_pct|Margem atual em % do preço (nula se o custo é desconhecido).','in_stock_sizes|Numerações com estoque.','total_sizes|Numerações cadastradas.','impressions|Exibições em listas na janela.','clicks|Cliques na janela.','ctr|clicks ÷ impressions.','views|Aberturas da página do produto.','unique_viewers|Visitantes distintos (soma por dia).','adds|Colocações na sacola.','fav_adds|Favoritos adicionados.','orders|Pedidos.','conversion_rate|orders ÷ views.','demand_rank|Rank da demanda na categoria (0 a 1).','interest_rank|Rank do interesse (CTR e adição à sacola).','conversion_rank|Rank da conversão.','margin_rank|Rank da margem.','exposure_rank|Rank da exposição (impressions).','availability|in_stock_sizes ÷ total_sizes.','score|Índice de destaque de 0 a 100.','hidden_gem|Joia escondida: converte bem, aparece pouco.','enough_data|Visualizações suficientes (min_views) para confiar no número.','window_days|Janela usada, em dias.']);

-- Oportunidade de preço
CREATE VIEW bi.v1_price_opportunity AS
WITH cfg AS (SELECT analytics.setting_num('window_days', 30)::int AS days, analytics.setting_num('min_views', 20) AS min_views, analytics.setting_num('min_margin', .30) AS min_margin),
repeat AS (
  SELECT product_id, count(*) FILTER (WHERE n >= 2) AS repeat_viewers
  FROM (
    SELECT e.product_id, e.anonymous_id, count(*) AS n
    FROM analytics.events e, cfg
    WHERE e.event = 'product_view' AND e.product_id IS NOT NULL AND e.occurred_at > now() - make_interval(days => cfg.days)
    GROUP BY e.product_id, e.anonymous_id
  ) t GROUP BY product_id
),
sales AS (
  SELECT v."productId" AS product_id, max(o."createdAt") AS last_sale
  FROM orders o JOIN order_items i ON i."orderId" = o.id JOIN product_variants v ON v.id = i."variantId"
  WHERE o.status <> 'CANCELED' GROUP BY v."productId"
),
old_price AS (
  SELECT DISTINCT ON (product_id) product_id, price AS price_before
  FROM analytics.product_price_daily, cfg
  WHERE date_sp <= (now() AT TIME ZONE 'America/Sao_Paulo')::date - cfg.days
  ORDER BY product_id, date_sp DESC
)
SELECT s.product_id, s.product_name, s.category, s.brand, s.price, s.margin_pct,
       s.views, s.unique_viewers, s.adds, s.fav_adds, coalesce(r.repeat_viewers, 0)::int AS repeat_viewers, s.orders,
       greatest(s.adds - s.orders, 0) AS adds_not_bought,
       s.conversion_rate, s.conversion_rank,
       CASE WHEN p."costPrice" IS NOT NULL AND p."costPrice" > 0 AND p.price > 0
            THEN round(100 * greatest(0, 1 - p."costPrice" / ((1 - cfg.min_margin) * p.price)), 1) END AS max_discount_pct,
       (p."costPrice" IS NOT NULL AND p."costPrice" > 0) AS cost_known,
       (p."compareAtPrice" IS NOT NULL) AS on_sale,
       pr.stock_total::int AS stock_total,
       CASE WHEN sl.last_sale IS NULL THEN NULL ELSE (now()::date - sl.last_sale::date) END AS days_since_last_sale,
       op.price_before AS price_window_start,
       round(100 * (s.price - op.price_before) / nullif(op.price_before, 0), 1) AS price_change_pct,
       cfg.min_margin::numeric(4,2) AS min_margin_used
FROM bi.v1_product_scorecard s
CROSS JOIN cfg
JOIN products p ON p.id = s.product_id
JOIN bi.v1_products pr ON pr.product_id = s.product_id
LEFT JOIN repeat r ON r.product_id = s.product_id
LEFT JOIN sales sl ON sl.product_id = s.product_id
LEFT JOIN old_price op ON op.product_id = s.product_id
WHERE s.enough_data AND s.conversion_rank <= 0.25 AND s.demand_rank >= 0.5 AND (s.adds + s.fav_adds + coalesce(r.repeat_viewers, 0)) > 0;
COMMENT ON VIEW bi.v1_price_opportunity IS 'Produtos com interesse sem conversão: visualizações suficientes, demanda acima da mediana da categoria, conversão no 25% de baixo e sinais de intenção (sacola, favorito ou visitas repetidas). max_discount_pct é o maior desconto que preserva a margem mínima (analytics.settings.min_margin); nulo se o custo é desconhecido. É sinal para investigar (frete, estoque, foto também pesam), não prova de que preço é o motivo.';
SELECT analytics.doc_columns('bi.v1_price_opportunity', ARRAY['product_id|Id do produto.','product_name|Nome.','category|Categoria.','brand|Marca.','price|Preço atual.','margin_pct|Margem atual em % do preço.','views|Visualizações na janela.','unique_viewers|Visitantes distintos.','adds|Colocações na sacola.','fav_adds|Favoritos adicionados.','repeat_viewers|Visitantes que abriram o produto 2 vezes ou mais.','orders|Pedidos.','adds_not_bought|adds − orders (aproximação de intenção sem compra).','conversion_rate|orders ÷ views.','conversion_rank|Rank da conversão na categoria (0 a 1).','max_discount_pct|Maior desconto que mantém a margem mínima (nulo sem custo).','cost_known|O custo do produto está cadastrado.','on_sale|Já está em promoção (tem preço "de").','stock_total|Unidades em estoque.','days_since_last_sale|Dias desde a última venda (nulo se nunca vendeu).','price_window_start|Preço no início da janela, do histórico diário (nulo se não há histórico).','price_change_pct|Variação do preço na janela, em %.','min_margin_used|Margem mínima usada no cálculo.']);

-- Qualidade da experiência
CREATE VIEW bi.v1_experience_issues AS
SELECT q.date_sp, q.path, q.page_views, q.js_errors, q.api_errors, q.rage_clicks, q.form_errors, q.not_found, q.image_errors,
       round(1000.0 * (q.js_errors + q.api_errors + q.rage_clicks + q.form_errors + q.not_found + q.image_errors) / nullif(q.page_views, 0), 1) AS issues_per_1k_views,
       round(q.lcp_p75_ms::numeric, 0) AS lcp_p75_ms, round(q.inp_p75_ms::numeric, 0) AS inp_p75_ms, round(q.cls_p75::numeric, 3) AS cls_p75,
       CASE WHEN q.lcp_p75_ms IS NULL THEN NULL WHEN q.lcp_p75_ms <= 2500 THEN 'good' WHEN q.lcp_p75_ms <= 4000 THEN 'needs-improvement' ELSE 'poor' END AS lcp_rating
FROM analytics.daily_quality q;
COMMENT ON VIEW bi.v1_experience_issues IS 'Erros, cliques repetidos e velocidade por página e dia. Granularidade: date_sp × path. Hoje é atualizado a cada 15 minutos. Percentis só existem se houve medições.';
SELECT analytics.doc_columns('bi.v1_experience_issues', ARRAY['date_sp|Dia (fuso de Brasília).','path|Caminho da página.','page_views|Páginas abertas.','js_errors|Erros de JavaScript.','api_errors|Chamadas à API que falharam (4xx exceto 401, 5xx ou rede).','rage_clicks|Cliques repetidos (3+ em 1 s no mesmo ponto).','form_errors|Campos recusados pela validação do navegador.','not_found|Páginas 404.','image_errors|Imagens que não carregaram.','issues_per_1k_views|Problemas por mil páginas abertas.','lcp_p75_ms|Maior elemento visível (LCP), percentil 75, em ms. Bom ≤ 2500.','inp_p75_ms|Resposta a interações (INP), percentil 75, em ms. Bom ≤ 200.','cls_p75|Mudança de layout (CLS), percentil 75. Bom ≤ 0,1.','lcp_rating|good, needs-improvement ou poor (pelo LCP).']);

CREATE VIEW bi.v1_api_errors AS
SELECT (e.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp, coalesce(e.props->>'endpoint', '(desconhecido)') AS endpoint,
       coalesce(e.props->>'method', '?') AS method, e.error_code,
       (coalesce(e.props->>'server', 'false') = 'true') AS from_server,
       count(*)::int AS occurrences, count(DISTINCT e.anonymous_id)::int AS visitors
FROM analytics.events e
WHERE e.event = 'api_error' AND e.error_code IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;
COMMENT ON VIEW bi.v1_api_errors IS 'Erros de API por rota. Granularidade: date_sp × endpoint × method × error_code × from_server.';
SELECT analytics.doc_columns('bi.v1_api_errors', ARRAY['date_sp|Dia (fuso de Brasília).','endpoint|Rota da API sem ids.','method|GET, POST…','error_code|Código HTTP ou "network".','from_server|Registrado pelo servidor (erro 5xx) e não pelo navegador.','occurrences|Ocorrências.','visitors|Visitantes distintos (o servidor, sem cabeçalhos, conta como um só).']);

-- Histórico de preço e vendas
CREATE VIEW bi.v1_price_history AS
SELECT h.date_sp, h.product_id, p.name AS product_name, h.price, h.compare_at_price, h.stock_total
FROM analytics.product_price_daily h JOIN products p ON p.id = h.product_id;
COMMENT ON VIEW bi.v1_price_history IS 'Retrato diário de preço e estoque por produto (começa quando a medição entra no ar). Granularidade: date_sp × product_id.';
SELECT analytics.doc_columns('bi.v1_price_history', ARRAY['date_sp|Dia do retrato (fuso de Brasília).','product_id|Id do produto.','product_name|Nome.','price|Preço em reais.','compare_at_price|Preço "de" em reais.','stock_total|Estoque somado.']);

CREATE VIEW bi.v1_sales AS
SELECT (o."createdAt" AT TIME ZONE 'America/Sao_Paulo')::date AS date_sp, o.id AS order_id, o.status::text AS status,
       p.id AS product_id, p.name AS product_name, c.name AS category, b.name AS brand, v.color, coalesce(v."sizeLabel", v.size::text) AS size,
       i.quantity, i."unitPrice"::numeric(10,2) AS unit_price, (i.quantity * i."unitPrice")::numeric(12,2) AS line_revenue,
       CASE WHEN coalesce(i."unitCost", p."costPrice") IS NOT NULL AND i."unitPrice" > 0
            THEN round(100 * (i."unitPrice" - coalesce(i."unitCost", p."costPrice")) / i."unitPrice", 1) END AS margin_pct
FROM orders o
JOIN order_items i ON i."orderId" = o.id
JOIN product_variants v ON v.id = i."variantId"
JOIN products p ON p.id = v."productId"
JOIN categories c ON c.id = p."categoryId"
LEFT JOIN brands b ON b.id = p."brandId";
COMMENT ON VIEW bi.v1_sales IS 'Itens vendidos (um por linha de pedido), sem dados do cliente. Granularidade: order_id × item. Inclui pedidos cancelados (status CANCELED): filtre conforme a análise.';
SELECT analytics.doc_columns('bi.v1_sales', ARRAY['date_sp|Dia do pedido (fuso de Brasília).','order_id|Id do pedido.','status|PENDING, PAID, PICKING, SHIPPED, DELIVERED ou CANCELED.','product_id|Id do produto.','product_name|Nome.','category|Categoria.','brand|Marca.','color|Cor.','size|Numeração ou tamanho.','quantity|Quantidade.','unit_price|Preço unitário na venda.','line_revenue|Receita da linha em reais.','margin_pct|Margem da linha em % do preço (nula sem custo).']);

-- ---------------------------------------------------------------------------------------------------------------------
-- Acesso de leitura (o usuário bi_reader é criado por quem administra o banco; aqui só se concedem os direitos se ele existir)
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_reader') THEN
    GRANT USAGE ON SCHEMA bi TO bi_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA bi TO bi_reader;
    ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT SELECT ON TABLES TO bi_reader;
  END IF;
END $$;
