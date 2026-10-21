-- Páginas com mais problemas por mil visualizações (últimos 7 dias).
SELECT path, sum(page_views) AS vistas,
       sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) AS problemas,
       round(1000.0 * sum(js_errors + api_errors + rage_clicks + form_errors + not_found + image_errors) / nullif(sum(page_views), 0), 1) AS por_mil_vistas,
       max(lcp_p75_ms) AS lcp_p75_ms
FROM bi.v1_experience_issues
WHERE date_sp >= current_date - 7
GROUP BY 1
HAVING sum(page_views) >= 20
ORDER BY por_mil_vistas DESC NULLS LAST
LIMIT 20;
