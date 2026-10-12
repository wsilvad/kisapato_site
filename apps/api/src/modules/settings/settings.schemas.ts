import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max).default("");
const link = z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().min(1).max(300) });

/** Conteúdo editável do site. Cada bloco tem padrão, então um banco vazio já renderiza a loja. */
export const siteSettingsSchema = z.object({
  /** Mensagens da barra preta no topo. */
  topbar: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
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
  footer: z
    .object({
      columns: z.array(z.object({ title: z.string().trim().min(1).max(40), links: z.array(link).max(10) })).max(4).default([]),
      storeTitle: text(40),
      address: text(200),
      phone: text(60),
      hours: text(120),
      cnpj: text(30),
      payments: text(160),
    })
    .default({ columns: [], storeTitle: "Nossas lojas", address: "", phone: "", hours: "", cnpj: "", payments: "" }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const SETTINGS_KEY = "site";

export const defaultSiteSettings: SiteSettings = {
  topbar: ["Frete grátis acima de R$ 299", "Até 6x sem juros", "Retire grátis na loja"],
  nav: [
    { label: "Todos os modelos", url: "/produtos", highlight: false },
    { label: "Lançamentos", url: "/produtos", highlight: false },
    { label: "Promoções", url: "/produtos", highlight: true },
  ],
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
  footer: {
    columns: [
      {
        title: "Comprar",
        links: [{ label: "Todos os modelos", url: "/produtos" }],
      },
      {
        title: "Ajuda",
        links: [
          { label: "Minha conta e pedidos", url: "/conta" },
          { label: "Todos os modelos", url: "/produtos" },
        ],
      },
    ],
    storeTitle: "Nossas lojas",
    address: "Santo Antônio da Patrulha, RS",
    phone: "",
    hours: "",
    cnpj: "",
    payments: "Visa · Mastercard · Elo · Hipercard · Boleto · Pix",
  },
};
