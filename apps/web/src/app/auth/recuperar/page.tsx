"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/account/PasswordInput";
import { api } from "@/lib/api";
import { isStrongPassword } from "@/lib/validators";
import type { Capabilities } from "@/types/product";

/** Recuperar a senha: o cliente informa o e-mail da conta (ou um telefone já confirmado), recebe um código e define a nova senha. */
export default function RecuperarSenhaPage() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [step, setStep] = useState<"ask" | "code" | "done">("ask");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  const phoneRecovery = caps?.smsRecovery === true;

  async function sendCode(e?: React.SubmitEvent<HTMLFormElement>) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await api.forgotPassword(identifier.trim());
      setInfo(res.message);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o código");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) return setError("O código tem 6 dígitos.");
    if (!isStrongPassword(password)) return setError("A senha ainda não cumpre todas as regras abaixo do campo.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setBusy(true);
    try {
      await api.resetPassword({ identifier: identifier.trim(), code: code.trim(), newPassword: password });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="page narrow">
        <h1 className="page-title">Senha redefinida</h1>
        <p>Pronto! Sua senha foi alterada e as sessões abertas em outros aparelhos foram encerradas.</p>
        <Link href="/auth" className="btn btn-solid">Entrar</Link>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">Recuperar senha</h1>
      {step === "ask" ? (
        <form className="form" onSubmit={sendCode}>
          <p>{phoneRecovery ? "Informe o e-mail da conta ou o telefone já confirmado nela. Enviaremos um código de 6 dígitos." : "Informe o e-mail da conta. Enviaremos um código de 6 dígitos."}</p>
          <label>
            {phoneRecovery ? "E-mail ou telefone" : "E-mail"}
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus autoComplete="username" inputMode={phoneRecovery ? "text" : "email"} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? "Enviando…" : "Enviar código"}</button>
        </form>
      ) : (
        <form className="form" onSubmit={reset}>
          {info && <p className="form-ok" role="status">{info}</p>}
          <label>
            Código de 6 dígitos
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required autoFocus inputMode="numeric" autoComplete="one-time-code" className="code-input" placeholder="000000" />
          </label>
          <PasswordInput label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" showChecks />
          <PasswordInput label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? "Salvando…" : "Redefinir senha"}</button>
          <button type="button" className="link-btn" disabled={busy} onClick={() => void sendCode()}>Não recebi o código: enviar de novo</button>
        </form>
      )}
      <p><Link href="/auth" className="link-btn">Voltar para entrar</Link></p>
    </div>
  );
}
