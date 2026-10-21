<!-- Gerado por `npm run analytics:docs -w @ki-sapato/api`. Não edite à mão: mude o código e gere de novo. -->

# Catálogo de eventos de medição

Gerado de `apps/api/src/modules/analytics/registry.ts`. Todo evento vai para `analytics.events` (esquema interno); BI e IA leem as views `bi.v1_*`, nunca esta tabela.

**Campos comuns de todo evento** (preenchidos pelo SDK do site): `occurred_at` (corrigido pelo servidor), `anonymous_id`, `session_id`, `path`, `viewport_w` → `device_type`, `referrer_host`/`utm_*` (só no primeiro evento da visita), `browser` e `os` (do servidor).

**Colunas tipadas disponíveis:** `product_id`, `variant_id`, `list_name`, `list_position`, `price`, `quantity`, `cart_value`, `items_count`, `search_term`, `results_count`, `value_num`, `error_code`. O que não cabe nelas vai em `props` (JSON, até 4 KB, sem dados pessoais).

**Nomes em outros destinos:** a coluna GA4/Segment/PostHog mostra a tradução usada pelo SDK ao enviar o mesmo evento a essas ferramentas.

## Navegação e descoberta

| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |
|---|---|---|---|---|---|---|---|
| `page_view` | A cada página aberta ou troca de rota no site. | — | — | — | `page_view` | Page Viewed | `$pageview` |
| `search` | Ao buscar (a busca do topo ou da página de produtos). | `search_term`, `results_count` | `search_term` | `filters`: filtros ativos (texto curto) | `search` | Products Searched | — |
| `filter_apply` | Ao marcar ou desmarcar um filtro. | — | — | `filter`: nome do filtro (categoria, marca, cor, tamanho, preço…); `value`: valor escolhido | — | — | — |
| `sort_change` | Ao escolher outra ordenação. | — | — | `sort`: ordenação escolhida | — | — | — |
| `banner_click` | Ao clicar num banner da home. | — | — | `campaign_id`: id da campanha; `position`: posição do banner | — | — | — |
| `story_open` | Ao abrir um story da home. | — | — | `story_id`: id do story; `position`: posição | — | — | — |
| `menu_click` | Ao clicar em item do menu principal ou do rodapé. | — | — | `label`: texto do item; `target`: destino | — | — | — |
| `whatsapp_click` | Ao clicar no botão flutuante ou de contato. | `product_id` | — | `origin`: onde estava o botão | — | — | — |

## Produto

| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |
|---|---|---|---|---|---|---|---|
| `product_impression` | Quando um card fica pelo menos metade visível por 1 segundo. | `product_id`, `list_name`, `list_position`, `price` | `product_id` | — | `view_item_list` | Product List Viewed | — |
| `product_click` | Ao clicar num card em qualquer lista. | `product_id`, `list_name`, `list_position`, `price` | `product_id` | — | `select_item` | Product Clicked | — |
| `product_view` | Ao abrir a página do produto. | `product_id`, `price` | `product_id` | `stock`: unidades disponíveis somadas; `color`: cor aberta | `view_item` | Product Viewed | — |
| `color_select` | Ao escolher uma cor na página do produto. | `product_id` | — | `color`: cor escolhida | — | — | — |
| `size_select` | Ao escolher um tamanho disponível. | `product_id`, `variant_id` | — | `size`: tamanho escolhido | — | — | — |
| `favorite_add` | Ao favoritar. | `product_id`, `price` | `product_id` | `origin`: lista, página do produto ou favoritos | `add_to_wishlist` | Product Added to Wishlist | — |
| `favorite_remove` | Ao desfavoritar. | `product_id` | `product_id` | — | — | — | — |

## Sacola e compra

| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |
|---|---|---|---|---|---|---|---|
| `add_to_cart` | Ao adicionar uma variação (cor + numeração) à sacola. | `product_id`, `variant_id`, `price`, `quantity`, `cart_value` | `product_id`, `variant_id` | `items`: lista de itens: item_id, variant_id, item_name, item_category, price, quantity | `add_to_cart` | Product Added | — |
| `remove_from_cart` | Ao remover uma variação da sacola. | `product_id`, `variant_id`, `price`, `quantity`, `cart_value` | `product_id`, `variant_id` | `items`: lista de itens: item_id, variant_id, item_name, item_category, price, quantity | `remove_from_cart` | Product Removed | — |
| `cart_qty_change` | Ao mudar a quantidade de um item. | `product_id`, `variant_id`, `price`, `quantity`, `cart_value` | `product_id`, `variant_id` | — | — | — | — |
| `cart_updated` | Depois de cada mudança na sacola (com 1,5 s de espera para juntar mudanças seguidas) e ao abrir o site com a sacola cheia. | `cart_value`, `items_count` | `items_count` | `items`: lista de itens: item_id, variant_id, item_name, item_category, price, quantity | — | — | — |
| `shipping_quote` | Ao calcular o frete pelo CEP. | `price` | — | `cep3`: 3 primeiros dígitos do CEP; `days`: prazo em dias | — | — | — |
| `begin_checkout` | Ao abrir a página de checkout com itens. | `cart_value`, `items_count` | — | `items`: lista de itens: item_id, variant_id, item_name, item_category, price, quantity | `begin_checkout` | Checkout Started | — |
| `checkout_step` | Ao concluir uma etapa (endereço, entrega, pagamento). | `cart_value` | — | `step`: endereco, entrega ou pagamento | `add_shipping_info` | Checkout Step Completed | — |
| `payment_method_selected` | Ao escolher Pix ou cartão. | `cart_value` | — | `method`: pix ou cartao; `installments`: parcelas | `add_payment_info` | Payment Info Entered | — |
| `purchase` (servidor) | No servidor, quando o pedido é criado. | `cart_value`, `items_count` | — | `order_id`: id do pedido; `shipping`: frete; `status`: situação do pedido; `items`: lista de itens: item_id, variant_id, item_name, item_category, price, quantity | `purchase` | Order Completed | — |

## Qualidade da experiência

| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |
|---|---|---|---|---|---|---|---|
| `js_error` | Em erros não tratados e promessas rejeitadas. | `error_code` | — | `source`: arquivo; `line`: linha | — | — | `$exception` |
| `api_error` | No navegador, quando uma chamada à API falha; no servidor, em erros 5xx. | `error_code` | `error_code` | `endpoint`: caminho da API sem ids; `method`: GET, POST…; `ms`: tempo | — | — | — |
| `web_vital` | Quando o navegador mede LCP, INP, CLS, FCP ou TTFB. | `value_num` | `value_num` | `metric`: LCP, INP, CLS, FCP ou TTFB; `rating`: good, needs-improvement ou poor | — | — | `$web_vitals` |
| `rage_click` | Quando o cliente clica várias vezes seguidas sem resposta. | — | — | `target`: tag e classe do elemento (sem texto) | — | — | `$rageclick` |
| `form_error` | Quando um campo é recusado pelo navegador. | — | — | `form`: id ou nome do formulário; `field`: nome do campo; `type`: tipo do erro (vazio, formato, tamanho…) | — | — | — |
| `not_found` | Ao abrir uma página que não existe. | — | — | — | — | — | — |
| `image_error` | Quando uma imagem da página falha. | — | — | `src_host`: domínio da imagem | — | — | — |

## Identidade

| Evento | Quando dispara | Colunas | Obrigatórias | props | GA4 | Segment | PostHog |
|---|---|---|---|---|---|---|---|
| `identify` (servidor) | No servidor, no login, se a medição de identidade estiver ligada. | — | — | — | — | — | — |

## Exemplos

**page_view** — Página aberta ou mudança de rota.

```json
{
  "event": "page_view",
  "path": "/produtos"
}
```

**search** — Cliente busca no site.

```json
{
  "event": "search",
  "search_term": "tênis branco",
  "results_count": 12
}
```

**filter_apply** — Aplica um filtro na lista de produtos.

```json
{
  "event": "filter_apply",
  "props": {
    "filter": "cor",
    "value": "preto"
  }
}
```

**sort_change** — Muda a ordenação da lista.

```json
{
  "event": "sort_change",
  "props": {
    "sort": "menor-preco"
  }
}
```

**banner_click** — Clique num banner de campanha.

```json
{
  "event": "banner_click",
  "props": {
    "campaign_id": "c1",
    "position": 1
  }
}
```

**story_open** — Abertura de um story.

```json
{
  "event": "story_open",
  "props": {
    "story_id": "s1",
    "position": 2
  }
}
```

**menu_click** — Clique em item do menu.

```json
{
  "event": "menu_click",
  "props": {
    "label": "Tênis",
    "target": "/produtos?categoria=tenis"
  }
}
```

**whatsapp_click** — Clique no botão de WhatsApp.

```json
{
  "event": "whatsapp_click",
  "props": {
    "origin": "flutuante"
  }
}
```

**product_impression** — Card de produto apareceu na tela de uma lista (amostrado e em lote).

