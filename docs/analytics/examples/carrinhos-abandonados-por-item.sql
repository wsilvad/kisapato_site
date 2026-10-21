-- Itens mais presentes em sacolas abandonadas.
SELECT item_name, count(*) AS sacolas, sum(line_value) AS valor
FROM bi.v1_cart_items
WHERE abandoned
GROUP BY 1
ORDER BY valor DESC
LIMIT 20;
