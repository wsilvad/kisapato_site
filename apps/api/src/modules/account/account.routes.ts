import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { encrypt, decrypt, encryptionAvailable } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { notifyCode } from "../../lib/notify-code.js";
import { smsAvailable } from "../../lib/notify.js";
import { prisma } from "../../lib/prisma.js";
import { enrollmentFor, newTotpSecret, verifyTotp } from "../../lib/two-factor.js";
import { cpfField, fullName, normalizePhone, onlyDigits, phoneField, strongPassword, UFS } from "../../lib/validation.js";
import { requireAuth } from "../../middlewares/auth.js";
import { sensitiveActions } from "../../middlewares/rate-limit.js";
import { consumeCode, issueCode } from "../auth/codes.js";
import { loadUser, sessionFor, toPublicUser } from "../auth/session.js";
import { replaceRecoveryCodes, verifySecondFactor } from "../auth/two-factor.service.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

const BCRYPT_COST = 12;
const me = (req: { auth?: { sub: string } }) => req.auth!.sub;

/* ---------- Dados pessoais ---------- */

accountRouter.get("/", async (req, res) => {
  res.json(toPublicUser(await loadUser(me(req))));
});

const profileBody = z.object({
  name: fullName,
  cpf: cpfField,
  phone: phoneField.optional().or(z.literal("").transform(() => undefined)),
});

/** O e-mail não muda aqui: trocá-lo exige confirmar o novo endereço (ainda não existe). */
accountRouter.put("/profile", async (req, res) => {
  const { name, cpf, phone } = profileBody.parse(req.body);
  const id = me(req);
  const other = await prisma.profile.findUnique({ where: { cpf }, select: { id: true } });
  if (other && other.id !== id) throw new AppError("Este CPF já está cadastrado em outra conta", 409);

  const current = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { verifiedPhone: true, phone: true } });
  // o telefone é obrigatório no cadastro; quem já tem um não pode apagá-lo (contas antigas sem telefone ainda podem salvar sem)
  if (!phone && current.phone) throw new AppError("O telefone é obrigatório", 400);
  const normalized = phone ? normalizePhone(phone) : null;
  await prisma.profile.update({
    where: { id },
    data: {
      name,
      cpf,
      phone: phone ?? null,
      // mudou o número: o telefone confirmado deixa de valer até ser confirmado de novo
      ...(current.verifiedPhone && current.verifiedPhone !== normalized && { verifiedPhone: null }),
    },
  });
  res.json(toPublicUser(await loadUser(id)));
});

/** Troca de senha: exige a senha atual, derruba as outras sessões e devolve uma sessão nova para esta. */
accountRouter.put("/password", sensitiveActions, async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(200), newPassword: strongPassword }).parse(req.body);
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, omit: { passwordHash: false } });
  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) throw new AppError("A senha atual não confere", 400);
  if (currentPassword === newPassword) throw new AppError("A nova senha precisa ser diferente da atual", 400);
  await prisma.profile.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST), passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  res.json(await sessionFor(id));
});

/* ---------- Telefone para recuperar a senha ---------- */

accountRouter.post("/phone/send-code", async (req, res) => {
  if (!smsAvailable) throw new AppError("A confirmação por SMS está indisponível no momento.", 503);
  const id = me(req);
  const { phone } = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { phone: true } });
  const normalized = phone ? normalizePhone(phone) : null;
  if (!normalized) throw new AppError("Cadastre um telefone válido antes de confirmar.", 400);
  const code = await issueCode(id, "PHONE_VERIFY", "SMS", normalized);
  if (!code) throw new AppError("Um código foi enviado há pouco. Aguarde um minuto para pedir outro.", 429);
  await notifyCode({ channel: "SMS", destination: normalized }, "PHONE_VERIFY", code);
  res.json({ ok: true });
});

accountRouter.post("/phone/confirm", sensitiveActions, async (req, res) => {
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos") }).parse(req.body);
  const id = me(req);
  const { phone } = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { phone: true } });
  const normalized = phone ? normalizePhone(phone) : null;
  if (!normalized || !(await consumeCode(id, "PHONE_VERIFY", normalized, code))) throw new AppError("Código inválido ou expirado", 400);

  const owner = await prisma.profile.findUnique({ where: { verifiedPhone: normalized }, select: { id: true } });
  if (owner && owner.id !== id) throw new AppError("Este telefone já está confirmado em outra conta", 409);
  await prisma.profile.update({ where: { id }, data: { verifiedPhone: normalized } });
  res.json(toPublicUser(await loadUser(id)));
});

/* ---------- Endereços (um é o padrão) ---------- */

const MAX_ADDRESSES = 10;

const addressBody = z.object({
  label: z.string().trim().max(30).optional().or(z.literal("").transform(() => undefined)),
  recipient: z.string().trim().min(2).max(120),
  zip: z.string().transform(onlyDigits).pipe(z.string().length(8, "CEP deve ter 8 dígitos")),
  street: z.string().trim().min(1).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  district: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().toUpperCase().pipe(z.enum(UFS, "UF inválida")),
  isDefault: z.boolean().optional(),
});

