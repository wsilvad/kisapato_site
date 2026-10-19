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
    title: "Sobre a Ki Sapato",
    // Formato editorial (ver web/src/lib/page-body.ts): foto no topo, frase de destaque, seções "## Rótulo | Título",
    // foto na lateral do texto (lado=…) e grupo de fotos lado a lado (linhas de foto seguidas). As fotos são provisórias:
    // a loja troca pelas suas no painel (Textos e menu → Páginas → Fotos da página).
    body: [
      "![Moda para todos os passos](/uploads/ebf5fdaa-ccbc-4bd1-8688-a989c9393230.jpg)",
      "Há mais de 50 anos, construindo uma história de tradição, confiança e qualidade.",
      "## A loja | Nossa história",
      "![Vitrine da Ki Sapato](/uploads/044b5cb7-5abb-43f3-b550-407aa1cfd5f8.jpg){r=4:5 lado=esquerda}",
      "A Ki Sapato é uma loja de calçados de Santo Antônio da Patrulha, no Rio Grande do Sul, com modelos femininos, masculinos e infantis das marcas que você confia.",
      "## Santo Antônio da Patrulha | Nossa loja",
      [
        "![Foto da loja 1](/uploads/088d9036-32dd-4f5a-adf9-f6be30ed2c86.jpg)",
        "![Foto da loja 2](/uploads/7661c718-81b0-44b9-8268-d0b492381fb1.jpg)",
        "![Foto da loja 3](/uploads/e5098137-09d3-4bbe-a633-90467db477d4.jpg)",
      ].join("\n"),
      "## Compromisso | Produtos originais, das melhores marcas",
      "![Calçados selecionados](/uploads/6a1b3df4-6c58-448c-b0d4-6551866f4c1e.jpg){r=4:5 lado=direita}",
      "Ao longo de nossa trajetória, cultivamos o compromisso de oferecer produtos originais, das melhores marcas, cuidadosamente selecionados com base nas tendências da moda e em um olhar atento a cada detalhe.",
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
  {
    slug: "fale-conosco",
    title: "Fale conosco",
    body: [
      "Estamos aqui para ajudar com seu pedido, trocas, tamanhos ou qualquer dúvida sobre os produtos. O atendimento é feito de segunda a sábado, em horário comercial, e respondemos o mais rápido possível.",
      "## Pedidos e trocas",
      "Para falar de um pedido, informe o número dele. Você acompanha tudo em Minha conta → Meus pedidos. Para trocas e devoluções, veja a página Política de troca.",
      "## Na loja",
      "Prefere conversar pessoalmente? Venha até a nossa loja: o atendimento presencial resolve trocas, retiradas e dúvidas na hora.",
    ].join("\n\n"),
  },
  {
    slug: "perguntas-frequentes",
    title: "Perguntas frequentes",
    // Cada "## Pergunta" vira um item suspenso; o texto abaixo dela é a resposta.
    body: [
      "## Qual é o prazo de entrega?",
      "O prazo depende da sua região e aparece no carrinho assim que você informa o CEP. Ele começa a contar depois da confirmação do pagamento. Veja os valores e prazos por região em Políticas de entrega.",
      "## Posso retirar o pedido na loja?",
      "Sim, sem custo. Escolha a retirada na loja ao finalizar a compra e avisamos assim que o pedido estiver pronto.",
      "## Quais são as formas de pagamento?",
      "Cartão de crédito em até 6x sem juros, Pix e boleto bancário.",
      "## Como funcionam as trocas e devoluções?",
      "A primeira troca é grátis, em até 30 dias após o recebimento, com o produto sem sinais de uso, na embalagem original e com etiqueta. Você também pode se arrepender da compra em até 7 dias corridos. Os detalhes estão na página Política de troca.",
      "## Como escolho o tamanho certo?",
      "Na página do produto, escolha a cor e depois a numeração: os tamanhos sem estoque aparecem riscados. Em caso de dúvida, fale conosco ou passe na loja para experimentar.",
      "## Os produtos são originais?",
      "Sim. Trabalhamos com produtos originais, das melhores marcas, selecionados com cuidado pela nossa equipe.",
      "## Como acompanho meu pedido?",
      "Entre na sua conta e abra Meus pedidos. Lá você vê o andamento e o status de cada compra.",
      "## Esqueci minha senha. E agora?",
      "Na tela de entrar, escolha a recuperação de senha e informe seu e-mail ou o telefone cadastrado: enviamos um código para você criar uma senha nova.",
    ].join("\n\n"),
  },
  {
    slug: "nossas-lojas",
    title: "Nossas lojas",
    body: [
      "A Ki Sapato é uma loja de calçados de Santo Antônio da Patrulha, no Rio Grande do Sul, com modelos femininos, masculinos e infantis das marcas que você confia.",
      "Venha conhecer as novidades, experimentar os modelos e ser atendido pessoalmente pela nossa equipe. Retirar o pedido na loja é sem custo.",
    ].join("\n\n"),
  },
  {
    slug: "termos-de-uso",
    title: "Termos de uso",
    body: [
      "Estes termos regulam o uso do site da Ki Sapato e as compras feitas nele. Ao navegar ou comprar, você concorda com as regras abaixo.",
      "## Cadastro e conta",
      "Para comprar é preciso criar uma conta com nome completo, e-mail, telefone, CPF e senha forte. Os dados devem ser verdadeiros e atuais, e a senha é pessoal: não a compartilhe. Você pode ativar a verificação em duas etapas para proteger sua conta.",
      "## Produtos, preços e estoque",
      "As fotos e descrições são ilustrativas e podem ter pequenas variações de cor conforme a tela. Preços e estoque podem mudar sem aviso, e o preço válido é o exibido no fechamento do pedido. Em caso de erro evidente de preço ou de falta de estoque, entramos em contato para ajustar ou cancelar o pedido.",
      "## Pagamento",
      "Aceitamos as formas de pagamento mostradas no site. O pedido só é preparado depois da confirmação do pagamento. Não guardamos os dados completos do seu cartão: eles são tratados pelo meio de pagamento.",
      "## Entrega, trocas e garantia",
      "Prazos e valores de entrega estão na página Políticas de entrega. Trocas, devoluções e o direito de arrependimento seguem a página Política de troca, e a garantia contra defeitos segue a Política de garantia e conservação, sempre de acordo com o Código de Defesa do Consumidor.",
      "## Uso do site e propriedade intelectual",
      "Os textos, fotos, marcas e o layout do site pertencem à Ki Sapato e aos seus parceiros. É proibido copiar ou usar esse conteúdo sem autorização, e também tentar acessar áreas restritas, burlar a segurança ou usar o site para fins ilegais.",
      "## Responsabilidades",
      "Nos esforçamos para manter o site disponível, mas podem ocorrer interrupções para manutenção ou por falhas fora do nosso controle. Não nos responsabilizamos por links de terceiros nem por uso indevido da sua conta por compartilhamento de senha.",
      "## Alterações e contato",
      "Podemos atualizar estes termos a qualquer momento; a versão em vigor é a publicada nesta página. Dúvidas? Fale conosco.",
    ].join("\n\n"),
  },
  {
    slug: "politica-de-privacidade",
    title: "Política de privacidade",
    body: [
      "A Ki Sapato (CNPJ 51.326.310/0001-31) respeita a sua privacidade e trata seus dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).",
      "## Quais dados coletamos",
      "Nome completo, e-mail, telefone, CPF, endereços de entrega, histórico de pedidos e favoritos. Para pagamentos com cartão, apenas um código seguro (token) fornecido pelo meio de pagamento é guardado, nunca o número completo do cartão. Também usamos informações técnicas básicas de navegação para o site funcionar e ser protegido.",
      "## Para que usamos",
      "Criar e proteger sua conta, processar e entregar pedidos, emitir nota fiscal (por isso pedimos o CPF), confirmar e-mail e telefone, recuperar sua senha, atender você e cumprir obrigações legais.",
      "## Com quem compartilhamos",
      "Somente o necessário para concluir a sua compra: meios de pagamento, transportadoras e correios, serviços de e-mail e mensagens que enviam seus códigos e avisos, e o sistema de gestão da loja. Não vendemos seus dados.",
      "## Segurança",
      "Suas senhas são guardadas de forma criptografada e você pode ativar a verificação em duas etapas. Mesmo assim, nenhum sistema é totalmente invulnerável: se notar algo estranho na sua conta, fale conosco.",
      "## Por quanto tempo guardamos",
      "Pelo tempo necessário para as finalidades acima e para cumprir prazos legais, fiscais e de defesa do consumidor. Depois disso, os dados são apagados ou anonimizados.",
      "## Seus direitos",
      "Você pode pedir a confirmação do tratamento, o acesso, a correção, a anonimização ou a exclusão dos seus dados, a portabilidade e a revogação de consentimentos. Parte dos dados pode ser alterada direto em Minha conta; para o restante, fale conosco.",
      "## Cookies e atualizações",
      "Usamos apenas os cookies e armazenamentos do navegador necessários para manter você conectado e guardar sacola e favoritos. Esta política pode ser atualizada, e a versão em vigor é a publicada aqui.",
    ].join("\n\n"),
  },
  {
    slug: "politica-de-garantia-e-conservacao",
    title: "Política de garantia e conservação",
    body: [
      "## Garantia",
      "Todos os produtos têm garantia legal contra defeitos de fabricação de 90 dias, contados do recebimento, conforme o Código de Defesa do Consumidor. Se o produto apresentar defeito, entre em contato com a nossa equipe dentro desse prazo, informando o número do pedido e, se possível, enviando fotos. Analisamos o caso e, confirmado o defeito, fazemos a troca ou a solução prevista em lei.",
      "## O que a garantia não cobre",
      "Desgaste natural pelo uso, danos causados por mau uso, lavagem ou limpeza inadequadas, exposição excessiva a calor, umidade ou produtos químicos, e alterações feitas por terceiros no produto.",
      "## Conservação de calçados",
      "- Guarde em local arejado, longe do sol e da umidade, de preferência com enchimento para manter o formato.\\n- Limpe couro e sintético com pano levemente úmido e hidrate o couro de tempos em tempos.\\n- Escove camurça e nobuck com escova própria, sem molhar.\\n- Alterne os pares: dar descanso ao calçado prolonga a vida útil.",
      "## Conservação de bolsas e acessórios",
      "- Evite excesso de peso e contato com superfícies ásperas.\\n- Guarde na embalagem ou em capa de tecido, longe do sol.\\n- Limpe com pano macio; não use produtos abrasivos.",
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
      /** Número do WhatsApp com DDI e DDD (ex.: +5551998113318): botão flutuante da loja e link no Fale conosco. Vazio = sem botão. */
      whatsapp: text(30),
      /** Coordenadas da loja no mapa ("latitude,longitude"), para o mapa de Nossas lojas. Vazio = sem mapa. */
      mapCoords: text(60),
      /** Bandeiras e meios de pagamento exibidos no rodapé (logos), na ordem escolhida. */
      paymentMethods: z.array(z.enum(PAYMENT_METHODS)).max(PAYMENT_METHODS.length).default(() => [...DEFAULT_PAYMENT_METHODS]),
    })
    .default({ columns: [], storeTitle: "Nossas lojas", address: "", phone: "", hours: "", cnpj: "", whatsapp: "", mapCoords: "", paymentMethods: [...DEFAULT_PAYMENT_METHODS] }),
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
    // “Ajuda” traz o atendimento (fale conosco e perguntas frequentes); conta, pedidos e favoritos ficam no menu do ícone de perfil.
    columns: [
      {
        title: "Ajuda",
        links: [
          { label: "Fale conosco", url: "/institucional/fale-conosco" },
          { label: "Perguntas frequentes", url: "/institucional/perguntas-frequentes" },
        ],
      },
      {
        title: "Institucional",
        links: [
          { label: "Sobre a Ki Sapato", url: "/institucional/quem-somos" },
          { label: "Política de troca", url: "/institucional/trocas-e-devolucoes" },
          { label: "Nossas lojas", url: "/institucional/nossas-lojas" },
          { label: "Termos de uso", url: "/institucional/termos-de-uso" },
          { label: "Política de privacidade", url: "/institucional/politica-de-privacidade" },
          { label: "Política de garantia e conservação", url: "/institucional/politica-de-garantia-e-conservacao" },
        ],
      },
    ],
    storeTitle: "Nossas lojas",
    address: "Av. Cel. Victor Villa Verde, 300 - Sala 06 | Pátio Urbano - Santo Antônio da Patrulha, RS",
    phone: "(51) 99811-3318",
    hours: "",
    cnpj: "51.326.310/0001-31",
    whatsapp: "+5551998113318",
    // Pátio Urbano (Av. Cel. Victor Villa Verde, 300), pelo link do Google Maps da loja
    mapCoords: "-29.830261,-50.5242959",
    paymentMethods: [...DEFAULT_PAYMENT_METHODS],
  },
};
