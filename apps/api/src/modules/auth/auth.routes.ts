import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { signTwoFactorChallenge, verifyTwoFactorChallenge } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import { notifyCode } from "../../lib/notify-code.js";
import { prisma } from "../../lib/prisma.js";
import { emailAvailable, phoneVerificationRequired, smsAvailable } from "../../lib/notify.js";
import { cpfField, fullName, maskPhone, normalizePhone, phoneField, strongPassword } from "../../lib/validation.js";
import { env } from "../../config/env.js";
import { encryptionAvailable } from "../../lib/crypto.js";
import { requireAuth } from "../../middlewares/auth.js";
import { authFlood, loginAttempts, recoveryRequests, registrations, registrationsPerEmail, resendRequests, resetAttempts, twoFactorAttempts, verifyAttempts } from "../../middlewares/rate-limit.js";
import { CODE_MINUTES, consumeAll, consumeCode, issueCode } from "./codes.js";
import { sessionFor, toPublicUser, loadUser } from "./session.js";
import { verifySecondFactor } from "./two-factor.service.js";

export const authRouter = Router();
authRouter.use(authFlood);

const BCRYPT_COST = 12;
/** Para quem não existe, o login também gasta o tempo de um bcrypt: a resposta não revela se o e-mail tem conta. */
const DUMMY_HASH = bcrypt.hashSync("senha-que-nunca-existe", BCRYPT_COST);

const email = z.email().transform((v) => v.toLowerCase());

/** Telefone obrigatório: o cadastro só vale depois de confirmar um código no e-mail e outro no telefone. */
const registerBody = z.object({
  name: fullName,
  email,
  cpf: cpfField,
  phone: phoneField,
  password: strongPassword,
});

const loginBody = z.object({ email, password: z.string().min(1).max(200) });

/** Quais recursos este servidor consegue oferecer hoje (o front esconde o que não está disponível). */
authRouter.get("/capabilities", (_req, res) => {
  res.json({
    /** Dá para cadastrar? Precisa enviar o código por e-mail e, se a confirmação do telefone estiver ligada, também por SMS. */
    registration: emailAvailable && (!phoneVerificationRequired || smsAvailable),
    /** O cadastro confirma o telefone por SMS (além do e-mail)? */
    phoneVerification: phoneVerificationRequired,
    emailRecovery: emailAvailable,
    smsRecovery: smsAvailable,
    twoFactor: encryptionAvailable,
    savedCards: Boolean(env.CARD_PROVIDER),
  });
});

/* Cadastro em duas etapas: 1) dados → a conta nasce "pendente" e recebe um código por e-mail e outro por SMS; 2) os dois códigos confirmam e abrem a sessão. */

authRouter.post("/register", registrations, registrationsPerEmail, async (req, res) => {
  if (!emailAvailable || (phoneVerificationRequired && !smsAvailable)) {
    throw new AppError("O cadastro está indisponível no momento: não conseguimos enviar os códigos de confirmação. Tente novamente mais tarde.", 503);
  }
  const { password, phone, ...data } = registerBody.parse(req.body);
  const phoneDigits = normalizePhone(phone)!;

  // Cadastro pendente (nunca confirmado) não reserva e-mail nem CPF: um cadastro novo com os mesmos dados o substitui.
  await prisma.profile.deleteMany({ where: { pendingVerification: true, OR: [{ email: data.email }, { cpf: data.cpf }] } });
  if (await prisma.profile.findUnique({ where: { email: data.email }, select: { id: true } })) throw new AppError("E-mail já cadastrado", 409);
  if (await prisma.profile.findUnique({ where: { cpf: data.cpf }, select: { id: true } })) throw new AppError("CPF já cadastrado", 409);
  if (await prisma.profile.findUnique({ where: { verifiedPhone: phoneDigits }, select: { id: true } })) throw new AppError("Este telefone já está cadastrado em outra conta", 409);

  const user = await prisma.profile.create({
    data: { ...data, phone, passwordHash: await bcrypt.hash(password, BCRYPT_COST), passwordChangedAt: new Date(), pendingVerification: true },
    select: { id: true },
  });
  try {
    await sendSignupCodes(user.id, data.email, phoneDigits);
  } catch (err) {
    await prisma.profile.delete({ where: { id: user.id } }); // sem conseguir enviar os códigos não há cadastro a confirmar
    console.error("Falha ao enviar os códigos de confirmação do cadastro:", err);
    throw new AppError("Não conseguimos enviar os códigos de confirmação. Confira o e-mail e o telefone ou tente novamente mais tarde.", 502);
  }
  res.status(201).json({ verificationRequired: true, email: data.email, phoneRequired: phoneVerificationRequired, phoneHint: phoneVerificationRequired ? maskPhone(phoneDigits) : "" });
});

