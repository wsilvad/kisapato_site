# Histórico do contrato de medição

## v1 — 2026-10-21
- Esquemas `analytics` (interno) e `bi` (contrato), eventos particionados por mês, resumos diários.
- 32 eventos (ver [events-catalog.md](events-catalog.md)) e 15 views `bi.v1_*` (ver [metrics-catalog.md](metrics-catalog.md)).
- API de métricas (`/api/metrics/v1`), servidor MCP, camada semântica, painéis de partida do Grafana, medidas DAX, LookML.
- Regras de compatibilidade: dentro de `v1`, colunas existentes não mudam de nome, tipo nem significado; podem entrar colunas novas. Mudança que quebra vira `v2`, com `v1` mantida por um tempo e aviso aqui.
