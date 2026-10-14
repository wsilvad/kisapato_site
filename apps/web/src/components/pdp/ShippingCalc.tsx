"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { ShippingOption, ShippingQuote } from "@/types/product";

const CEP_KEY = "ki-sapato:cep";
const mask = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

function deadline(o: ShippingOption) {
  if (o.maxDays === 0) return "Retire quando estiver pronto";
  return o.minDays === o.maxDays ? `${o.minDays} dias úteis` : `${o.minDays} a ${o.maxDays} dias úteis`;
}

/** Calcula frete e prazo pelo CEP. `subtotal` entra na regra do frete grátis; o total mostra produto + frete. */
export function ShippingCalc({ subtotal }: { subtotal: number }) {
  const [cep, setCep] = useState("");
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- CEP lembrado de uma visita anterior
      setCep(window.localStorage.getItem(CEP_KEY) ?? "");
    } catch {
      /* sem armazenamento */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cep.replace(/\D/g, "").length !== 8) return setError("Digite o CEP com 8 números.");
    setLoading(true);
    setError("");
    try {
      setQuote(await api.shippingQuote(cep, subtotal));
      try {
        window.localStorage.setItem(CEP_KEY, cep);
      } catch {
        /* ignora */
      }
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "Não foi possível calcular agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ship" aria-labelledby="ship-title">
      <h2 id="ship-title">Calcule o frete e o prazo</h2>
      <form onSubmit={submit} className="ship-form">
        <input value={cep} onChange={(e) => (setCep(mask(e.target.value)), setError(""))} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" aria-label="CEP" maxLength={9} />
        <button className="btn btn-solid" disabled={loading}>{loading ? "Calculando…" : "Calcular"}</button>
      </form>
      <a className="ship-help" href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer">Não sei meu CEP</a>
      {error && <p className="form-error" role="alert">{error}</p>}

      {quote && (
        <div className="ship-result" aria-live="polite">
          <p className="ship-place">Entrega para <strong>{quote.place}</strong></p>
          {quote.options.length === 0 ? (
            <p>Ainda não entregamos nessa região.</p>
          ) : (
            <ul>
              {quote.options.map((o) => (
                <li key={o.id}>
                  <div>
                    <strong>{o.label}</strong>
                    <small>{deadline(o)}{o.note ? ` · ${o.note}` : ""}</small>
                  </div>
                  <div className="ship-price">
                    <strong className={o.price === 0 ? "free" : undefined}>{o.price === 0 ? "Grátis" : formatPrice(o.price)}</strong>
                    <small>Total {formatPrice(subtotal + o.price)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {quote.freeShippingMissing !== null && quote.freeShippingMissing > 0 && (
            <p className="ship-note">Faltam <strong>{formatPrice(quote.freeShippingMissing)}</strong> em produtos para o frete ser grátis.</p>
          )}
          <p className="ship-note">Os prazos contam em dias úteis a partir da confirmação do pagamento.</p>
        </div>
      )}
    </section>
  );
}
