/**
 * Registro único dos eventos de medição. Daqui saem: a validação do que chega em POST /api/events, o catálogo para IA
 * (docs/analytics/events-catalog.md), a tradução de nomes para outros destinos (GA4, Segment, PostHog) e os testes.
 * Para criar um evento novo, acrescente-o aqui e rode `npm run analytics:docs -w @ki-sapato/api`.
 */
export type EventGroup = "navegacao" | "produto" | "sacola" | "qualidade" | "identidade";

/** Colunas tipadas da tabela analytics.events que um evento pode preencher (o resto vai em props). */
export const TYPED_FIELDS = ["product_id", "variant_id", "list_name", "list_position", "price", "quantity", "cart_value", "items_count", "search_term", "results_count", "value_num", "error_code"] as const;
export type TypedField = (typeof TYPED_FIELDS)[number];

export interface EventDef {
  name: string;
  group: EventGroup;
  description: string;
  when: string;
  /** Colunas tipadas que o evento usa. */
  fields: readonly TypedField[];
  /** Colunas tipadas obrigatórias. */
  required?: readonly TypedField[];
  /** Chaves esperadas dentro de props (documentação; props aceita só chaves simples e curtas). */
  props?: Record<string, string>;
  /** Só o servidor grava (o navegador não pode enviar). */
  serverOnly?: boolean;
  /** Tradução do nome para outros destinos. */
  aliases?: { ga4?: string; segment?: string; posthog?: string };
  example: Record<string, unknown>;
}

const items = { items: "lista de itens: item_id, variant_id, item_name, item_category, price, quantity" };