accountRouter.get("/addresses", async (req, res) => {
  res.json(await prisma.address.findMany({ where: { profileId: me(req) }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }));
});

accountRouter.post("/addresses", async (req, res) => {
  const { isDefault, ...data } = addressBody.parse(req.body);
  const profileId = me(req);
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { profileId } });
    if (count >= MAX_ADDRESSES) throw new AppError(`Você pode salvar até ${MAX_ADDRESSES} endereços`, 409);
    const makeDefault = isDefault === true || count === 0; // o primeiro endereço é sempre o padrão
    if (makeDefault) await tx.address.updateMany({ where: { profileId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, profileId, isDefault: makeDefault } });
  });
  res.status(201).json(created);
});

accountRouter.put("/addresses/:id", async (req, res) => {
  const { isDefault, ...data } = addressBody.parse(req.body);
  const profileId = me(req);
  const id = String(req.params.id);
  const updated = await prisma.$transaction(async (tx) => {
    const own = await tx.address.findFirst({ where: { id, profileId } });
    if (!own) throw new AppError("Endereço não encontrado", 404);
    if (isDefault === true && !own.isDefault) await tx.address.updateMany({ where: { profileId, isDefault: true }, data: { isDefault: false } });
    // desmarcar o padrão sem escolher outro não é permitido: sempre sobra um padrão
    return tx.address.update({ where: { id }, data: { ...data, ...(isDefault === true && { isDefault: true }) } });
  });
  res.json(updated);
});

accountRouter.put("/addresses/:id/default", async (req, res) => {
  const profileId = me(req);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    if (!(await tx.address.findFirst({ where: { id, profileId }, select: { id: true } }))) throw new AppError("Endereço não encontrado", 404);
    await tx.address.updateMany({ where: { profileId, isDefault: true }, data: { isDefault: false } });
    await tx.address.update({ where: { id }, data: { isDefault: true } });
  });
  res.json(await prisma.address.findMany({ where: { profileId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }));
});

accountRouter.delete("/addresses/:id", async (req, res) => {
  const profileId = me(req);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const own = await tx.address.findFirst({ where: { id, profileId } });
    if (!own) throw new AppError("Endereço não encontrado", 404);
    await tx.address.delete({ where: { id } });
    if (own.isDefault) {
      // apagou o padrão: o endereço mais antigo que sobrar assume
      const next = await tx.address.findFirst({ where: { profileId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).end();
});

/* ---------- Verificação em duas etapas (aplicativo autenticador) ---------- */

function requireTwoFactorSupport() {
  if (!encryptionAvailable) throw new AppError("A verificação em duas etapas está indisponível no momento.", 503);
}

/** Passo 1: cria um segredo (ainda inativo) e devolve o QR code para o aplicativo autenticador. */
accountRouter.post("/2fa/setup", async (req, res) => {
  requireTwoFactorSupport();
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { email: true, twoFactorEnabled: true } });
  if (account.twoFactorEnabled) throw new AppError("A verificação em duas etapas já está ativa", 409);
  const secret = newTotpSecret();
  await prisma.profile.update({ where: { id }, data: { twoFactorSecret: encrypt(secret) } });
  res.json({ secret, ...(await enrollmentFor(secret, account.email)) });
});

/** Passo 2: o cliente digita o código que o aplicativo mostra; só então a proteção liga. Devolve os códigos de emergência (uma vez). */
accountRouter.post("/2fa/enable", sensitiveActions, async (req, res) => {
  requireTwoFactorSupport();
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos") }).parse(req.body);
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { twoFactorEnabled: true, twoFactorSecret: true } });
  if (account.twoFactorEnabled) throw new AppError("A verificação em duas etapas já está ativa", 409);
  if (!account.twoFactorSecret) throw new AppError("Comece pela configuração do aplicativo autenticador", 400);
  if (!verifyTotp(decrypt(account.twoFactorSecret), code)) throw new AppError("Código incorreto. Confira o aplicativo e tente de novo.", 400);

  const recoveryCodes = await replaceRecoveryCodes(id);
  await prisma.profile.update({ where: { id }, data: { twoFactorEnabled: true, tokenVersion: { increment: 1 } } });
  res.json({ recoveryCodes, ...(await sessionFor(id)) }); // sessões antigas caem; esta continua com o token novo
});

/** Desligar exige a senha e um código (do aplicativo ou de emergência). */
accountRouter.post("/2fa/disable", sensitiveActions, async (req, res) => {
  const { password, code } = z.object({ password: z.string().min(1).max(200), code: z.string().trim().min(6).max(24) }).parse(req.body);
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, omit: { passwordHash: false, twoFactorSecret: false } });
  if (!account.twoFactorEnabled) throw new AppError("A verificação em duas etapas não está ativa", 409);
  if (!(await bcrypt.compare(password, account.passwordHash))) throw new AppError("Senha incorreta", 400);
  if (!(await verifySecondFactor(account, code))) throw new AppError("Código inválido", 400);

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { profileId: id } }),
    prisma.profile.update({ where: { id }, data: { twoFactorEnabled: false, twoFactorSecret: null, tokenVersion: { increment: 1 } } }),
  ]);
  res.json(await sessionFor(id));
});

