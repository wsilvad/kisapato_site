-- Métricas do site (fase 1): esquemas, eventos particionados por mês, resumos diários e rotinas.
-- Só adiciona objetos novos nos esquemas "analytics" e "bi"; não toca nas tabelas existentes.
-- O Prisma gerencia apenas o esquema "public", então estes objetos não aparecem no schema.prisma.

CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS bi;

COMMENT ON SCHEMA analytics IS 'Dados internos de medição do site (eventos brutos, resumos diários, configurações). Não é aberto a BI nem a agentes de IA: eles leem o esquema bi.';
COMMENT ON SCHEMA bi IS 'Contrato estável para BI e IA: views versionadas (v1_*), sem dado pessoal. Cada view e coluna tem COMMENT com significado, unidade e granularidade.';

-- ---------------------------------------------------------------------------------------------------------------------
-- Eventos brutos (um por linha), particionados por mês de occurred_at.
-- product_id / variant_id são TEXT porque os ids de products / product_variants são texto (uuid).
-- ---------------------------------------------------------------------------------------------------------------------
CREATE SEQUENCE analytics.events_id_seq;

CREATE TABLE analytics.events (
  id             bigint        NOT NULL DEFAULT nextval('analytics.events_id_seq'),
  occurred_at    timestamptz   NOT NULL,
  received_at    timestamptz   NOT NULL DEFAULT now(),
  schema_v       smallint      NOT NULL DEFAULT 1,
  event          text          NOT NULL,
  anonymous_id   uuid          NOT NULL,
  session_id     uuid          NOT NULL,
  profile_id     uuid,
  path           text,
  referrer_host  text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  device_type    text,
  browser        text,
  os             text,
  viewport_w     integer,
  product_id     text,
  variant_id     text,
  list_name      text,
  list_position  integer,
  price          numeric(10,2),
  quantity       integer,
  cart_value     numeric(10,2),
  items_count    integer,
  search_term    text,
  results_count  integer,
  value_num      double precision,
  error_code     text,
  props          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX events_event_time_idx   ON analytics.events (event, occurred_at);
CREATE INDEX events_product_time_idx ON analytics.events (product_id, occurred_at) WHERE product_id IS NOT NULL;
CREATE INDEX events_anon_time_idx    ON analytics.events (anonymous_id, occurred_at);
CREATE INDEX events_session_idx      ON analytics.events (session_id);

COMMENT ON TABLE analytics.events IS 'Evento bruto do site. Fuso: occurred_at é timestamptz (UTC); para dia use (occurred_at AT TIME ZONE ''America/Sao_Paulo'')::date. Particionada por mês; retenção por analytics.drop_old_event_partitions.';
COMMENT ON COLUMN analytics.events.occurred_at   IS 'Quando aconteceu, já corrigido pelo relógio do servidor.';
COMMENT ON COLUMN analytics.events.received_at   IS 'Quando a API recebeu o lote.';
COMMENT ON COLUMN analytics.events.schema_v      IS 'Versão do formato do evento (registro de eventos no código).';
COMMENT ON COLUMN analytics.events.event         IS 'Nome do evento (snake_case). Lista em docs/analytics/events-catalog.md.';
COMMENT ON COLUMN analytics.events.anonymous_id  IS 'Identificador anônimo do visitante/aparelho (aleatório, guardado no navegador por 13 meses).';
COMMENT ON COLUMN analytics.events.session_id    IS 'Visita (encerra após 30 minutos parado).';
COMMENT ON COLUMN analytics.events.profile_id    IS 'Cliente logado. Só preenchido se ANALYTICS_IDENTIFY estiver ligado; nunca vai para o esquema bi.';
COMMENT ON COLUMN analytics.events.path          IS 'Caminho da página (sem endereço do site nem parâmetros de busca pessoais).';
COMMENT ON COLUMN analytics.events.referrer_host IS 'Domínio de origem quando externo ao site; nulo em navegação interna ou acesso direto.';
COMMENT ON COLUMN analytics.events.device_type   IS 'mobile, tablet ou desktop (pela largura da tela).';
COMMENT ON COLUMN analytics.events.product_id    IS 'products.id do produto do evento.';
COMMENT ON COLUMN analytics.events.variant_id    IS 'product_variants.id (cor + numeração) do evento.';
COMMENT ON COLUMN analytics.events.list_name     IS 'Onde o produto apareceu: vitrine, categoria, busca, relacionados, favoritos…';
COMMENT ON COLUMN analytics.events.list_position IS 'Posição do produto na lista (1 = primeiro).';
COMMENT ON COLUMN analytics.events.price         IS 'Preço unitário em reais no momento do evento.';
COMMENT ON COLUMN analytics.events.cart_value    IS 'Valor total da sacola em reais no momento do evento.';
COMMENT ON COLUMN analytics.events.search_term   IS 'Termo buscado, já sem e-mail, CPF ou telefone e cortado em 80 caracteres.';
COMMENT ON COLUMN analytics.events.value_num     IS 'Valor numérico genérico (ex.: LCP em ms para web_vital).';
COMMENT ON COLUMN analytics.events.props         IS 'Campos extras do evento (JSON); inclui items[] nos eventos de sacola e compra.';

-- ---------------------------------------------------------------------------------------------------------------------
-- Partições mensais e retenção
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.ensure_event_partitions(months_ahead integer DEFAULT 2) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  first_day date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  i integer;
  made integer := 0;
  part_start timestamptz;
  part_end timestamptz;
  part_name text;
BEGIN
  FOR i IN -1..months_ahead LOOP
    part_start := ((first_day + make_interval(months => i))::timestamp) AT TIME ZONE 'America/Sao_Paulo';
    part_end   := ((first_day + make_interval(months => i + 1))::timestamp) AT TIME ZONE 'America/Sao_Paulo';
    part_name  := 'events_' || to_char(first_day + make_interval(months => i), 'YYYY_MM');
    IF to_regclass('analytics.' || part_name) IS NULL THEN
      EXECUTE format('CREATE TABLE analytics.%I PARTITION OF analytics.events FOR VALUES FROM (%L) TO (%L)', part_name, part_start, part_end);
      made := made + 1;
    END IF;
  END LOOP;
  RETURN made;
END $$;

CREATE OR REPLACE FUNCTION analytics.drop_old_event_partitions(keep_months integer DEFAULT 13) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  cutoff date := (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - make_interval(months => keep_months))::date;
  part record;
  dropped integer := 0;
BEGIN
  FOR part IN
    SELECT c.relname FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE n.nspname = 'analytics' AND p.relname = 'events' AND c.relname ~ '^events_[0-9]{4}_[0-9]{2}$'
  LOOP
    IF to_date(substr(part.relname, 8), 'YYYY_MM') < cutoff THEN
      EXECUTE format('DROP TABLE analytics.%I', part.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END $$;

SELECT analytics.ensure_event_partitions(2);

-- ---------------------------------------------------------------------------------------------------------------------
-- Configurações das análises (ajustáveis sem mexer no código)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE analytics.settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  note  text
);
COMMENT ON TABLE analytics.settings IS 'Parâmetros das métricas derivadas (margem mínima, horas até abandono, mínimos de amostra, pesos do índice de destaque).';

INSERT INTO analytics.settings (key, value, note) VALUES
  ('min_margin',          '0.30', 'Margem mínima (fração do preço) que a análise de oportunidade de preço preserva.'),
  ('abandon_hours',       '24',   'Horas sem atividade para um carrinho com itens ser considerado abandonado.'),
  ('min_views',           '20',   'Visualizações mínimas (30 dias) para um produto entrar nos rankings de destaque e de preço.'),
  ('window_days',         '30',   'Janela, em dias, do índice de destaque e da oportunidade de preço.'),
  ('w_demand',            '0.25', 'Peso da demanda (visualizações únicas e favoritos) no índice de destaque.'),
  ('w_interest',          '0.25', 'Peso do interesse (CTR e adição ao carrinho).'),
  ('w_conversion',        '0.25', 'Peso da conversão (compras ÷ visualizações).'),
  ('w_margin',            '0.15', 'Peso da margem.'),
  ('w_availability',      '0.10', 'Peso da disponibilidade (tamanhos com estoque).');

CREATE TABLE analytics.identities (
  anonymous_id uuid        NOT NULL,
  profile_id   uuid        NOT NULL,
  first_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anonymous_id, profile_id)
);
COMMENT ON TABLE analytics.identities IS 'Liga o visitante anônimo ao cliente logado. Fica vazia enquanto ANALYTICS_IDENTIFY estiver desligado. Nunca é exposta no esquema bi.';

