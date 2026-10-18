import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max).default("");
const link = z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().min(1).max(300) });

/** Conteúdo editável do site. Cada bloco tem padrão, então um banco vazio já renderiza a loja. */
const shippingRegion = z.object({
  name: z.string().trim().min(1).max(40),
  states: z.array(z.string().trim().toUpperCase().length(2)).min(1).max(27),
  price: z.coerce.number().min(0).max(10_000),
  minDays: z.coerce.number().int().min(0).max(60),
  maxDays: z.coerce.number().int().min(0).max(90),
});

/** Frete: tabela por região (estados), frete grátis acima de um valor e retirada na loja. */
const shippingSchema = z.object({
  /** Valor da compra a partir do qual a entrega é grátis (0 = não existe frete grátis). */
  freeAbove: z.coerce.number().min(0).max(100_000),
  pickup: z.object({ active: z.boolean(), label: z.string().trim().min(1).max(60), note: z.string().trim().max(120) }),
  regions: z.array(shippingRegion).max(12),
});

export const defaultShipping: z.infer<typeof shippingSchema> = {
  freeAbove: 299,
  pickup: { active: true, label: "Retirar na loja", note: "Sem custo. Avisamos quando estiver pronto." },
  // Valores iniciais de exemplo: ajuste no painel (Textos e menu → Frete) conforme o contrato com a transportadora.
  regions: [
    { name: "Rio Grande do Sul", states: ["RS"], price: 18.9, minDays: 2, maxDays: 5 },
    { name: "Sul", states: ["SC", "PR"], price: 24.9, minDays: 3, maxDays: 6 },
    { name: "Sudeste", states: ["SP", "RJ", "MG", "ES"], price: 29.9, minDays: 4, maxDays: 8 },
    { name: "Centro-Oeste", states: ["DF", "GO", "MT", "MS"], price: 36.9, minDays: 5, maxDays: 10 },
    { name: "Nordeste", states: ["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"], price: 39.9, minDays: 7, maxDays: 12 },
    { name: "Norte", states: ["AM", "PA", "AC", "RO", "RR", "AP", "TO"], price: 49.9, minDays: 9, maxDays: 15 },
  ],
};

/**
 * Textos iniciais das páginas institucionais (rascunho para a loja revisar no painel). Parágrafos separados por
 * linha em branco; "## " abre um subtítulo e "- " um item de lista.
 */
export const defaultPages = [
  {
    slug: "quem-somos",
    title: "Quem somos",
    body: [
      "A Ki Sapato é uma loja de calçados de Santo Antônio da Patrulha, no Rio Grande do Sul, com modelos femininos, masculinos e infantis das marcas que você confia.",
      "No site você encontra os lançamentos e as promoções da loja, com o mesmo cuidado do atendimento no balcão: escolha o seu número, receba em casa ou retire na loja sem custo.",
      "## Nosso jeito de atender",
      "Um bom sapato acompanha cada passo do dia. Por isso ajudamos você a escolher o modelo e o número certos e facilitamos a troca quando algo não serve.",
    ].join("\n\n"),
  },
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    body: [
      "## Direito de arrependimento",
      "Compras feitas pelo site podem ser devolvidas em até 7 dias corridos a partir do recebimento, como garante o Código de Defesa do Consumidor (art. 49). Devolvemos o valor pago, incluindo o frete.",
      "## Trocas",
      "A primeira troca é grátis. Para trocar de número ou de modelo em até 30 dias após o recebimento, o produto precisa estar sem sinais de uso, na embalagem original e com a etiqueta.",
      "## Como pedir",
      "- Fale com a gente pelos canais de atendimento informando o número do pedido.\n- Se preferir, faça a troca direto na loja física.",
      "## Produto com defeito",
      "Se o produto apresentar defeito de fabricação, entre em contato em até 90 dias do recebimento para análise e troca.",
    ].join("\n\n"),
  },
  {
    slug: "politicas-de-entrega",
    title: "Políticas de entrega",
    body: [
      "Enviamos para todo o Brasil. O prazo de entrega começa a contar depois da confirmação do pagamento e aparece no carrinho assim que você informa o CEP.",
      "Você também pode retirar o pedido na loja, sem custo: avisamos assim que ele estiver pronto.",
    ].join("\n\n"),
  },
  { slug: "blog", title: "Blog", body: "" },
  { slug: "avaliacoes", title: "Avaliação dos clientes", body: "" },
];

