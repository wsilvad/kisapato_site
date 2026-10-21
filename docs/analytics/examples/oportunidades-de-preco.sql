-- Produtos muito vistos e pouco comprados, com o desconto máximo que preserva a margem mínima.
SELECT product_name, views, fav_adds, repeat_viewers, orders, max_discount_pct, stock_total, days_since_last_sale
FROM bi.v1_price_opportunity
WHERE cost_known
ORDER BY views DESC
LIMIT 20;
