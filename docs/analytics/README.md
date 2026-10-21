# Medição do site Ki Sapato

Eventos do site → API → PostgreSQL (`analytics`) → views estáveis (`bi.v1_*`) → Power BI, Grafana, Tableau, Metabase e agentes de IA.

```
Site (SDK track())  ──POST /api/events──►  API (buffer em lote)  ──►  analytics.events (particionada por mês)
                                                                              │ resumos diários (a cada 15 min e de madrugada)
                                                                              ▼
              Power BI · Grafana · Tableau · Metabase  ◄── bi.v1_* ──  API de métricas · servidor MCP · docs para IA
```

| Quero… | Veja |
|---|---|
| Entender como uma IA usa isto | [AGENTS.md](AGENTS.md) |
| Saber o que cada evento registra | [events-catalog.md](events-catalog.md) *(gerado)* |
| Saber o que cada métrica responde e como somar | [metrics-catalog.md](metrics-catalog.md) *(gerado)* |
| Ver colunas e tipos | [data-dictionary.md](data-dictionary.md) *(gerado)* |
| Gerar modelos em outras ferramentas | [semantic-layer.yaml](semantic-layer.yaml), [lookml/](lookml), [powerbi/](powerbi) *(gerados)* |
| Chamar a API | [openapi.json](openapi.json) *(gerado)* |
| Montar dashboards | [dashboards-playbook.md](dashboards-playbook.md), [grafana/](grafana) |
| Operar, configurar e resolver problemas | [OPERATIONS.md](OPERATIONS.md) |
| Privacidade e LGPD | [privacy.md](privacy.md) |
| Histórico de mudanças do contrato | [CHANGELOG.md](CHANGELOG.md) |
| Consultas prontas | [examples/](examples) |

**Regenerar os arquivos gerados** (depois de mudar eventos, métricas ou views):

```bash
DATABASE_URL=<banco com as migrações aplicadas> npm run analytics:docs -w @ki-sapato/api
```

Um teste (`npm test -w @ki-sapato/api`) falha se um evento, uma view ou uma métrica mudar sem a documentação correspondente.