-- ---------------------------------------------------------------------------------------------------------------------
-- Resumos diários (preenchidos por analytics.refresh_daily, de madrugada e sob demanda)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE analytics.daily_product_stats (
  date_sp        date          NOT NULL,
  product_id     text          NOT NULL,
  impressions    integer       NOT NULL DEFAULT 0,
  clicks         integer       NOT NULL DEFAULT 0,
  views          integer       NOT NULL DEFAULT 0,
  unique_viewers integer       NOT NULL DEFAULT 0,
  adds           integer       NOT NULL DEFAULT 0,
  removes        integer       NOT NULL DEFAULT 0,
  fav_adds       integer       NOT NULL DEFAULT 0,
  fav_removes    integer       NOT NULL DEFAULT 0,
  orders         integer       NOT NULL DEFAULT 0,
  units          integer       NOT NULL DEFAULT 0,
  revenue        numeric(12,2) NOT NULL DEFAULT 0,
  margin_value   numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (date_sp, product_id)
);
COMMENT ON TABLE analytics.daily_product_stats IS 'Produto × dia (fuso de Brasília). Eventos do site + vendas dos pedidos não cancelados. margin_value é interno (não sai no bi).';

CREATE TABLE analytics.daily_funnel (
  date_sp         date    NOT NULL,
  device_type     text    NOT NULL,
  source          text    NOT NULL,
  sessions        integer NOT NULL DEFAULT 0,
  viewed_product  integer NOT NULL DEFAULT 0,
  added_to_cart   integer NOT NULL DEFAULT 0,
  began_checkout  integer NOT NULL DEFAULT 0,
  chose_payment   integer NOT NULL DEFAULT 0,
  purchased       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (date_sp, device_type, source)
);
COMMENT ON TABLE analytics.daily_funnel IS 'Sessões em cada etapa do funil, por dia × aparelho × origem (utm_source, domínio de origem ou "direto").';

