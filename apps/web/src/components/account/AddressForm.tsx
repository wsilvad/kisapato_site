"use client";

import { useState } from "react";
import type { AddressInput } from "@/lib/api";
import { formatZip, lookupZip, onlyDigits, UFS } from "@/lib/validators";
import type { Address } from "@/types/product";

/**
 * Formulário de endereço de entrega (conta e checkout). O CEP preenche rua, bairro, cidade e UF sozinho (ViaCEP);
 * o cliente pode corrigir qualquer campo. `onSubmit` recebe os dados já com CEP só em dígitos.
 */
export function AddressForm({
  initial,
  submitLabel,
  defaultRecipient = "",
  askDefault = true,
  askSave = false,
  onSubmit,
  onCancel,
}: {
  initial?: Address;
  submitLabel: string;
  defaultRecipient?: string;
  /** Mostra “Usar como endereço padrão”. */
  askDefault?: boolean;
  /** Mostra “Salvar este endereço na minha conta” (checkout). */
  askSave?: boolean;
  onSubmit: (data: AddressInput, options: { save: boolean }) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [zip, setZip] = useState(formatZip(initial?.zip ?? ""));
  const [street, setStreet] = useState(initial?.street ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [looking, setLooking] = useState(false);
  const [zipNote, setZipNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function fillFromZip() {
    if (onlyDigits(zip).length !== 8) return;
    setLooking(true);
    setZipNote("");
    const found = await lookupZip(zip);
    setLooking(false);
    if (!found) return setZipNote("Não achamos esse CEP. Preencha o endereço manualmente.");
    if (found.street) setStreet(found.street);
    if (found.district) setDistrict(found.district);
    if (found.city) setCity(found.city);
    if ((UFS as readonly string[]).includes(found.state)) setState(found.state);
  }

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (onlyDigits(zip).length !== 8) return setError("O CEP tem 8 dígitos.");
    if (!state) return setError("Escolha o estado (UF).");
    setBusy(true);
    setError("");
    try {
      await onSubmit(
        {
          label: String(f.get("label") ?? "").trim() || undefined,
          recipient: String(f.get("recipient")).trim(),
          zip: onlyDigits(zip),
          street: street.trim(),
          number: String(f.get("number")).trim(),
          complement: String(f.get("complement") ?? "").trim() || undefined,
          district: district.trim(),
          city: city.trim(),
          state,
          isDefault: askDefault ? f.get("isDefault") === "on" : undefined,
        },
        { save: askSave ? f.get("save") === "on" : false },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o endereço");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form address-form" onSubmit={submit}>
      <label>Apelido (opcional)<input name="label" defaultValue={initial?.label ?? ""} maxLength={30} placeholder="Casa, Trabalho…" /></label>
      <label>Quem recebe<input name="recipient" required defaultValue={initial?.recipient ?? defaultRecipient} autoComplete="name" /></label>
      <label>
        CEP
        <input value={zip} onChange={(e) => setZip(formatZip(e.target.value))} onBlur={fillFromZip} required inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" />
        {looking && <small className="field-hint">Buscando endereço…</small>}
        {zipNote && <small className="field-hint">{zipNote}</small>}
      </label>
      <label>Rua<input value={street} onChange={(e) => setStreet(e.target.value)} required autoComplete="address-line1" /></label>
      <div className="form-row">
        <label>Número<input name="number" required defaultValue={initial?.number ?? ""} /></label>
        <label>Complemento<input name="complement" defaultValue={initial?.complement ?? ""} autoComplete="address-line2" /></label>
      </div>
      <label>Bairro<input value={district} onChange={(e) => setDistrict(e.target.value)} required /></label>
      <div className="form-row">
        <label>Cidade<input value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" /></label>
        <label>
          UF
          <select value={state} onChange={(e) => setState(e.target.value)} required autoComplete="address-level1">
            <option value="">—</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </label>
      </div>
      {askDefault && (
        <label className="check-row"><input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault ?? false} disabled={initial?.isDefault} /> Usar como endereço padrão das compras</label>
      )}
      {askSave && <label className="check-row"><input type="checkbox" name="save" defaultChecked /> Salvar este endereço na minha conta</label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-solid" disabled={busy}>{busy ? "Salvando…" : submitLabel}</button>
        {onCancel && <button type="button" className="link-btn" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
