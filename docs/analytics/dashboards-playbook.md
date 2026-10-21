# Receitas de dashboards

Cada receita diz que view usar, que filtros, que gráfico e o que olhar. O SQL de cada painel está testado e pronto em `grafana/dashboards/*.json` (Grafana) e adaptável a qualquer BI. Todos leem só `bi.v1_*`.

## Convenções
- Período: `date_sp` (dia em Brasília). No Grafana: `$__timeFilter(date_sp)`. No Power BI: segmentação de data na coluna `date_sp`.
- **Somar antes de dividir**: taxas = soma do numerador ÷ soma do denominador.
- Mostre o tamanho da amostra (visitas, visualizações) ao lado de percentuais.

## 1 · Tráfego e interesse — `traffic_daily`, `page_ranking`, `search_terms`
| Painel | Consulta (resumo) | Gráfico |
|---|---|---|
| Visitas por dia | `sum(sessions)` por `date_sp` | Linha |
| Origem e aparelho | `sum(sessions)` por `source` / `device_type` | Barras / pizza |
| Páginas mais acessadas | `sum(page_views)` por `path` | Tabela |
| O que buscam / sem resultado | `search_terms`: `sum(searches)`, `sum(zero_result_searches)` | Tabela |
**Olhe:** rejeição alta numa origem (anúncio levando para página errada); buscas sem resultado = produto que falta ou nome que o cliente usa diferente.

## 2 · Funil — `funnel`
Barras por etapa (`step_order`), `sum(sessions)`; abra por `device_type` e `source`. **Olhe:** a maior queda entre etapas vizinhas; diferença mobile × desktop.

## 3 · Qualidade — `experience_issues`, `api_errors`
Problemas por dia (empilhado), tabela por página com `issues_per_1k_views`, LCP p75 por página (meta ≤ 2500 ms), erros de API por rota. **Olhe:** pico de `api_errors` no `/orders` (checkout) e páginas com `lcp_rating = 'poor'`.

## 4 · Carrinho — `abandoned_carts`, `cart_items`, `cart_add_remove`
Valor parado e quantidade; itens mais abandonados (`abandoned = true`); taxa de retirada por produto (`remove_rate`). **Olhe:** abandono no `stage = 'checkout'` (frete, pagamento, erro) é diferente de abandono na sacola.

## 5 · Produtos — `product_engagement`, `product_scorecard`
Mais clicados (CTR), mais favoritados (`fav_net`), índice de destaque e **joias escondidas** (`hidden_gem`). **Olhe:** só confie em `enough_data = true`.

## 6 · Preço — `price_opportunity`, `price_history`
Tabela de oportunidades ordenada por `views`; histórico de preço de um produto. **Olhe:** `max_discount_pct` (cabe na margem mínima), estoque e dias sem vender; confirme com teste controlado antes de baixar preço.

## Como montar um painel novo (para agentes)
1. Escolha a métrica em [metrics-catalog.md](metrics-catalog.md) e leia os cuidados.
2. Use `describe_metric` para as colunas e confirme o que é somável.
3. Escreva o SQL só com `bi.v1_*`, com período e `LIMIT`. Rode com `run_sql` ou pela API.
4. Escolha o gráfico: série temporal para `date_sp`; barras para dimensões com poucos valores; tabela para rankings.
5. Registre o painel em `grafana/` (ou no gerador `apps/api/scripts/analytics-grafana.ts`, para entrar nos arquivos gerados).