/** Novos códigos de emergência (os antigos deixam de valer). Exige a senha e um código válido. */
accountRouter.post("/2fa/recovery-codes", sensitiveActions, async (req, res) => {
  const { password, code } = z.object({ password: z.string().min(1).max(200), code: z.string().trim().min(6).max(24) }).parse(req.body);
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, omit: { passwordHash: false, twoFactorSecret: false } });
  if (!account.twoFactorEnabled) throw new AppError("A verificação em duas etapas não está ativa", 409);
  if (!(await bcrypt.compare(password, account.passwordHash))) throw new AppError("Senha incorreta", 400);
  if (!(await verifySecondFactor(account, code))) throw new AppError("Código inválido", 400);
  res.json({ recoveryCodes: await replaceRecoveryCodes(id) });
});

/** Quantos códigos de emergência ainda não foram usados (para avisar quando estiverem acabando). */
accountRouter.get("/2fa/status", async (req, res) => {
  const id = me(req);
  const account = await prisma.profile.findUniqueOrThrow({ where: { id }, select: { twoFactorEnabled: true } });
  const remaining = account.twoFactorEnabled ? await prisma.recoveryCode.count({ where: { profileId: id, usedAt: null } }) : 0;
  res.json({ enabled: account.twoFactorEnabled, available: encryptionAvailable, recoveryCodesLeft: remaining });
});

/** "Agora não": a oferta de ativar a verificação em duas etapas some, mas continua disponível em Segurança. */
accountRouter.post("/2fa/dismiss-offer", async (req, res) => {
  const id = me(req);
  await prisma.profile.update({ where: { id }, data: { twoFactorOfferDismissedAt: new Date() } });
  res.json(toPublicUser(await loadUser(id)));
});

/* ---------- Cartões salvos (só token do gateway; nunca o número nem o CVV) ---------- */

const cardSelect = { id: true, brand: true, last4: true, expMonth: true, expYear: true, holderName: true, isDefault: true, createdAt: true } as const;

const cardBody = z.object({
  token: z.string().trim().min(8).max(200),
  brand: z.string().trim().min(2).max(30),
  last4: z.string().regex(/^\d{4}$/, "Informe só os 4 últimos dígitos"),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 25),
  holderName: z.string().trim().min(2).max(80),
});

/** Soma de verificação (Luhn) que todo número de cartão verdadeiro cumpre. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Defesa extra: recusa qualquer campo que contenha um número de cartão inteiro (13 a 19 dígitos, com ou sem espaços e hífens,
 * e que passe no Luhn). A checagem de Luhn evita barrar um token do gateway que por acaso seja só números.
 */
export function looksLikeCardNumber(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return (value.match(/\d(?:[ -]?\d){12,18}/g) ?? []).some((run) => passesLuhn(run.replace(/\D/g, "")));
}

accountRouter.get("/cards", async (req, res) => {
  res.json(await prisma.savedCard.findMany({ where: { profileId: me(req) }, select: cardSelect, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }));
});

/**
 * Guarda um cartão já tokenizado no navegador pelo gateway (o número nunca passa por esta API).
 * Sem um gateway configurado (CARD_PROVIDER), o recurso fica indisponível. Ao integrar o gateway, este ponto deve
 * também confirmar o token com ele antes de gravar.
 */
accountRouter.post("/cards", async (req, res) => {
  if (!env.CARD_PROVIDER) throw new AppError("Salvar cartão ainda não está disponível: nenhum gateway de pagamento foi configurado.", 501);
  if (Object.values(req.body ?? {}).some(looksLikeCardNumber)) throw new AppError("Nunca envie o número completo do cartão. Use apenas o token do gateway.", 400);
  const data = cardBody.parse(req.body);
  const profileId = me(req);
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.savedCard.count({ where: { profileId } });
    if (count >= 5) throw new AppError("Você pode salvar até 5 cartões", 409);
    return tx.savedCard.create({ data: { ...data, profileId, provider: env.CARD_PROVIDER!, isDefault: count === 0 }, select: cardSelect });
  });
  res.status(201).json(created);
});

accountRouter.put("/cards/:id/default", async (req, res) => {
  const profileId = me(req);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    if (!(await tx.savedCard.findFirst({ where: { id, profileId }, select: { id: true } }))) throw new AppError("Cartão não encontrado", 404);
    await tx.savedCard.updateMany({ where: { profileId, isDefault: true }, data: { isDefault: false } });
    await tx.savedCard.update({ where: { id }, data: { isDefault: true } });
  });
  res.json(await prisma.savedCard.findMany({ where: { profileId }, select: cardSelect, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }));
});

accountRouter.delete("/cards/:id", async (req, res) => {
  const profileId = me(req);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const own = await tx.savedCard.findFirst({ where: { id, profileId } });
    if (!own) throw new AppError("Cartão não encontrado", 404);
    await tx.savedCard.delete({ where: { id } });
    if (own.isDefault) {
      const next = await tx.savedCard.findFirst({ where: { profileId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.savedCard.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  res.status(204).end();
});
