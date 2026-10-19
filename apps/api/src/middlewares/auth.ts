import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken, type AuthPayload } from "../lib/auth.js";
import { FULL_ACCESS, hasPermission, requiredPermissions } from "../lib/permissions.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthPayload;
    /** Áreas do painel liberadas para quem está logado (só ADMIN). */
    permissions?: string[];
  }
}

/** Confere o token e se a conta ainda existe com a mesma versão de sessão (senha trocada = sessões antigas caem). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError("Não autenticado", 401);
  let payload: AuthPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw new AppError("Sessão inválida ou expirada", 401);
  }
  const account = await prisma.profile.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true, role: true, adminPermissions: true } });
  if (!account || account.tokenVersion !== (payload.tv ?? 0)) throw new AppError("Sessão inválida ou expirada", 401);
  req.auth = { ...payload, role: account.role }; // o papel e as permissões vêm do banco, não do token
  req.permissions = account.role === "ADMIN" ? account.adminPermissions : [];
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (req.auth?.role !== "ADMIN") throw new AppError("Acesso restrito a administradores", 403);
    if (!req.permissions?.length) throw new AppError("Seu acesso ao painel está desativado. Fale com o responsável pela loja.", 403);
    next();
  });
};

/** Depois de `requireAdmin`: cada área do painel só abre para quem tem a permissão dela (acesso total abre tudo). */
export const requirePanelPermission: RequestHandler = (req, _res, next) => {
  const needed = requiredPermissions(req.method, req.path);
  const granted = req.permissions ?? [];
  const allowed = needed === null ? granted.includes(FULL_ACCESS) : needed.length === 0 || hasPermission(granted, ...needed);
  if (!allowed) throw new AppError("Você não tem permissão para esta área do painel.", 403);
  next();
};