/** Gera e envia os códigos do cadastro: o do e-mail e, se a confirmação do telefone estiver ligada, o do SMS. Um código pedido há menos de 1 minuto não é reenviado. */
async function sendSignupCodes(profileId: string, emailAddress: string, phoneDigits: string) {
  const [emailCode, phoneCode] = await Promise.all([
    issueCode(profileId, "EMAIL_VERIFY", "EMAIL", emailAddress),
    phoneVerificationRequired ? issueCode(profileId, "PHONE_VERIFY", "SMS", phoneDigits) : Promise.resolve(null),
  ]);
  await Promise.all([
    emailCode ? notifyCode({ channel: "EMAIL", destination: emailAddress }, "EMAIL_VERIFY", emailCode) : undefined,
    phoneCode ? notifyCode({ channel: "SMS", destination: phoneDigits }, "PHONE_VERIFY", phoneCode) : undefined,
  ]);
}

authRouter.post("/register/verify", verifyAttempts, async (req, res) => {
  const { email: address, emailCode, phoneCode } = z
    .object({
      email,
      emailCode: z.string().trim().regex(/^\d{6}$/, "O código do e-mail tem 6 dígitos"),
      phoneCode: z.string().trim().regex(/^\d{6}$/, "O código do SMS tem 6 dígitos").optional(),
    })
    .parse(req.body);
  if (phoneVerificationRequired && !phoneCode) throw new AppError("Informe também o código de 6 dígitos recebido por SMS.", 400);

  const pending = await prisma.profile.findFirst({ where: { email: address, pendingVerification: true }, select: { id: true, phone: true } });
  if (!pending) throw new AppError("Cadastro não encontrado ou já confirmado. Entre com seu e-mail e senha.", 404);

  const phoneDigits = normalizePhone(pending.phone ?? "")!;
  const checks: { purpose: "EMAIL_VERIFY" | "PHONE_VERIFY"; destination: string; code: string }[] = [{ purpose: "EMAIL_VERIFY", destination: address, code: emailCode }];
  if (phoneVerificationRequired) checks.push({ purpose: "PHONE_VERIFY", destination: phoneDigits, code: phoneCode! });
  const results = await consumeAll(pending.id, checks);
  const emailOk = results[0] === true;
  const phoneOk = phoneVerificationRequired ? results[1] === true : true;
  if (!emailOk || !phoneOk) {
    res.status(400).json({
      error: !emailOk && !phoneOk ? "Os dois códigos estão incorretos ou expiraram." : !emailOk ? "O código do e-mail está incorreto ou expirou." : "O código do SMS está incorreto ou expirou.",
      code: "INVALID_CODE",
      emailOk,
      phoneOk,
    });
    return;
  }
  try {
    await prisma.profile.update({
      where: { id: pending.id },
      // sem a confirmação por SMS o telefone fica como informado, mas não confirmado (não serve para recuperar a senha até ser confirmado)
      data: { pendingVerification: false, emailVerifiedAt: new Date(), ...(phoneVerificationRequired && { verifiedPhone: phoneDigits }) },
    });
  } catch {
    throw new AppError("Este telefone acabou de ser confirmado em outra conta. Refaça o cadastro com outro número.", 409);
  }
  res.json(await sessionFor(pending.id));
});

/** Reenvia os códigos de um cadastro pendente. A resposta é sempre a mesma, para não revelar quais e-mails têm cadastro. */
authRouter.post("/register/resend", resendRequests, async (req, res) => {
  const { email: address } = z.object({ email }).parse(req.body);
  if (!emailAvailable || (phoneVerificationRequired && !smsAvailable)) throw new AppError("Não conseguimos enviar os códigos no momento. Tente novamente mais tarde.", 503);
  const pending = await prisma.profile.findFirst({ where: { email: address, pendingVerification: true }, select: { id: true, phone: true } });
  if (pending) {
    const phoneDigits = normalizePhone(pending.phone ?? "");
    if (phoneDigits) void sendSignupCodes(pending.id, address, phoneDigits).catch((err) => console.error("Falha ao reenviar os códigos do cadastro:", err));
  }
  res.json({ ok: true, message: "Se houver um cadastro aguardando confirmação, enviamos novos códigos." });
});