CREATE TABLE analytics.daily_quality (
  date_sp      date             NOT NULL,
  path         text             NOT NULL,
  page_views   integer          NOT NULL DEFAULT 0,
  js_errors    integer          NOT NULL DEFAULT 0,
  api_errors   integer          NOT NULL DEFAULT 0,
  rage_clicks  integer          NOT NULL DEFAULT 0,
  form_errors  integer          NOT NULL DEFAULT 0,
  not_found    integer          NOT NULL DEFAULT 0,
  image_errors integer          NOT NULL DEFAULT 0,
  lcp_p75_ms   double precision,
  inp_p75_ms   double precision,
  cls_p75      double precision,
  PRIMARY KEY (date_sp, path)
);
COMMENT ON TABLE analytics.daily_quality IS 'Qualidade da experiência por página × dia: erros, cliques repetidos e velocidade (percentil 75).';

CREATE TABLE analytics.product_price_daily (
  date_sp          date          NOT NULL,
  product_id       text          NOT NULL,
  price            numeric(10,2) NOT NULL,
  compare_at_price numeric(10,2),
  cost_price       numeric(10,2),
  stock_total      integer       NOT NULL DEFAULT 0,
  PRIMARY KEY (date_sp, product_id)
);
COMMENT ON TABLE analytics.product_price_daily IS 'Retrato diário de preço, preço "de", custo e estoque (histórico para medir o efeito de preço). cost_price é interno.';