/** Meios de pagamento com logo no rodapé (o site tem o desenho de cada um). */
export const PAYMENT_METHODS = ["visa", "mastercard", "elo", "hipercard", "amex", "diners", "boleto", "pix"] as const;
const DEFAULT_PAYMENT_METHODS = ["visa", "mastercard", "elo", "hipercard", "boleto", "pix"] as const;

export const siteSettingsSchema = z.object({
  shipping: shippingSchema.default(defaultShipping),
  /** Mensagens da barra preta no topo. */
  topbar: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
  /** Perfis da loja nas redes sociais (ícones do cabeçalho); vazio = ícone escondido. */
  social: z
    .object({ instagram: text(300), facebook: text(300), pinterest: text(300), tiktok: text(300) })
    .default({ instagram: "", facebook: "", pinterest: "", tiktok: "" }),
  /** Links do menu principal; `highlight` pinta o item (ex.: Promoções). */
  nav: z.array(link.extend({ highlight: z.boolean().default(false) })).max(10).default([]),
  /** Faixa escura entre as vitrines da home. */
  promo: z
    .object({
      active: z.boolean().default(true),
      eyebrow: text(80),
      title: text(120),
      buttonLabel: text(40),
      buttonUrl: text(300),
    })
    .default({ active: true, eyebrow: "", title: "", buttonLabel: "", buttonUrl: "" }),
  /** Faixa de benefícios no fim da home. */
  benefits: z.array(z.object({ title: z.string().trim().min(1).max(60), text: text(100) })).max(6).default([]),
  /** Páginas institucionais (/institucional/<slug>): texto livre; página sem texto fica fora do ar e some do rodapé. */
  pages: z
    .array(z.object({ slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(60), title: z.string().trim().min(1).max(80), body: text(20000) }))
    .max(12)
    .default(() => defaultPages),
  footer: z
    .object({
      columns: z.array(z.object({ title: z.string().trim().min(1).max(40), links: z.array(link).max(10) })).max(4).default([]),
      storeTitle: text(40),
      address: text(200),
      phone: text(60),
      hours: text(120),
      cnpj: text(30),
      /** Bandeiras e meios de pagamento exibidos no rodapé (logos), na ordem escolhida. */
      paymentMethods: z.array(z.enum(PAYMENT_METHODS)).max(PAYMENT_METHODS.length).default(() => [...DEFAULT_PAYMENT_METHODS]),
    })
    .default({ columns: [], storeTitle: "Nossas lojas", address: "", phone: "", hours: "", cnpj: "", paymentMethods: [...DEFAULT_PAYMENT_METHODS] }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const SETTINGS_KEY = "site";

export const defaultSiteSettings: SiteSettings = {
  topbar: ["Frete grátis acima de R$ 299", "Até 6x sem juros", "Retire grátis na loja"],
  nav: [
    { label: "Todos os produtos", url: "/produtos", highlight: false },
    { label: "Lançamentos", url: "/produtos?selo=lancamento", highlight: false },
    { label: "Promoções", url: "/produtos?selo=promocao", highlight: true },
  ],
  social: { instagram: "", facebook: "", pinterest: "", tiktok: "" },
  shipping: defaultShipping,
  promo: {
    active: true,
    eyebrow: "Promoções da semana",
    title: "Ofertas que cabem no seu passo",
    buttonLabel: "Aproveitar",
    buttonUrl: "/produtos",
  },
  benefits: [
    { title: "Frete grátis", text: "Acima de R$ 299" },
    { title: "Retire na loja", text: "Sem custo" },
    { title: "Até 6x sem juros", text: "Cartão, Pix ou boleto" },
    { title: "Troca fácil", text: "Primeira troca grátis" },
  ],
  pages: defaultPages,
  footer: {
    // “Ajuda” (conta, pedidos, favoritos, trocas, entrega) agora fica no menu do ícone de perfil do cabeçalho.
    columns: [
      {
        title: "Institucional",
        links: [
          { label: "Quem somos", url: "/institucional/quem-somos" },
          { label: "Blog", url: "/institucional/blog" },
          { label: "Avaliação dos clientes", url: "/institucional/avaliacoes" },
        ],
      },
    ],
    storeTitle: "Nossas lojas",
    address: "Santo Antônio da Patrulha, RS",
    phone: "",
    hours: "",
    cnpj: "",
    paymentMethods: [...DEFAULT_PAYMENT_METHODS],
  },
};
