import { AppError } from "../../lib/errors.js";
import { getSiteSettings } from "../settings/settings.service.js";
import type { SiteSettings } from "../settings/settings.schemas.js";
import { normalizeCep, stateFromCep } from "./cep.js";

export interface ShippingOption {
  id: string;
  label: string;
  /** 0 = grátis. */
  price: number;
  /** Prazo em dias úteis (retirada na loja usa 0). */
  minDays: number;
  maxDays: number;
  note?: string;
}

export interface ShippingQuote {
  cep: string;
  state: string;
  /** Rua/bairro/cidade, quando o serviço de CEP respondeu; senão só o estado. */
  place: string;
  options: ShippingOption[];
  /** Quanto falta para o frete grátis (null quando já vale ou não existe). */
  freeShippingMissing: number | null;
}

/** Regras puras do cálculo (testáveis sem rede): região pelo estado, frete grátis e retirada na loja. */
export function buildOptions(state: string, subtotal: number, shipping: SiteSettings["shipping"]): { options: ShippingOption[]; freeShippingMissing: number | null } {
  const options: ShippingOption[] = [];
  const region = shipping.regions.find((r) => r.states.includes(state));
  let missing: number | null = null;
  if (region) {
    const free = shipping.freeAbove > 0 && subtotal >= shipping.freeAbove;
    if (shipping.freeAbove > 0 && !free) missing = Math.round((shipping.freeAbove - subtotal) * 100) / 100;
    options.push({ id: "delivery", label: `Entrega — ${region.name}`, price: free ? 0 : region.price, minDays: region.minDays, maxDays: region.maxDays });
  }
  if (shipping.pickup.active) {
    options.push({ id: "pickup", label: shipping.pickup.label, price: 0, minDays: 0, maxDays: 0, note: shipping.pickup.note || undefined });
  }
  return { options, freeShippingMissing: missing };
}

/** Endereço do CEP no ViaCEP (melhor esforço: se cair ou demorar, segue só com o estado). `null` = CEP inexistente. */
async function lookupAddress(cep: string): Promise<{ place: string; state?: string } | "unknown" | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return "unknown";
    const data = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (data.erro) return null;
    return { place: [data.logradouro, data.bairro, data.localidade && data.uf ? `${data.localidade}/${data.uf}` : data.localidade].filter(Boolean).join(" · "), state: data.uf };
  } catch {
    return "unknown";
  }
}

export async function quoteShipping(rawCep: string, subtotal: number): Promise<ShippingQuote> {
  const cep = normalizeCep(rawCep);
  if (!cep) throw new AppError("Informe um CEP com 8 números.", 400);
  const address = await lookupAddress(cep);
  if (address === null) throw new AppError("CEP não encontrado.", 404);
  const state = (address !== "unknown" ? address.state : undefined) ?? stateFromCep(cep);
  if (!state) throw new AppError("CEP não encontrado.", 404);

  const settings = await getSiteSettings();
  const { options, freeShippingMissing } = buildOptions(state, subtotal, settings.shipping);
  return { cep, state, place: address !== "unknown" && address.place ? address.place : state, options, freeShippingMissing };
}
