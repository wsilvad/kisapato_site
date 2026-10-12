import { api } from "@/lib/api";
import type { SiteSettings } from "@/types/product";

/** Reserva usada quando a API está fora do ar, para a loja não ficar sem menu e rodapé. */
export const fallbackSettings: SiteSettings = {
  topbar: ["Frete grátis acima de R$ 299", "Até 6x sem juros", "Retire grátis na loja"],
  nav: [
    { label: "Todos os modelos", url: "/produtos", highlight: false },
    { label: "Promoções", url: "/produtos", highlight: true },
  ],
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
