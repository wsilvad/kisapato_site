"use client";

import { useEffect, useState } from "react";
import { AddressForm } from "@/components/account/AddressForm";
import { api, type AddressInput } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatZip } from "@/lib/validators";
import type { Address } from "@/types/product";

export default function EnderecosPage() {
  const { user } = useSession();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.account.addresses().then(setAddresses).catch(() => setAddresses([]));
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      setAddresses(await api.account.addresses());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir");
    }
  }

  async function save(data: AddressInput) {
    if (editing && editing !== "new") await api.account.updateAddress(editing.id, data);
    else await api.account.addAddress(data);
    setAddresses(await api.account.addresses());
    setEditing(null);
  }

  return (
    <>
      <h2>Endereços de entrega</h2>
      <p className="muted">Você pode salvar mais de um endereço. O endereço padrão já vem escolhido nas suas compras, e você pode trocar na hora de finalizar.</p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {addresses === null ? <p>Carregando…</p> : addresses.length === 0 && editing === null ? <p>Você ainda não tem endereços salvos.</p> : (
        <ul className="address-list">
          {addresses.map((a) => (
            <li key={a.id} className={`address-card${a.isDefault ? " is-default" : ""}`}>
              <div>
                <strong>{a.label || "Endereço"}</strong>
                {a.isDefault && <span className="tag-default">Padrão</span>}
                <p>
                  {a.recipient}<br />
                  {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ""}<br />
                  {a.district} · {a.city}/{a.state} · CEP {formatZip(a.zip)}
                </p>
              </div>
              <div className="address-actions">
                {!a.isDefault && <button type="button" className="link-btn" onClick={() => run(() => api.account.setDefaultAddress(a.id))}>Tornar padrão</button>}
                <button type="button" className="link-btn" onClick={() => setEditing(a)}>Editar</button>
                <button type="button" className="link-btn danger" onClick={() => { if (window.confirm("Excluir este endereço?")) void run(() => api.account.deleteAddress(a.id)); }}>Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing("new")} disabled={(addresses?.length ?? 0) >= 10}>Adicionar endereço</button>
      ) : (
        <>
          <h3>{editing === "new" ? "Novo endereço" : "Editar endereço"}</h3>
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            defaultRecipient={user?.name ?? ""}
            askDefault={addresses?.length !== 0}
            submitLabel="Salvar endereço"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </>
      )}
    </>
  );
}
