import { api } from "@/lib/api";
import type { SiteSettings } from "@/types/product";

/** Reserva usada quando a API está fora do ar, para a loja não ficar sem menu e rodapé. */
export const fallbackSettings: SiteSettings = {
  topbar: ["Frete grátis acima de R$ 299", "Até 6x sem juros", "Retire grátis na loja"],
  nav: [
    { label: "Todos os produtos", url: "/produtos", highlight: false },
    { label: "Lançamentos", url: "/produtos?selo=lancamento", highlight: false },
    { label: "Promoções", url: "/produtos?selo=promocao", highlight: true },
  ],
  shipping: { freeAbove: 0, pickup: { active: true, label: "Retirar na loja", note: "" }, regions: [] },
  promo: { active: false, eyebrow: "", title: "", buttonLabel: "", buttonUrl: "" },
  benefits: [],
  footer: { columns: [], storeTitle: "Nossas lojas", address: "", phone: "", hours: "", cnpj: "", payments: "" },
};

export async function loadSettings(): Promise<SiteSettings> {
  try {
    return await api.settings();
  } catch {
    return fallbackSettings;
  }
}
