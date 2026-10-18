"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Capabilities, SavedCard } from "@/types/product";

const BRAND_NAMES: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", elo: "Elo", hipercard: "Hipercard", amex: "American Express", diners: "Diners" };

export default function CartoesPage() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.account.cards().then(setCards).catch(() => setCards([]));
    api.capabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      setCards(await api.account.cards());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir");
    }
  }

  return (
    <>
      <h2>Cartões salvos</h2>
      <p className="muted">
        Por segurança, o número do seu cartão e o código de segurança (CVV) nunca ficam guardados na Ki Sapato. Eles vão direto para o processador de pagamento, que devolve
        apenas uma identificação protegida. Aqui guardamos só a bandeira, os 4 últimos dígitos e a validade.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {cards === null ? <p>Carregando…</p> : cards.length === 0 ? <p>Você ainda não tem cartões salvos.</p> : (
        <ul className="address-list">
          {cards.map((c) => (
            <li key={c.id} className={`address-card${c.isDefault ? " is-default" : ""}`}>
              <div>
                <strong>{BRAND_NAMES[c.brand.toLowerCase()] ?? c.brand} •••• {c.last4}</strong>
                {c.isDefault && <span className="tag-default">Padrão</span>}
                <p>{c.holderName}<br />Validade {String(c.expMonth).padStart(2, "0")}/{c.expYear}</p>
              </div>
              <div className="address-actions">
                {!c.isDefault && <button type="button" className="link-btn" onClick={() => run(() => api.account.setDefaultCard(c.id))}>Tornar padrão</button>}
                <button type="button" className="link-btn danger" onClick={() => { if (window.confirm("Remover este cartão?")) void run(() => api.account.deleteCard(c.id)); }}>Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn btn-outline btn-sm" disabled>Adicionar cartão</button>
      {caps && !caps.savedCards && (
        <p className="muted">Salvar cartões estará disponível assim que o pagamento on-line da loja for ativado. Seus cartões nunca serão salvos fora do processador de pagamento.</p>
      )}
    </>
  );
}
