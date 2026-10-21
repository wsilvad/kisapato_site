/** Painéis de partida do Grafana (fonte de dados PostgreSQL "Ki Sapato (BI)" lendo só bi.v1_*). Definidos aqui para serem gerados, não escritos à mão. */
type PanelKind = "stat" | "timeseries" | "table" | "barchart" | "piechart";
interface PanelDef { title: string; kind: PanelKind; sql: string; w?: number; h?: number; format?: "table" | "time_series"; unit?: string }
interface DashDef { file: string; title: string; description: string; panels: PanelDef[] }

const DS = { type: "postgres", uid: "${DS_KI_SAPATO}" };
const T = "$__timeFilter(date_sp)";

const dashboards: DashDef[] = [
  {
    file: "1-trafego", title: "Ki Sapato · 1 Tráfego e interesse", description: "O que o cliente mais acessa, de onde vem e o que busca.",
    panels: [
      { title: "Visitas", kind: "stat", w: 6, h: 4, sql: `SELECT sum(sessions) AS "Visitas" FROM bi.v1_traffic_daily WHERE ${T}` },
      { title: "Visitantes novos", kind: "stat", w: 6, h: 4, sql: `SELECT sum(new_visitors) AS "Novos" FROM bi.v1_traffic_daily WHERE ${T}` },
      { title: "Páginas por visita", kind: "stat", w: 6, h: 4, sql: `SELECT round(sum(page_views)::numeric / nullif(sum(sessions), 0), 2) AS "Páginas/visita" FROM bi.v1_traffic_daily WHERE ${T}` },
      { title: "Taxa de rejeição", kind: "stat", w: 6, h: 4, unit: "percentunit", sql: `SELECT sum(bounced_sessions)::numeric / nullif(sum(sessions), 0) AS "Rejeição" FROM bi.v1_traffic_daily WHERE ${T}` },
      { title: "Visitas por dia", kind: "timeseries", w: 16, h: 8, format: "time_series", sql: `SELECT date_sp::timestamp AS time, sum(sessions) AS "Visitas", sum(sessions_with_product_view) AS "Viram produto" FROM bi.v1_traffic_daily WHERE ${T} GROUP BY 1 ORDER BY 1` },
      { title: "Visitas por origem", kind: "barchart", w: 8, h: 8, sql: `SELECT source AS "Origem", sum(sessions) AS "Visitas" FROM bi.v1_traffic_daily WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 10` },
      { title: "Visitas por aparelho", kind: "piechart", w: 8, h: 8, sql: `SELECT device_type AS "Aparelho", sum(sessions) AS "Visitas" FROM bi.v1_traffic_daily WHERE ${T} GROUP BY 1` },
      { title: "Páginas mais acessadas", kind: "table", w: 8, h: 8, sql: `SELECT path AS "Página", sum(page_views) AS "Vistas" FROM bi.v1_page_ranking WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
      { title: "O que buscam", kind: "table", w: 8, h: 8, sql: `SELECT search_term AS "Termo", sum(searches) AS "Buscas", sum(zero_result_searches) AS "Sem resultado" FROM bi.v1_search_terms WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
      { title: "Buscas sem resultado (o que falta na loja)", kind: "table", w: 8, h: 8, sql: `SELECT search_term AS "Termo", sum(zero_result_searches) AS "Sem resultado" FROM bi.v1_search_terms WHERE ${T} GROUP BY 1 HAVING sum(zero_result_searches) > 0 ORDER BY 2 DESC LIMIT 15` },
    ],
  },
  {
    file: "2-funil", title: "Ki Sapato · 2 Funil de compra", description: "Onde o cliente desiste antes de comprar.",
    panels: [
      { title: "Funil do período", kind: "barchart", w: 12, h: 9, sql: `SELECT step AS "Etapa", sum(sessions) AS "Visitas" FROM bi.v1_funnel WHERE ${T} GROUP BY step_order, step ORDER BY step_order` },
      { title: "Passagem entre etapas", kind: "table", w: 12, h: 9, sql: `SELECT step AS "Etapa", sum(sessions) AS "Visitas", round(100.0 * sum(sessions) / nullif(sum(sum(sessions)) FILTER (WHERE step_order = 1) OVER (), 0), 1) AS "% das visitas" FROM bi.v1_funnel WHERE ${T} GROUP BY step_order, step ORDER BY step_order` },
      { title: "Funil por aparelho", kind: "table", w: 12, h: 9, sql: `SELECT device_type AS "Aparelho", step AS "Etapa", sum(sessions) AS "Visitas" FROM bi.v1_funnel WHERE ${T} GROUP BY device_type, step_order, step ORDER BY device_type, step_order` },
      { title: "Compras por dia", kind: "timeseries", w: 12, h: 9, format: "time_series", sql: `SELECT date_sp::timestamp AS time, sum(sessions) FILTER (WHERE step_order = 3) AS "Adicionaram à sacola", sum(sessions) FILTER (WHERE step_order = 6) AS "Compraram" FROM bi.v1_funnel WHERE ${T} GROUP BY 1 ORDER BY 1` },
    ],
  },
  {
    file: "3-qualidade", title: "Ki Sapato · 3 Qualidade da experiência", description: "Erros, lentidão e cliques repetidos.",
    panels: [
      { title: "Erros de JavaScript", kind: "stat", w: 6, h: 4, sql: `SELECT sum(js_errors) AS "Erros JS" FROM bi.v1_experience_issues WHERE ${T}` },
      { title: "Erros de API", kind: "stat", w: 6, h: 4, sql: `SELECT sum(api_errors) AS "Erros de API" FROM bi.v1_experience_issues WHERE ${T}` },
      { title: "Cliques repetidos", kind: "stat", w: 6, h: 4, sql: `SELECT sum(rage_clicks) AS "Cliques repetidos" FROM bi.v1_experience_issues WHERE ${T}` },
      { title: "Visitas com problema", kind: "stat", w: 6, h: 4, unit: "percentunit", sql: `SELECT sum(sessions_with_issues)::numeric / nullif(sum(sessions), 0) AS "Com problema" FROM bi.v1_traffic_daily WHERE ${T}` },
      { title: "Problemas por dia", kind: "timeseries", w: 24, h: 8, format: "time_series", sql: `SELECT date_sp::timestamp AS time, sum(js_errors) AS "JS", sum(api_errors) AS "API", sum(rage_clicks) AS "Cliques repetidos", sum(form_errors) AS "Formulário", sum(not_found) AS "404" FROM bi.v1_experience_issues WHERE ${T} GROUP BY 1 ORDER BY 1` },
      { title: "Páginas com mais problemas", kind: "table", w: 12, h: 9, sql: `SELECT path AS "Página", sum(page_views) AS "Vistas", sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) AS "Problemas", round(1000.0 * sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) / nullif(sum(page_views), 0), 1) AS "Por mil vistas" FROM bi.v1_experience_issues WHERE ${T} GROUP BY 1 ORDER BY 3 DESC LIMIT 15` },
      { title: "Velocidade (LCP p75, ms)", kind: "table", w: 12, h: 9, sql: `SELECT path AS "Página", max(lcp_p75_ms) AS "LCP p75 (ms)", max(lcp_rating) AS "Nota", max(inp_p75_ms) AS "INP p75 (ms)" FROM bi.v1_experience_issues WHERE ${T} AND lcp_p75_ms IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
      { title: "Erros de API por rota", kind: "table", w: 24, h: 8, sql: `SELECT endpoint AS "Rota", method AS "Método", error_code AS "Código", sum(occurrences) AS "Vezes" FROM bi.v1_api_errors WHERE ${T} GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 20` },
    ],
  },
  {
    file: "4-carrinho", title: "Ki Sapato · 4 Carrinho", description: "Sacolas abandonadas e itens colocados e retirados.",
    panels: [
      { title: "Carrinhos abandonados", kind: "stat", w: 8, h: 4, sql: `SELECT count(*) AS "Carrinhos" FROM bi.v1_abandoned_carts` },
      { title: "Valor parado (R$)", kind: "stat", w: 8, h: 4, unit: "currencyBRL", sql: `SELECT coalesce(sum(cart_value), 0) AS "Valor" FROM bi.v1_abandoned_carts` },
      { title: "Chegaram ao checkout e pararam", kind: "stat", w: 8, h: 4, sql: `SELECT count(*) FILTER (WHERE stage = 'checkout') AS "No checkout" FROM bi.v1_abandoned_carts` },
      { title: "Itens mais abandonados", kind: "table", w: 12, h: 9, sql: `SELECT item_name AS "Item", count(*) AS "Sacolas", sum(line_value) AS "Valor (R$)" FROM bi.v1_cart_items WHERE abandoned GROUP BY 1 ORDER BY 3 DESC LIMIT 15` },
      { title: "Colocados e retirados", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", sum(adds) AS "Colocou", sum(removes) AS "Retirou", round(sum(removes)::numeric / nullif(sum(adds), 0), 2) AS "Taxa de retirada" FROM bi.v1_cart_add_remove WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
    ],
  },
  {
    file: "5-produtos", title: "Ki Sapato · 5 Produtos", description: "Cliques, favoritos e itens que merecem destaque.",
    panels: [
      { title: "Mais clicados", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", sum(clicks) AS "Cliques", sum(impressions) AS "Exibições", round(sum(clicks)::numeric / nullif(sum(impressions), 0), 3) AS "CTR" FROM bi.v1_product_engagement WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
      { title: "Mais favoritados", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", sum(fav_adds) AS "Favoritos", sum(fav_removes) AS "Removidos", sum(fav_net) AS "Saldo" FROM bi.v1_product_engagement WHERE ${T} GROUP BY 1 ORDER BY 2 DESC LIMIT 15` },
      { title: "Índice de destaque (top 15)", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", category AS "Categoria", score AS "Índice", views AS "Vistas", orders AS "Pedidos", enough_data AS "Amostra ok" FROM bi.v1_product_scorecard ORDER BY score DESC LIMIT 15` },
      { title: "Joias escondidas (convertem bem, aparecem pouco)", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", category AS "Categoria", views AS "Vistas", orders AS "Pedidos", conversion_rate AS "Conversão", impressions AS "Exibições" FROM bi.v1_product_scorecard WHERE hidden_gem ORDER BY conversion_rate DESC` },
      { title: "Mais vendidos", kind: "table", w: 12, h: 9, sql: `SELECT product_name AS "Produto", sum(units) AS "Unidades", sum(revenue) AS "Receita (R$)" FROM bi.v1_product_engagement WHERE ${T} GROUP BY 1 HAVING sum(units) > 0 ORDER BY 3 DESC LIMIT 15` },
      { title: "Receita por dia", kind: "timeseries", w: 12, h: 9, format: "time_series", unit: "currencyBRL", sql: `SELECT date_sp::timestamp AS time, sum(line_revenue) AS "Receita" FROM bi.v1_sales WHERE ${T} AND status <> 'CANCELED' GROUP BY 1 ORDER BY 1` },
    ],
  },
  {
    file: "6-preco", title: "Ki Sapato · 6 Oportunidades de preço", description: "Muito visto, pouco vendido, e quanto de desconto cabe na margem.",
    panels: [
      { title: "Oportunidade de preço", kind: "table", w: 24, h: 10, sql: `SELECT product_name AS "Produto", category AS "Categoria", price AS "Preço", views AS "Vistas", adds AS "Sacola", fav_adds AS "Favoritos", repeat_viewers AS "Voltaram", orders AS "Pedidos", max_discount_pct AS "Desconto máx. (%)", stock_total AS "Estoque", days_since_last_sale AS "Dias sem vender", on_sale AS "Em promoção" FROM bi.v1_price_opportunity ORDER BY views DESC` },
      { title: "Histórico de preço de um produto", kind: "timeseries", w: 24, h: 9, format: "time_series", unit: "currencyBRL", sql: `SELECT date_sp::timestamp AS time, price AS "Preço", compare_at_price AS "Preço de" FROM bi.v1_price_history WHERE $__timeFilter(date_sp) AND product_name = '\${produto}' ORDER BY 1` },
    ],
  },
];

export function grafanaDashboards() {
  return dashboards.map((d) => {
    let y = 0;
    let x = 0;
    let rowH = 0;
    const panels = d.panels.map((p, i) => {
      const w = p.w ?? 12;
      const h = p.h ?? 8;
      if (x + w > 24) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      const pos = { x, y, w, h };
      x += w;
      rowH = Math.max(rowH, h);
      return {
        id: i + 1, type: p.kind, title: p.title, gridPos: pos, datasource: DS,
        fieldConfig: { defaults: p.unit ? { unit: p.unit } : {}, overrides: [] },
        options: p.kind === "stat" ? { reduceOptions: { calcs: ["lastNotNull"], values: false }, colorMode: "none", graphMode: "none" } : {},
        targets: [{ refId: "A", datasource: DS, format: p.format ?? "table", rawQuery: true, editorMode: "code", rawSql: p.sql }],
      };
    });
    const hasProductVar = d.panels.some((p) => p.sql.includes("${produto}"));
    return {
      file: d.file,
      json: {
        uid: `ks-${d.file}`, title: d.title, description: d.description, tags: ["ki-sapato", "bi"], schemaVersion: 39, version: 1, editable: true, timezone: "America/Sao_Paulo",
        time: { from: "now-30d", to: "now" }, refresh: "5m",
        templating: {
          list: [
            { name: "DS_KI_SAPATO", label: "Fonte de dados", type: "datasource", query: "postgres", current: { text: "Ki Sapato (BI)", value: "ki-sapato-bi" }, hide: 0 },
            ...(hasProductVar ? [{ name: "produto", label: "Produto", type: "query", datasource: DS, query: "SELECT product_name FROM bi.v1_products WHERE active ORDER BY 1", refresh: 1, includeAll: false }] : []),
          ],
        },
        panels,
      },
    };
  });
}
