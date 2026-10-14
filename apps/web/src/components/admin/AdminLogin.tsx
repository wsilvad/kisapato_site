"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { api, type AuthResult } from "@/lib/api";

/**
 * Entrada do painel: só administradores. Uma conta de cliente, mesmo com a senha certa, não entra
 * (e nada é guardado no navegador), para o painel não revelar quem é quem.
 */
export function AdminLogin({ onSignedIn }: { onSignedIn: (result: AuthResult) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api.login({ email: String(f.get("email")), password: String(f.get("password")) });
      if (result.user.role !== "ADMIN") {
        setError("Esta conta não tem acesso ao painel.");
        return;
      }
      onSignedIn(result); // o AdminGate guarda a sessão da aba e mostra o painel
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
          <p className="admin-hint">Entre com seu e-mail e senha de administrador.</p>
          <label>E-mail<input name="email" type="email" required autoComplete="username" autoFocus /></label>
          <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </main>
    </>
  );
}