-- ---------------------------------------------------------------------------------------------------------------------
-- Cálculo dos resumos de um dia (idempotente: apaga e refaz o dia)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics.refresh_daily(d date) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  start_ts timestamptz := (d::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  end_ts   timestamptz := ((d + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  DELETE FROM analytics.daily_product_stats WHERE date_sp = d;
  DELETE FROM analytics.daily_funnel        WHERE date_sp = d;
  DELETE FROM analytics.daily_quality       WHERE date_sp = d;

  -- produto × dia: comportamento
  INSERT INTO analytics.daily_product_stats (date_sp, product_id, impressions, clicks, views, unique_viewers, adds, removes, fav_adds, fav_removes)
  SELECT d, e.product_id,
         count(*) FILTER (WHERE e.event = 'product_impression'),
         count(*) FILTER (WHERE e.event = 'product_click'),
         count(*) FILTER (WHERE e.event = 'product_view'),
         count(DISTINCT e.anonymous_id) FILTER (WHERE e.event = 'product_view'),
         count(*) FILTER (WHERE e.event = 'add_to_cart'),
         count(*) FILTER (WHERE e.event = 'remove_from_cart'),
         count(*) FILTER (WHERE e.event = 'favorite_add'),
         count(*) FILTER (WHERE e.event = 'favorite_remove')
  FROM analytics.events e
  WHERE e.product_id IS NOT NULL AND e.occurred_at >= start_ts AND e.occurred_at < end_ts
  GROUP BY e.product_id;

  -- produto × dia: vendas (pedidos não cancelados; o custo vem do pedido e, na falta, do produto)
  INSERT INTO analytics.daily_product_stats (date_sp, product_id, orders, units, revenue, margin_value)
  SELECT d, v."productId",
         count(DISTINCT o.id),
         sum(i.quantity),
         sum(i.quantity * i."unitPrice"),
         sum(i.quantity * (i."unitPrice" - coalesce(i."unitCost", p."costPrice", i."unitPrice")))
  FROM orders o
  JOIN order_items i ON i."orderId" = o.id
  JOIN product_variants v ON v.id = i."variantId"
  JOIN products p ON p.id = v."productId"
  WHERE o.status <> 'CANCELED' AND o."createdAt" >= start_ts AND o."createdAt" < end_ts
  GROUP BY v."productId"
  ON CONFLICT (date_sp, product_id) DO UPDATE
    SET orders = excluded.orders, units = excluded.units, revenue = excluded.revenue, margin_value = excluded.margin_value;

  -- funil por sessão
  WITH s AS (
    SELECT session_id,
           (array_agg(device_type ORDER BY occurred_at))[1] AS device_type,
           coalesce(
             (array_agg(utm_source ORDER BY occurred_at)    FILTER (WHERE utm_source IS NOT NULL))[1],
             (array_agg(referrer_host ORDER BY occurred_at) FILTER (WHERE referrer_host IS NOT NULL))[1],
             'direto') AS source,
           bool_or(event = 'product_view')             AS v,
           bool_or(event = 'add_to_cart')              AS a,
           bool_or(event = 'begin_checkout')           AS c,
           bool_or(event = 'payment_method_selected')  AS p,
           bool_or(event = 'purchase')                 AS b
    FROM analytics.events
    WHERE occurred_at >= start_ts AND occurred_at < end_ts
    GROUP BY session_id
  )
  INSERT INTO analytics.daily_funnel (date_sp, device_type, source, sessions, viewed_product, added_to_cart, began_checkout, chose_payment, purchased)
  SELECT d, coalesce(device_type, 'desconhecido'), source, count(*),
         count(*) FILTER (WHERE v), count(*) FILTER (WHERE a), count(*) FILTER (WHERE c), count(*) FILTER (WHERE p), count(*) FILTER (WHERE b)
  FROM s GROUP BY coalesce(device_type, 'desconhecido'), source;

  -- qualidade por página
  INSERT INTO analytics.daily_quality (date_sp, path, page_views, js_errors, api_errors, rage_clicks, form_errors, not_found, image_errors, lcp_p75_ms, inp_p75_ms, cls_p75)
  SELECT d, coalesce(path, '(sem página)'),
         count(*) FILTER (WHERE event = 'page_view'),
         count(*) FILTER (WHERE event = 'js_error'),
         count(*) FILTER (WHERE event = 'api_error'),
         count(*) FILTER (WHERE event = 'rage_click'),
         count(*) FILTER (WHERE event = 'form_error'),
         count(*) FILTER (WHERE event = 'not_found'),
         count(*) FILTER (WHERE event = 'image_error'),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY value_num) FILTER (WHERE event = 'web_vital' AND props->>'metric' = 'LCP'),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY value_num) FILTER (WHERE event = 'web_vital' AND props->>'metric' = 'INP'),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY value_num) FILTER (WHERE event = 'web_vital' AND props->>'metric' = 'CLS')
  FROM analytics.events
  WHERE occurred_at >= start_ts AND occurred_at < end_ts
  GROUP BY coalesce(path, '(sem página)');
END $$;

CREATE OR REPLACE FUNCTION analytics.refresh_range(from_d date, to_d date) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE d date; n integer := 0;
BEGIN
  FOR d IN SELECT generate_series(from_d, to_d, interval '1 day')::date LOOP
    PERFORM analytics.refresh_daily(d);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- retrato de hoje: preço, preço "de", custo e estoque de cada produto (para o histórico de preço)
CREATE OR REPLACE FUNCTION analytics.snapshot_prices() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; n integer;
BEGIN
  INSERT INTO analytics.product_price_daily (date_sp, product_id, price, compare_at_price, cost_price, stock_total)
  SELECT today, p.id, p.price, p."compareAtPrice", p."costPrice", coalesce(sum(v.stock), 0)
  FROM products p LEFT JOIN product_variants v ON v."productId" = p.id
  GROUP BY p.id
  ON CONFLICT (date_sp, product_id) DO UPDATE
    SET price = excluded.price, compare_at_price = excluded.compare_at_price, cost_price = excluded.cost_price, stock_total = excluded.stock_total;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