export const EVENTS: readonly EventDef[] = [
  // --- navegação e descoberta
  { name: "page_view", group: "navegacao", description: "Página aberta ou mudança de rota.", when: "A cada página aberta ou troca de rota no site.", fields: [], aliases: { ga4: "page_view", segment: "Page Viewed", posthog: "$pageview" }, example: { path: "/produtos" } },
  { name: "search", group: "navegacao", description: "Cliente busca no site.", when: "Ao buscar (a busca do topo ou da página de produtos).", fields: ["search_term", "results_count"], required: ["search_term"], props: { filters: "filtros ativos (texto curto)" }, aliases: { ga4: "search", segment: "Products Searched" }, example: { search_term: "tênis branco", results_count: 12 } },
  { name: "filter_apply", group: "navegacao", description: "Aplica um filtro na lista de produtos.", when: "Ao marcar ou desmarcar um filtro.", fields: [], props: { filter: "nome do filtro (categoria, marca, cor, tamanho, preço…)", value: "valor escolhido" }, example: { props: { filter: "cor", value: "preto" } } },
  { name: "sort_change", group: "navegacao", description: "Muda a ordenação da lista.", when: "Ao escolher outra ordenação.", fields: [], props: { sort: "ordenação escolhida" }, example: { props: { sort: "menor-preco" } } },
  { name: "banner_click", group: "navegacao", description: "Clique num banner de campanha.", when: "Ao clicar num banner da home.", fields: [], props: { campaign_id: "id da campanha", position: "posição do banner" }, example: { props: { campaign_id: "c1", position: 1 } } },
  { name: "story_open", group: "navegacao", description: "Abertura de um story.", when: "Ao abrir um story da home.", fields: [], props: { story_id: "id do story", position: "posição" }, example: { props: { story_id: "s1", position: 2 } } },
  { name: "menu_click", group: "navegacao", description: "Clique em item do menu.", when: "Ao clicar em item do menu principal ou do rodapé.", fields: [], props: { label: "texto do item", target: "destino" }, example: { props: { label: "Tênis", target: "/produtos?categoria=tenis" } } },
  { name: "whatsapp_click", group: "navegacao", description: "Clique no botão de WhatsApp.", when: "Ao clicar no botão flutuante ou de contato.", fields: ["product_id"], props: { origin: "onde estava o botão" }, example: { props: { origin: "flutuante" } } },

  // --- produto
  { name: "product_impression", group: "produto", description: "Card de produto apareceu na tela de uma lista (amostrado e em lote).", when: "Quando um card fica pelo menos metade visível por 1 segundo.", fields: ["product_id", "list_name", "list_position", "price"], required: ["product_id"], aliases: { ga4: "view_item_list", segment: "Product List Viewed" }, example: { product_id: "p1", list_name: "categoria", list_position: 3 } },
  { name: "product_click", group: "produto", description: "Clique num card de produto.", when: "Ao clicar num card em qualquer lista.", fields: ["product_id", "list_name", "list_position", "price"], required: ["product_id"], aliases: { ga4: "select_item", segment: "Product Clicked" }, example: { product_id: "p1", list_name: "vitrine", list_position: 1 } },
  { name: "product_view", group: "produto", description: "Abertura da página do produto.", when: "Ao abrir a página do produto.", fields: ["product_id", "price"], required: ["product_id"], props: { stock: "unidades disponíveis somadas", color: "cor aberta" }, aliases: { ga4: "view_item", segment: "Product Viewed" }, example: { product_id: "p1", price: 349.9, props: { stock: 14 } } },
  { name: "color_select", group: "produto", description: "Escolha de cor.", when: "Ao escolher uma cor na página do produto.", fields: ["product_id"], props: { color: "cor escolhida" }, example: { product_id: "p1", props: { color: "Preto" } } },
  { name: "size_select", group: "produto", description: "Escolha de tamanho.", when: "Ao escolher um tamanho disponível.", fields: ["product_id", "variant_id"], props: { size: "tamanho escolhido" }, example: { product_id: "p1", variant_id: "v1", props: { size: "37" } } },
  { name: "favorite_add", group: "produto", description: "Produto favoritado.", when: "Ao favoritar.", fields: ["product_id", "price"], required: ["product_id"], props: { origin: "lista, página do produto ou favoritos" }, aliases: { ga4: "add_to_wishlist", segment: "Product Added to Wishlist" }, example: { product_id: "p1", props: { origin: "lista" } } },
  { name: "favorite_remove", group: "produto", description: "Favorito removido.", when: "Ao desfavoritar.", fields: ["product_id"], required: ["product_id"], example: { product_id: "p1" } },

  // --- sacola e compra
  { name: "add_to_cart", group: "sacola", description: "Item colocado na sacola.", when: "Ao adicionar uma variação (cor + numeração) à sacola.", fields: ["product_id", "variant_id", "price", "quantity", "cart_value"], required: ["product_id", "variant_id"], props: items, aliases: { ga4: "add_to_cart", segment: "Product Added" }, example: { product_id: "p1", variant_id: "v1", price: 349.9, quantity: 1, cart_value: 349.9 } },
  { name: "remove_from_cart", group: "sacola", description: "Item retirado da sacola.", when: "Ao remover uma variação da sacola.", fields: ["product_id", "variant_id", "price", "quantity", "cart_value"], required: ["product_id", "variant_id"], props: items, aliases: { ga4: "remove_from_cart", segment: "Product Removed" }, example: { product_id: "p1", variant_id: "v1", quantity: 1, cart_value: 0 } },
  { name: "cart_qty_change", group: "sacola", description: "Quantidade alterada na sacola.", when: "Ao mudar a quantidade de um item.", fields: ["product_id", "variant_id", "price", "quantity", "cart_value"], required: ["product_id", "variant_id"], example: { product_id: "p1", variant_id: "v1", quantity: 2, cart_value: 699.8 } },
  { name: "cart_updated", group: "sacola", description: "Retrato da sacola depois de cada mudança.", when: "Depois de cada mudança na sacola (com 1,5 s de espera para juntar mudanças seguidas) e ao abrir o site com a sacola cheia.", fields: ["cart_value", "items_count"], required: ["items_count"], props: items, example: { cart_value: 349.9, items_count: 1, props: { items: [{ item_id: "p1", variant_id: "v1", item_name: "Tênis Luz da Lua", price: 349.9, quantity: 1 }] } } },
  { name: "shipping_quote", group: "sacola", description: "Frete calculado.", when: "Ao calcular o frete pelo CEP.", fields: ["price"], props: { cep3: "3 primeiros dígitos do CEP", days: "prazo em dias" }, example: { price: 24.9, props: { cep3: "013", days: 3 } } },
  { name: "begin_checkout", group: "sacola", description: "Entrada no checkout.", when: "Ao abrir a página de checkout com itens.", fields: ["cart_value", "items_count"], props: items, aliases: { ga4: "begin_checkout", segment: "Checkout Started" }, example: { cart_value: 349.9, items_count: 1 } },
  { name: "checkout_step", group: "sacola", description: "Avanço de etapa do checkout.", when: "Ao concluir uma etapa (endereço, entrega, pagamento).", fields: ["cart_value"], props: { step: "endereco, entrega ou pagamento" }, aliases: { ga4: "add_shipping_info", segment: "Checkout Step Completed" }, example: { props: { step: "entrega" } } },
  { name: "payment_method_selected", group: "sacola", description: "Forma de pagamento escolhida.", when: "Ao escolher Pix ou cartão.", fields: ["cart_value"], props: { method: "pix ou cartao", installments: "parcelas" }, aliases: { ga4: "add_payment_info", segment: "Payment Info Entered" }, example: { props: { method: "pix" } } },
  { name: "purchase", group: "sacola", description: "Pedido criado (gravado pelo servidor).", when: "No servidor, quando o pedido é criado.", fields: ["cart_value", "items_count"], serverOnly: true, props: { order_id: "id do pedido", shipping: "frete", status: "situação do pedido", ...items }, aliases: { ga4: "purchase", segment: "Order Completed" }, example: { cart_value: 349.9, items_count: 1, props: { order_id: "o1", status: "PENDING" } } },

  // --- qualidade da experiência
  { name: "js_error", group: "qualidade", description: "Erro de JavaScript na página.", when: "Em erros não tratados e promessas rejeitadas.", fields: ["error_code"], props: { source: "arquivo", line: "linha" }, aliases: { posthog: "$exception" }, example: { error_code: "TypeError: x is undefined" } },
  { name: "api_error", group: "qualidade", description: "Erro (4xx/5xx) ou falha de rede numa chamada à API.", when: "No navegador, quando uma chamada à API falha; no servidor, em erros 5xx.", fields: ["error_code"], required: ["error_code"], props: { endpoint: "caminho da API sem ids", method: "GET, POST…", ms: "tempo" }, example: { error_code: "500", props: { endpoint: "/orders", method: "POST" } } },
  { name: "web_vital", group: "qualidade", description: "Medida real de velocidade (Core Web Vitals).", when: "Quando o navegador mede LCP, INP, CLS, FCP ou TTFB.", fields: ["value_num"], required: ["value_num"], props: { metric: "LCP, INP, CLS, FCP ou TTFB", rating: "good, needs-improvement ou poor" }, aliases: { posthog: "$web_vitals" }, example: { value_num: 2300, props: { metric: "LCP", rating: "needs-improvement" } } },
  { name: "rage_click", group: "qualidade", description: "Três ou mais cliques rápidos no mesmo ponto.", when: "Quando o cliente clica várias vezes seguidas sem resposta.", fields: [], props: { target: "tag e classe do elemento (sem texto)" }, aliases: { posthog: "$rageclick" }, example: { props: { target: "button.btn" } } },
  { name: "form_error", group: "qualidade", description: "Erro de validação num formulário.", when: "Quando um campo é recusado pelo navegador.", fields: [], props: { form: "id ou nome do formulário", field: "nome do campo", type: "tipo do erro (vazio, formato, tamanho…)" }, example: { props: { form: "endereco", field: "cep", type: "formato" } } },
  { name: "not_found", group: "qualidade", description: "Página não encontrada (404).", when: "Ao abrir uma página que não existe.", fields: [], example: { path: "/produtos/inexistente" } },
  { name: "image_error", group: "qualidade", description: "Imagem que não carregou.", when: "Quando uma imagem da página falha.", fields: [], props: { src_host: "domínio da imagem" }, example: { props: { src_host: "kisapatoback.discloud.dev" } } },

  // --- identidade
  { name: "identify", group: "identidade", description: "Liga o visitante anônimo ao cliente logado (só se ANALYTICS_IDENTIFY estiver ligado).", when: "No servidor, no login, se a medição de identidade estiver ligada.", fields: [], serverOnly: true, example: {} },
];

export const EVENT_BY_NAME: ReadonlyMap<string, EventDef> = new Map(EVENTS.map((e) => [e.name, e]));

/** Nome do evento no destino pedido (nome próprio quando não há tradução). */
export function destinationName(event: string, destination: "ga4" | "segment" | "posthog"): string {
  return EVENT_BY_NAME.get(event)?.aliases?.[destination] ?? event;
}