```json
{
  "event": "product_impression",
  "product_id": "p1",
  "list_name": "categoria",
  "list_position": 3
}
```

**product_click** — Clique num card de produto.

```json
{
  "event": "product_click",
  "product_id": "p1",
  "list_name": "vitrine",
  "list_position": 1
}
```

**product_view** — Abertura da página do produto.

```json
{
  "event": "product_view",
  "product_id": "p1",
  "price": 349.9,
  "props": {
    "stock": 14
  }
}
```

**color_select** — Escolha de cor.

```json
{
  "event": "color_select",
  "product_id": "p1",
  "props": {
    "color": "Preto"
  }
}
```

**size_select** — Escolha de tamanho.

```json
{
  "event": "size_select",
  "product_id": "p1",
  "variant_id": "v1",
  "props": {
    "size": "37"
  }
}
```

**favorite_add** — Produto favoritado.

```json
{
  "event": "favorite_add",
  "product_id": "p1",
  "props": {
    "origin": "lista"
  }
}
```

**favorite_remove** — Favorito removido.

```json
{
  "event": "favorite_remove",
  "product_id": "p1"
}
```

**add_to_cart** — Item colocado na sacola.

```json
{
  "event": "add_to_cart",
  "product_id": "p1",
  "variant_id": "v1",
  "price": 349.9,
  "quantity": 1,
  "cart_value": 349.9
}
```

**remove_from_cart** — Item retirado da sacola.

```json
{
  "event": "remove_from_cart",
  "product_id": "p1",
  "variant_id": "v1",
  "quantity": 1,
  "cart_value": 0
}
```

**cart_qty_change** — Quantidade alterada na sacola.

```json
{
  "event": "cart_qty_change",
  "product_id": "p1",
  "variant_id": "v1",
  "quantity": 2,
  "cart_value": 699.8
}
```

**cart_updated** — Retrato da sacola depois de cada mudança.

```json
{
  "event": "cart_updated",
  "cart_value": 349.9,
  "items_count": 1,
  "props": {
    "items": [
      {
        "item_id": "p1",
        "variant_id": "v1",
        "item_name": "Tênis Luz da Lua",
        "price": 349.9,
        "quantity": 1
      }
    ]
  }
}
```

**shipping_quote** — Frete calculado.

```json
{
  "event": "shipping_quote",
  "price": 24.9,
  "props": {
    "cep3": "013",
    "days": 3
  }
}
```

**begin_checkout** — Entrada no checkout.

```json
{
  "event": "begin_checkout",
  "cart_value": 349.9,
  "items_count": 1
}
```

**checkout_step** — Avanço de etapa do checkout.

```json
{
  "event": "checkout_step",
  "props": {
    "step": "entrega"
  }
}
```

**payment_method_selected** — Forma de pagamento escolhida.

```json
{
  "event": "payment_method_selected",
  "props": {
    "method": "pix"
  }
}
```

**purchase** — Pedido criado (gravado pelo servidor).

```json
{
  "event": "purchase",
  "cart_value": 349.9,
  "items_count": 1,
  "props": {
    "order_id": "o1",
    "status": "PENDING"
  }
}
```

**js_error** — Erro de JavaScript na página.

```json
{
  "event": "js_error",
  "error_code": "TypeError: x is undefined"
}
```

**api_error** — Erro (4xx/5xx) ou falha de rede numa chamada à API.

```json
{
  "event": "api_error",
  "error_code": "500",
  "props": {
    "endpoint": "/orders",
    "method": "POST"
  }
}
```

**web_vital** — Medida real de velocidade (Core Web Vitals).

```json
{
  "event": "web_vital",
  "value_num": 2300,
  "props": {
    "metric": "LCP",
    "rating": "needs-improvement"
  }
}
```

**rage_click** — Três ou mais cliques rápidos no mesmo ponto.

```json
{
  "event": "rage_click",
  "props": {
    "target": "button.btn"
  }
}
```

**form_error** — Erro de validação num formulário.

```json
{
  "event": "form_error",
  "props": {
    "form": "endereco",
    "field": "cep",
    "type": "formato"
  }
}
```

**not_found** — Página não encontrada (404).

```json
{
  "event": "not_found",
  "path": "/produtos/inexistente"
}
```

**image_error** — Imagem que não carregou.

```json
{
  "event": "image_error",
  "props": {
    "src_host": "kisapatoback.discloud.dev"
  }
}
```

**identify** — Liga o visitante anônimo ao cliente logado (só se ANALYTICS_IDENTIFY estiver ligado).

```json
{
  "event": "identify"
}
```

