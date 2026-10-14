"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function AuthPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    setError("");
    try {
      const result =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, name: String(f.get("name")), phone: String(f.get("phone") || "") || undefined });
      signIn(result);
      router.push("/conta"); // o login da loja nunca leva ao painel
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <form className="form" onSubmit={onSubmit}>
        {mode === "register" && (
          <>
            <label>Nome<input name="name" required minLength={2} autoComplete="name" /></label>
            <label>Telefone<input name="phone" autoComplete="tel" /></label>
          </>
        )}
        <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Senha<input name="password" type="password" required minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid" disabled={busy}>{mode === "login" ? "Entrar" : "Cadastrar"}</button>
      </form>
      <button type="button" className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
        {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
      </button>
    </div>
  );
}
