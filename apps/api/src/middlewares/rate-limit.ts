import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

/**
 * Limites de tentativas (guardados na memória do processo: a API roda em uma instância só).
 * O limite principal é por conta/identificador, e não por IP, porque atrás de proxy o IP pode ser compartilhado.
 */
function limiter(options: { windowMs: number; limit: number; message: string; key: (req: Request) => string; onlyFailures?: boolean; onlySuccesses?: boolean }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: options.onlyFailures ?? false,
    skipFailedRequests: options.onlySuccesses ?? false,
    keyGenerator: (req) => options.key(req),
    message: { error: options.message },
    validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false, trustProxy: false },
  });
}

const text = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase().slice(0, 200) : "");

const MIN = 60_000;

/** Barreira geral contra enxurrada em /auth (generosa; o controle fino é por conta). */
export const authFlood = limiter({ windowMs: 15 * MIN, limit: 600, message: "Muitas requisições. Tente novamente em alguns minutos.", key: (req) => `flood:${req.ip}` });

/** 8 senhas erradas por e-mail em 15 minutos. Login certo não conta. */
export const loginAttempts = limiter({
  windowMs: 15 * MIN,
  limit: 8,
  onlyFailures: true,
  message: "Muitas tentativas de entrada. Aguarde 15 minutos ou use “Esqueci minha senha”.",
  key: (req) => `login:${text(req.body?.email)}`,
});

/** 8 códigos de verificação em duas etapas errados por sessão de entrada em 15 minutos. */
export const twoFactorAttempts = limiter({
  windowMs: 15 * MIN,
  limit: 8,
  onlyFailures: true,
  message: "Muitas tentativas com o código. Volte à tela de entrada e tente em 15 minutos.",
  key: (req) => `2fa:${text(req.body?.challenge).slice(-40)}`,
});

/** Pedidos de código de recuperação: 5 por hora para o mesmo e-mail/telefone. */
export const recoveryRequests = limiter({
  windowMs: 60 * MIN,
  limit: 5,
  message: "Você já pediu vários códigos. Aguarde um pouco antes de pedir outro.",
  key: (req) => `forgot:${text(req.body?.identifier)}`,
});

/** Tentativas de redefinir a senha com código: 10 por 15 minutos para o mesmo e-mail/telefone. */
export const resetAttempts = limiter({
  windowMs: 15 * MIN,
  limit: 10,
  message: "Muitas tentativas. Peça um novo código em alguns minutos.",
  key: (req) => `reset:${text(req.body?.identifier)}`,
});

/** Ações sensíveis da conta logada (trocar senha, ligar/desligar 2FA, confirmar telefone): 10 falhas por 15 minutos por conta. */
export const sensitiveActions = limiter({
  windowMs: 15 * MIN,
  limit: 10,
  onlyFailures: true,
  message: "Muitas tentativas. Aguarde alguns minutos.",
  key: (req) => `acct:${req.auth?.sub ?? req.ip}`,
});

/** Cadastros: 50 por hora por IP (protege contra criação em massa sem travar lojas atrás de um mesmo IP). */
export const registrations = limiter({ windowMs: 60 * MIN, limit: 50, message: "Muitos cadastros em pouco tempo. Tente novamente mais tarde.", key: (req) => `register:${req.ip}` });

/** Cada novo cadastro dispara e-mail e SMS: no máximo 3 por hora para o mesmo e-mail (evita usar o cadastro para encher a caixa de alguém). */
export const registrationsPerEmail = limiter({
  windowMs: 60 * MIN,
  limit: 3,
  onlySuccesses: true, // só conta o cadastro que de fato enviou códigos; erro de formulário não gasta o limite
  message: "Você já tentou se cadastrar com este e-mail várias vezes. Aguarde um pouco ou use “Reenviar códigos”.",
  key: (req) => `register-email:${text(req.body?.email)}`,
});

/** Reenvio dos códigos do cadastro: 5 por hora para o mesmo e-mail. */
export const resendRequests = limiter({
  windowMs: 60 * MIN,
  limit: 5,
  message: "Você já pediu vários reenvios. Aguarde um pouco antes de pedir outro.",
  key: (req) => `resend:${text(req.body?.email)}`,
});

/** Conferência dos códigos do cadastro: 10 tentativas erradas em 15 minutos por e-mail. */
export const verifyAttempts = limiter({
  windowMs: 15 * MIN,
  limit: 10,
  onlyFailures: true,
  message: "Muitas tentativas com os códigos. Aguarde alguns minutos e tente de novo.",
  key: (req) => `verify:${text(req.body?.email)}`,
});
