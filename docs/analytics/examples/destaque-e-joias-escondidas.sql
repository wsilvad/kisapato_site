-- Índice de destaque e produtos que convertem bem mas aparecem pouco.
SELECT product_name, category, score, hidden_gem, views, orders, impressions
FROM bi.v1_product_scorecard
WHERE enough_data OR hidden_gem
ORDER BY hidden_gem DESC, score DESC
LIMIT 30;
