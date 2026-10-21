# Power BI

1. **Obter dados → PostgreSQL**. Servidor e banco do ambiente; usuário `bi_reader` (somente leitura). Modo **Importação** (as métricas são diárias). Selecione as views `bi.v1_*`.
2. Power BI **Service** (nuvem) precisa de um **gateway de dados** numa máquina que alcance o banco, ou use a API de métricas (Web, `GET /api/metrics/v1/metrics/{nome}/data?format=csv`, cabeçalho `Authorization: Bearer …`).
3. **Relacionamentos:** `v1_products[product_id]` 1 → * `product_id` das views de produto (`v1_product_engagement`, `v1_cart_add_remove`, `v1_price_history`, `v1_sales`, `v1_product_scorecard`, `v1_price_opportunity`). Crie uma tabela de datas e relacione `date_sp`.
4. **Medidas:** cole as de [measures.dax](measures.dax) (geradas). Razões são calculadas sobre as somas.
5. Atualização agendada: uma vez ao dia (os resumos de hoje se refazem a cada 15 minutos, se quiser mais frequência).

> Estes arquivos são pontos de partida gerados do contrato; **não foram abertos em um Power BI real** neste ambiente. Ajuste nomes de tabelas ao importar.
