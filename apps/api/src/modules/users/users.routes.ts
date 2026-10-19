import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { FULL_ACCESS, PERMISSIONS, cleanPermissions } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { fullName, strongPassword } from "../../lib/validation.js";

/**
 * Usuários do painel (montado em /admin/users, só para quem tem a permissão "usuarios"). Cada usuário recebe as áreas
 * que pode usar; "acesso total" vale para tudo. Ninguém tira o próprio acesso de gerenciar usuários e sempre sobra
 * pelo menos um usuário com acesso total, para a loja nunca ficar trancada fora do painel.
 */
export const usersRouter = Router();

const BCRYPT_COST = 12;
const permissionList = z.array(z.union([z.literal(FULL_ACCESS), z.enum(PERMISSIONS)])).max(PERMISSIONS.length + 1);
const email = z.string().trim().toLowerCase().email("E-mail inválido").max(160);
const select = { id: true, name: true, email: true, adminPermissions: true, twoFactorEnabled: true, createdAt: true } as const;
const toUser = (u: { id: string; name: string | null; email: string; adminPermissions: string[]; twoFactorEnabled: boolean; createdAt: Date }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  permissions: u.adminPermissions,
  twoFactorEnabled: u.twoFactorEnabled,
  createdAt: u.createdAt,
});

/** Quantos usuários ATIVOS têm acesso total, sem contar `exceptId`. */
const otherFullAccess = (exceptId: string) => prisma.profile.count({ where: { role: "ADMIN", id: { not: exceptId }, adminPermissions: { has: FULL_ACCESS } } });

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.profile.findMany({ where: { role: "ADMIN" }, select, orderBy: { createdAt: "asc" } });
  res.json(users.map(toUser));
});

usersRouter.post("/", async (req, res) => {
  const body = z.object({ name: fullName, email, password: strongPassword, permissions: permissionList.min(1, "Escolha ao menos uma área do painel.") }).parse(req.body);
  const existing = await prisma.profile.findUnique({ where: { email: body.email }, select: { role: true } });
  if (existing) {
    throw new AppError(existing.role === "ADMIN" ? "Já existe um usuário do painel com este e-mail." : "Este e-mail já é de uma conta de cliente da loja. Use outro e-mail para o painel.", 409);
  }
  const user = await prisma.profile.create({
    data: {
      name: body.name,
      email: body.email,
      role: "ADMIN",
      adminPermissions: cleanPermissions(body.permissions),
      passwordHash: await bcrypt.hash(body.password, BCRYPT_COST),
      passwordChangedAt: new Date(),
      emailVerifiedAt: new Date(),
    },
    select,
  });
  res.status(201).json(toUser(user));
});

usersRouter.put("/:id", async (req, res) => {
  const body = z.object({ name: fullName, permissions: permissionList }).parse(req.body);
  const target = await prisma.profile.findFirst({ where: { id: req.params.id, role: "ADMIN" }, select: { id: true, adminPermissions: true } });
  if (!target) throw new AppError("Usuário do painel não encontrado", 404);
  const permissions = cleanPermissions(body.permissions);
  const isSelf = target.id === req.auth!.sub;
  if (isSelf && !permissions.includes(FULL_ACCESS) && !permissions.includes("usuarios")) {
    throw new AppError("Você não pode tirar de si mesmo o acesso a Usuários.", 409);
  }
  if (target.adminPermissions.includes(FULL_ACCESS) && !permissions.includes(FULL_ACCESS) && (await otherFullAccess(target.id)) === 0) {
    throw new AppError("Este é o único usuário com acesso total. Dê acesso total a outra pessoa antes de mudar este.", 409);
  }
  const user = await prisma.profile.update({ where: { id: target.id }, data: { name: body.name, adminPermissions: permissions }, select });
  res.json(toUser(user));
});

/** Troca a senha de um usuário do painel (as sessões abertas dele caem). */
usersRouter.post("/:id/password", async (req, res) => {
  const { password } = z.object({ password: strongPassword }).parse(req.body);
  const target = await prisma.profile.findFirst({ where: { id: req.params.id, role: "ADMIN" }, select: { id: true } });
  if (!target) throw new AppError("Usuário do painel não encontrado", 404);
  await prisma.profile.update({
    where: { id: target.id },
    data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  res.status(204).end();
});
