"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatCpf, formatPhone, isFullName, isValidCpf, isValidPhone, onlyDigits } from "@/lib/validators";
import type { Capabilities } from "@/types/product";

export default function DadosPage() {
  const { user, updateUser } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [cpf, setCpf] = useState(formatCpf(user?.cpf ?? ""));
  const [phone, setPhone] = useState(formatPhone(user?.phone ?? ""));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [phoneMsg, setPhoneMsg] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  if (!user) return null;

  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError("");
    if (!isFullName(name)) return setError("Informe seu nome completo (nome e sobrenome).");
    if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os números.");
    if (user?.phone && !phone) return setError("O telefone é obrigatório.");
    if (phone && !isValidPhone(phone)) return setError("Telefone inválido. Use DDD + número, ex.: (51) 99999-8888.");
    setBusy(true);
    try {
      updateUser(await api.account.updateProfile({ name: name.trim(), cpf: onlyDigits(cpf), phone: phone || undefined }));
      setSaved(true);
      setCodeSent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setPhoneBusy(true);
    setPhoneMsg("");
    try {
      await api.account.sendPhoneCode();
      setCodeSent(true);
      setPhoneMsg("Enviamos um código de 6 dígitos por SMS. Ele vale por 15 minutos.");
    } catch (err) {
      setPhoneMsg(err instanceof Error ? err.message : "Não foi possível enviar o código");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmPhone(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhoneBusy(true);
    setPhoneMsg("");
    try {
      updateUser(await api.account.confirmPhone(code.trim()));
      setCodeSent(false);
      setCode("");
    } catch (err) {
      setPhoneMsg(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setPhoneBusy(false);
    }
  }

  const phoneChanged = onlyDigits(phone) !== onlyDigits(user.phone ?? "");

  return (
    <>
      <h2>Meus dados</h2>
      <form className="form narrow-form" onSubmit={save} noValidate>
        <label>Nome completo<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
        <label>CPF<input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" /></label>
        <label>
          E-mail
          <input value={user.email} readOnly aria-readonly="true" />
          <small className="field-hint">O e-mail é o seu login. Para trocá-lo, fale com a loja.</small>
        </label>
        <label>
          Telefone
          <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required={Boolean(user.phone)} inputMode="tel" autoComplete="tel" placeholder="(51) 99999-8888" />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="form-ok" role="status">Dados salvos.</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? "Salvando…" : "Salvar dados"}</button>
      </form>

      <h3>Telefone para recuperar a senha</h3>
      {!user.phone || phoneChanged ? (
        <p className="muted">{phoneChanged ? "Salve o novo telefone para poder confirmá-lo." : "Cadastre um telefone acima para usá-lo na recuperação da senha."}</p>
      ) : user.phoneVerified ? (
        <p className="form-ok">Telefone confirmado: você pode recuperar a senha por ele ou pelo e-mail.</p>
      ) : caps?.smsRecovery ? (
        <div className="phone-verify">
          <p>Confirme seu telefone para poder recuperar a senha por SMS. Hoje a recuperação só funciona pelo e-mail.</p>
          {!codeSent ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={sendCode} disabled={phoneBusy}>{phoneBusy ? "Enviando…" : "Enviar código por SMS"}</button>
          ) : (
            <form className="form narrow-form" onSubmit={confirmPhone}>
              <label>Código recebido<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" className="code-input" placeholder="000000" /></label>
              <button className="btn btn-solid btn-sm" disabled={phoneBusy}>Confirmar telefone</button>
              <button type="button" className="link-btn" onClick={sendCode} disabled={phoneBusy}>Enviar de novo</button>
            </form>
          )}
          {phoneMsg && <p role="status">{phoneMsg}</p>}
        </div>
      ) : (
        <p className="muted">A confirmação do telefone por SMS ainda não está disponível. Por enquanto, a recuperação de senha é feita pelo e-mail.</p>
      )}
    </>
  );
}
