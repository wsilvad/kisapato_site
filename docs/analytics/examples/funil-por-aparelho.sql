-- Passagem entre etapas do funil por aparelho (últimos 30 dias). Some sessions por etapa e divida depois.
SELECT device_type, step_order, step, sum(sessions) AS sessoes
FROM bi.v1_funnel
WHERE date_sp >= current_date - 30
GROUP BY 1, 2, 3
ORDER BY 1, 2;
