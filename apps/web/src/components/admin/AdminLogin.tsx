"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { api, needsTwoFactor, type AuthResult } from "@/lib/api";

/**
 * Entrada do painel: só administradores. Uma conta de cliente, mesmo com a senha certa, não entra
 * (e nada é guardado no navegador), para o painel não revelar quem é quem.
 * Se a conta do administrador tem verificação em duas etapas, pede o código depois da senha.
 */
export function AdminLogin({ onSignedIn }: { onSignedIn: (result: AuthResult) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  function accept(result: AuthResult) {
    if (result.user.role !== "ADMIN") {
      setChallenge(null);
      setError("Esta conta não tem acesso ao painel.");
      return;
    }
    if (!result.user.permissions?.length) {
      setChallenge(null);
      setError("Seu acesso ao painel está desativado. Fale com o responsável pela loja.");
      return;
    }
    onSignedIn(result); // o AdminGate guarda a sessão da aba e mostra o painel
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (challenge) {
        accept(await api.twoFactorLogin({ challenge, code: String(f.get("code")) }));
        return;
      }
      const result = await api.login({ email: String(f.get("email")), password: String(f.get("password")) });
      if (needsTwoFactor(result)) setChallenge(result.challenge);
      else accept(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <main className="admin-login">
        <form className="admin-login-card" onSubmit={onSubmit}>
          <h1>Acesso ao painel</h1>
          {challenge ? (
            <>
              <p className="admin-hint">Digite o código de 6 dígitos do aplicativo autenticador (ou um código de emergência).</p>
              <label>Código<input name="code" required autoFocus autoComplete="one-time-code" inputMode="text" maxLength={14} /></label>
            </>
          ) : (
            <>
              <p className="admin-hint">Entre com seu e-mail e senha de administrador.</p>
              <label>E-mail<input name="email" type="email" required autoComplete="username" autoFocus /></label>
              <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? "Entrando…" : challenge ? "Confirmar" : "Entrar"}</button>
          {challenge && <button type="button" className="link-btn" onClick={() => { setChallenge(null); setError(""); }}>Voltar</button>}
        </form>
      </main>
    </>
  );
}