authRouter.post("/login", loginAttempts, async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const found = await prisma.profile.findUnique({ where: { email }, omit: { passwordHash: false } });
  const valid = await bcrypt.compare(password, found?.passwordHash ?? DUMMY_HASH);
  if (!found || !valid) throw new AppError("E-mail ou senha inválidos", 401);

  // cadastro novo ainda sem os códigos confirmados: não entra (a senha está certa, então já pode saber que existe)
  if (found.pendingVerification) {
    const phoneDigits = normalizePhone(found.phone ?? "");
    res.status(403).json({
      error: phoneVerificationRequired ? "Confirme seu e-mail e telefone para entrar." : "Confirme seu e-mail para entrar.",
      code: "VERIFICATION_REQUIRED",
      email: found.email,
      phoneRequired: phoneVerificationRequired,
      phoneHint: phoneVerificationRequired && phoneDigits ? maskPhone(phoneDigits) : "",
    });
    return;
  }

  if (found.twoFactorEnabled) {
    res.json({ twoFactorRequired: true, challenge: signTwoFactorChallenge(found.id) });
    return;
  }
  res.json(await sessionFor(found.id));
});

/** Segunda etapa da entrada: o código do aplicativo autenticador (6 dígitos) ou um código de emergência. */
authRouter.post("/2fa/login", twoFactorAttempts, async (req, res) => {
  const { challenge, code } = z.object({ challenge: z.string().min(20), code: z.string().trim().min(6).max(24) }).parse(req.body);
  let id: string;
  try {
    id = verifyTwoFactorChallenge(challenge);
  } catch {
    throw new AppError("A entrada expirou. Digite e-mail e senha de novo.", 401);
  }
  const user = await prisma.profile.findUnique({ where: { id }, omit: { twoFactorSecret: false } });
  if (!user?.twoFactorEnabled || !(await verifySecondFactor(user, code))) throw new AppError("Código inválido", 401);
  res.json(await sessionFor(user.id));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(toPublicUser(await loadUser(req.auth!.sub)));
});

/* Recuperação de senha por e-mail ou telefone (o telefone só vale se já foi confirmado na conta). */

const GENERIC_SENT = { ok: true, message: `Se houver uma conta com esse dado, enviamos um código. Ele vale por ${CODE_MINUTES} minutos.` };
const INVALID_CODE = "Código inválido ou expirado. Peça um novo código.";

type Target = { channel: "EMAIL" | "SMS"; destination: string };

/** E-mail ("a@b.com") ou telefone ("(51) 99999-8888") → canal e destino normalizados. */
function parseIdentifier(identifier: string): Target {
  if (identifier.includes("@")) {
    const parsed = email.safeParse(identifier);
    if (!parsed.success) throw new AppError("Informe um e-mail válido", 400);
    return { channel: "EMAIL", destination: parsed.data };
  }
  const phone = normalizePhone(identifier);
  if (!phone) throw new AppError("Informe o e-mail da conta ou um telefone válido com DDD", 400);
  return { channel: "SMS", destination: phone };
}

function findAccount(target: Target) {
  // cadastro pendente (sem confirmar) fica de fora: a recuperação não pode virar um atalho para pular a confirmação
  return target.channel === "EMAIL"
    ? prisma.profile.findFirst({ where: { email: target.destination, pendingVerification: false }, select: { id: true } })
    : prisma.profile.findFirst({ where: { verifiedPhone: target.destination, pendingVerification: false }, select: { id: true } });
}

authRouter.post("/forgot", recoveryRequests, async (req, res) => {
  const { identifier } = z.object({ identifier: z.string().trim().min(3).max(200) }).parse(req.body);
  const target = parseIdentifier(identifier);
  if (target.channel === "EMAIL" && !emailAvailable) throw new AppError("A recuperação por e-mail está indisponível no momento.", 503);
  if (target.channel === "SMS" && !smsAvailable) throw new AppError("A recuperação por telefone está indisponível no momento. Use o e-mail da conta.", 503);

  const account = await findAccount(target);
  if (account) {
    const code = await issueCode(account.id, "PASSWORD_RESET", target.channel, target.destination);
    // não espera o envio: o tempo da resposta não pode revelar se a conta existe
    if (code) void notifyCode(target, "PASSWORD_RESET", code).catch((err) => console.error("Falha ao enviar código de recuperação:", err));
  }
  res.json(GENERIC_SENT);
});

authRouter.post("/reset", resetAttempts, async (req, res) => {
  const { identifier, code, newPassword } = z
    .object({ identifier: z.string().trim().min(3).max(200), code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos"), newPassword: strongPassword })
    .parse(req.body);
  const target = parseIdentifier(identifier);
  const account = await findAccount(target);
  if (!account || !(await consumeCode(account.id, "PASSWORD_RESET", target.destination, code))) throw new AppError(INVALID_CODE, 400);

  await prisma.profile.update({
    where: { id: account.id },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  res.json({ ok: true });
});
