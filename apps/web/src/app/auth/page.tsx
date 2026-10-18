"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PasswordInput } from "@/components/account/PasswordInput";
import { ApiError, api, needsTwoFactor, type AuthResult, type PendingRegistration } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatCpf, formatPhone, isFullName, isStrongPassword, isValidCpf, isValidPhone } from "@/lib/validators";
import type { Capabilities } from "@/types/product";

/** Só caminhos internos (“/checkout”), para o link de retorno não levar a outro site. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/conta";
}

const RESEND_SECONDS = 60;

/** Os links "Entre ou Cadastre-se" do cabeçalho usam `?modo=cadastro` para abrir direto o cadastro; `?voltar=/checkout` devolve o cliente depois. */
function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();
  const next = safeNext(params.get("voltar"));
  const [mode, setMode] = useState<"login" | "register">(params.get("modo") === "cadastro" ? "register" : "login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // campos que o cliente já tocou: só eles mostram o erro (os outros aparecem ao tentar enviar)
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));

  // segunda etapa do login (conta com verificação em duas etapas)
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  // confirmação do cadastro: um código no e-mail e outro no telefone
  const [pending, setPending] = useState<PendingRegistration | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [bad, setBad] = useState<{ email: boolean; phone: boolean }>({ email: false, phone: false });
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    api.capabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  // contagem para liberar o “reenviar códigos”
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const registrationDown = caps?.registration === false;

  // Todos os campos do cadastro são obrigatórios: sem todos preenchidos e válidos, o botão fica bloqueado.
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim());
  const errors = {
    name: !name.trim() ? "Informe seu nome completo." : !isFullName(name) ? "Informe nome e sobrenome." : "",
    cpf: !cpf ? "Informe seu CPF." : !isValidCpf(cpf) ? "CPF inválido. Confira os números." : "",
    email: !email.trim() ? "Informe seu e-mail." : !emailValid ? "E-mail inválido." : "",
    phone: !phone ? "Informe seu celular." : !isValidPhone(phone) ? "Celular inválido. Use DDD + número." : "",
    password: !password ? "Crie uma senha." : !isStrongPassword(password) ? "A senha ainda não cumpre todas as regras abaixo." : "",
    confirm: !confirm ? "Confirme a senha." : confirm !== password ? "As senhas não são iguais." : "",
  };
  const registerReady = Object.values(errors).every((e) => !e);
  const ready = mode === "register" ? registerReady : emailValid && password.length > 0;
  const shown = (key: keyof typeof errors) => (mode === "register" && touched[key] ? errors[key] : "");

  function finish(result: AuthResult) {
    signIn(result);
    router.push(next);
  }

  function startVerification(p: PendingRegistration, message = "") {
    setPending(p);
    setEmailCode("");
    setPhoneCode("");
    setBad({ email: false, phone: false });
    setError("");
    setInfo(message);
    setCooldown(RESEND_SECONDS);
  }

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!ready) {
      // não segue sem todos os campos: mostra o que falta em cada um
      setTouched({ name: true, cpf: true, email: true, phone: true, password: true, confirm: true });
      return setError(mode === "register" ? "Preencha todos os campos corretamente para continuar." : "Informe o e-mail e a senha.");
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const result = await api.login({ email, password });
        if (needsTwoFactor(result)) {
          setChallenge(result.challenge);
          return;
        }
        finish(result);
      } else {
        startVerification(await api.register({ name: name.trim(), email, cpf, phone, password }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERIFICATION_REQUIRED") {
        // cadastro que ficou sem confirmar: leva para a confirmação e já manda códigos novos
        const hint = String(err.details?.phoneHint ?? "");
        startVerification(
          { verificationRequired: true, email: String(err.details?.email ?? email), phoneRequired: err.details?.phoneRequired === true, phoneHint: hint },
          "Seu cadastro ainda não foi confirmado. Enviamos novos códigos.",
        );
        api.resendRegistrationCodes(email).catch(() => undefined);
        return;
      }
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmSignup(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      finish(await api.verifyRegistration({ email: pending.email, emailCode: emailCode.trim(), ...(pending.phoneRequired && { phoneCode: phoneCode.trim() }) }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_CODE") {
        setBad({ email: err.details?.emailOk === false, phone: err.details?.phoneOk === false });
      }
      setError(err instanceof Error ? err.message : "Não foi possível confirmar");
    } finally {
      setBusy(false);
    }
  }

  async function resendCodes() {
    if (!pending || cooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      await api.resendRegistrationCodes(pending.email);
      setInfo("Enviamos novos códigos. Eles valem por 15 minutos.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reenviar");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitCode(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    try {
      finish(await api.twoFactorLogin({ challenge, code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="page narrow">
        <h1 className="page-title">{pending.phoneRequired ? "Confirme seus dados" : "Confirme seu e-mail"}</h1>
        <p>
          Enviamos um código de 6 dígitos para o e-mail <strong>{pending.email}</strong>
          {pending.phoneRequired && pending.phoneHint && <> e outro por SMS para o celular <strong>{pending.phoneHint}</strong></>}.{" "}
          {pending.phoneRequired ? "Digite os dois para ativar sua conta." : "Digite o código para ativar sua conta."} {pending.phoneRequired ? "Os códigos valem" : "O código vale"} por 15 minutos.
        </p>
        <form className="form" onSubmit={onConfirmSignup}>
          <label>
            Código recebido por e-mail
            <input value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required autoFocus inputMode="numeric" autoComplete="one-time-code" className="code-input" placeholder="000000" aria-invalid={bad.email} />
          </label>
          {pending.phoneRequired && (
            <label>
              Código recebido por SMS
              <input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" autoComplete="one-time-code" className="code-input" placeholder="000000" aria-invalid={bad.phone} />
            </label>
          )}
          {info && <p className="form-ok" role="status">{info}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy || emailCode.length !== 6 || (pending.phoneRequired && phoneCode.length !== 6)}>{busy ? "Confirmando…" : "Confirmar e entrar"}</button>
        </form>
        <p>
          <button type="button" className="link-btn" onClick={resendCodes} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Reenviar ${pending.phoneRequired ? "códigos" : "código"} (aguarde ${cooldown}s)` : `Não recebi: reenviar ${pending.phoneRequired ? "os códigos" : "o código"}`}
          </button>
        </p>
        <p><button type="button" className="link-btn" onClick={() => { setPending(null); setError(""); setInfo(""); }}>Corrigir meus dados ({pending.phoneRequired ? "e-mail ou telefone errado" : "e-mail errado"})</button></p>
      </div>
    );
  }

  if (challenge) {
    return (
      <div className="page narrow">
        <h1 className="page-title">Verificação em duas etapas</h1>
        <p>{useRecovery ? "Digite um dos seus códigos de emergência. Cada um vale uma vez só." : "Digite o código de 6 dígitos que aparece no seu aplicativo autenticador."}</p>
        <form className="form" onSubmit={onSubmitCode}>
          <label>
            {useRecovery ? "Código de emergência" : "Código de 6 dígitos"}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode={useRecovery ? "text" : "numeric"}
              maxLength={useRecovery ? 14 : 7}
              className="code-input"
              placeholder={useRecovery ? "XXXXX-XXXXX" : "000000"}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-solid" disabled={busy}>{busy ? "Verificando…" : "Confirmar"}</button>
        </form>
        <button type="button" className="link-btn" onClick={() => { setUseRecovery((v) => !v); setCode(""); setError(""); }}>
          {useRecovery ? "Usar o código do aplicativo" : "Perdi o acesso ao aplicativo: usar código de emergência"}
        </button>
        <p><button type="button" className="link-btn" onClick={() => { setChallenge(null); setCode(""); setError(""); setPassword(""); }}>Voltar</button></p>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      {mode === "register" && <p className="muted">Todos os campos são obrigatórios.</p>}
      {mode === "register" && registrationDown && (
        <p className="form-error" role="alert">O cadastro está temporariamente indisponível: não conseguimos enviar o código de confirmação. Tente novamente mais tarde.</p>
      )}
      <form className="form" onSubmit={onSubmit} noValidate>
        {mode === "register" && (
          <>
            <label>
              Nome completo
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} required aria-invalid={Boolean(shown("name"))} autoComplete="name" />
              {shown("name") && <small className="field-error" role="alert">{shown("name")}</small>}
            </label>
            <label>
              CPF
              <input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} onBlur={() => touch("cpf")} required aria-invalid={Boolean(shown("cpf"))} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />
              {shown("cpf") && <small className="field-error" role="alert">{shown("cpf")}</small>}
            </label>
          </>
        )}
        <label>
          E-mail
          <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} type="email" required aria-invalid={Boolean(shown("email"))} autoComplete="email" />
          {shown("email") && <small className="field-error" role="alert">{shown("email")}</small>}
        </label>
        {mode === "register" && (
          <label>
            Celular
            <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} onBlur={() => touch("phone")} required aria-invalid={Boolean(shown("phone"))} inputMode="tel" autoComplete="tel" placeholder="(51) 99999-8888" />
            {shown("phone") && <small className="field-error" role="alert">{shown("phone")}</small>}
            <small className="field-hint">
              {caps?.phoneVerification === false
                ? "Vamos enviar um código para o seu e-mail para confirmar o cadastro. O celular será usado para contato sobre os pedidos."
                : "Vamos enviar um código por SMS para este número e outro para o seu e-mail, para confirmar o cadastro. Você também poderá recuperar a senha por ele."}
            </small>
          </label>
        )}
        <PasswordInput label="Senha" value={password} onChange={setPassword} onBlur={() => touch("password")} error={shown("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} showChecks={mode === "register"} />
        {mode === "register" && <PasswordInput label="Confirmar senha" value={confirm} onChange={setConfirm} onBlur={() => touch("confirm")} error={shown("confirm")} autoComplete="new-password" />}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid" disabled={busy || !ready || (mode === "register" && registrationDown)}>
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : caps?.phoneVerification === false ? "Cadastrar e enviar código" : "Cadastrar e enviar códigos"}
        </button>
        {mode === "register" && !registerReady && !busy && <small className="field-hint">Preencha todos os campos corretamente para continuar.</small>}
      </form>
      {mode === "login" && <p><Link href="/auth/recuperar" className="link-btn">Esqueci minha senha</Link></p>}
      <button type="button" className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setTouched({}); }}>
        {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
      </button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
