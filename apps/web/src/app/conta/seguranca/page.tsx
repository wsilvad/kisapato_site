"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordInput } from "@/components/account/PasswordInput";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { isStrongPassword } from "@/lib/validators";

export default function SegurancaPage() {
  return (
    <>
      <h2>Segurança</h2>
      <ChangePassword />
      <TwoFactor />
    </>
  );
}

function ChangePassword() {
  const { signIn } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(false);
    setError("");
    if (!isStrongPassword(next)) return setError("A nova senha ainda não cumpre todas as regras abaixo do campo.");
    if (next !== confirm) return setError("As senhas não são iguais.");
    setBusy(true);
    try {
      signIn(await api.account.changePassword({ currentPassword: current, newPassword: next })); // sessão nova; as outras caem
      setCurrent("");
      setNext("");
      setConfirm("");
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>Trocar senha</h3>
      <form className="form narrow-form" onSubmit={submit}>
        <PasswordInput label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" showChecks />
        <PasswordInput label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p className="form-error" role="alert">{error}</p>}
        {ok && <p className="form-ok" role="status">Senha alterada. Os outros aparelhos conectados foram desconectados.</p>}
        <button className="btn btn-solid" disabled={busy}>{busy ? "Salvando…" : "Trocar senha"}</button>
      </form>
    </section>
  );
}

type Status = { enabled: boolean; available: boolean; recoveryCodesLeft: number };
type Mode = "idle" | "setup" | "disable" | "regen";

function TwoFactor() {
  const { signIn, updateUser, user } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [enroll, setEnroll] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.account.twoFactorStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  function reset() {
    setMode("idle");
    setEnroll(null);
    setCode("");
    setPassword("");
    setError("");
  }

  async function guard(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir");
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    guard(async () => {
      setEnroll(await api.account.twoFactorSetup());
      setMode("setup");
    });

  const enable = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    return guard(async () => {
      const res = await api.account.twoFactorEnable(code.trim());
      signIn({ token: res.token, user: res.user });
      setCodes(res.recoveryCodes);
      setSaved(false);
      setStatus({ enabled: true, available: true, recoveryCodesLeft: res.recoveryCodes.length });
      reset();
    });
  };

  const disable = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    return guard(async () => {
      signIn(await api.account.twoFactorDisable({ password, code: code.trim() }));
      setStatus({ enabled: false, available: true, recoveryCodesLeft: 0 });
      setCodes(null);
      reset();
    });
  };

  const regenerate = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    return guard(async () => {
      const res = await api.account.newRecoveryCodes({ password, code: code.trim() });
      setCodes(res.recoveryCodes);
      setSaved(false);
      setStatus((s) => (s ? { ...s, recoveryCodesLeft: res.recoveryCodes.length } : s));
      reset();
    });
  };

  const dismissOffer = () => api.account.dismissTwoFactorOffer().then(updateUser).catch(() => undefined);

  if (!status) return <section><h3>Verificação em duas etapas</h3><p>Carregando…</p></section>;

  return (
    <section>
      <h3>Verificação em duas etapas</h3>
      {!status.available ? (
        <p className="muted">A verificação em duas etapas ainda não está disponível neste momento.</p>
      ) : (
        <>
          <p>
            Uma proteção extra para a sua conta: além da senha, você digita um código de 6 dígitos gerado por um aplicativo autenticador no seu celular
            (Google Authenticator, Microsoft Authenticator, Authy, 1Password…). É opcional.
          </p>
          <p>Status: <strong className={status.enabled ? "form-ok" : undefined}>{status.enabled ? "Ativada" : "Desativada"}</strong></p>

          {codes && (
            <div className="recovery-box" role="alert">
              <strong>Guarde seus códigos de emergência</strong>
              <p>Se você perder o celular, cada código abaixo entra uma vez no lugar do código do aplicativo. Eles não aparecem de novo.</p>
              <ul className="recovery-grid">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
              <div className="form-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copiar</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => downloadCodes(codes, user?.email ?? "")}>Baixar .txt</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>Imprimir</button>
              </div>
              <label className="check-row"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Guardei meus códigos em um lugar seguro</label>
              <button type="button" className="btn btn-solid btn-sm" disabled={!saved} onClick={() => setCodes(null)}>Concluir</button>
            </div>
          )}

          {mode === "idle" && !status.enabled && (
            <>
              <button type="button" className="btn btn-solid" onClick={start} disabled={busy}>{busy ? "Preparando…" : "Ativar verificação em duas etapas"}</button>
              {user?.twoFactorOffer && <> <button type="button" className="link-btn" onClick={dismissOffer}>Agora não</button></>}
            </>
          )}

          {mode === "setup" && enroll && (
            <form className="form narrow-form" onSubmit={enable}>
              <ol className="steps">
                <li>Abra o aplicativo autenticador e escolha <em>adicionar conta</em>.</li>
                <li>Escaneie o QR code abaixo{" "}ou digite a chave manualmente.</li>
                <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
              </ol>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado pela API (data URL) */}
              <img src={enroll.qrDataUrl} alt="QR code para o aplicativo autenticador" width={220} height={220} className="qr" />
              <p>Chave manual: <code className="secret-key">{enroll.secret.match(/.{1,4}/g)?.join(" ")}</code></p>
              <label>Código do aplicativo<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required autoFocus inputMode="numeric" autoComplete="one-time-code" className="code-input" placeholder="000000" /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="form-actions">
                <button className="btn btn-solid" disabled={busy}>{busy ? "Verificando…" : "Confirmar e ativar"}</button>
                <button type="button" className="link-btn" onClick={reset}>Cancelar</button>
              </div>
            </form>
          )}

          {status.enabled && mode === "idle" && (
            <>
              <p className={status.recoveryCodesLeft <= 2 ? "form-error" : "muted"}>
                Códigos de emergência restantes: {status.recoveryCodesLeft}.{status.recoveryCodesLeft <= 2 && " Gere novos códigos antes que acabem."}
              </p>
              <div className="form-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setMode("regen")}>Gerar novos códigos de emergência</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setMode("disable")}>Desativar</button>
              </div>
            </>
          )}

          {(mode === "disable" || mode === "regen") && (
            <form className="form narrow-form" onSubmit={mode === "disable" ? disable : regenerate}>
              <p>{mode === "disable" ? "Para desativar, confirme sua senha e digite um código do aplicativo (ou um código de emergência)." : "Os códigos antigos deixam de valer. Confirme sua senha e digite um código do aplicativo."}</p>
              <PasswordInput label="Sua senha" value={password} onChange={setPassword} autoComplete="current-password" autoFocus />
              <label>Código<input value={code} onChange={(e) => setCode(e.target.value)} required inputMode="text" autoComplete="one-time-code" maxLength={14} className="code-input" /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="form-actions">
                <button className="btn btn-solid" disabled={busy}>{busy ? "Aguarde…" : mode === "disable" ? "Desativar" : "Gerar novos códigos"}</button>
                <button type="button" className="link-btn" onClick={reset}>Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
      <p className="muted">Telefone para recuperar a senha: configure em <Link href="/conta/dados">Meus dados</Link>.</p>
    </section>
  );
}

/** Baixa os códigos de emergência em um .txt (só gerado no navegador, nada é enviado). */
function downloadCodes(codes: string[], email: string) {
  const body = `Ki Sapato: códigos de emergência (${email})\nCada código vale uma vez.\n\n${codes.join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "ki-sapato-codigos-de-emergencia.txt";
  a.click();
  URL.revokeObjectURL(url);
}
