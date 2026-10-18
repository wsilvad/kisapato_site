import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken, type AuthPayload } from "../lib/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthPayload;
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
  const account = await prisma.profile.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true, role: true } });
  if (!account || account.tokenVersion !== (payload.tv ?? 0)) throw new AppError("Sessão inválida ou expirada", 401);
  req.auth = { ...payload, role: account.role }; // o papel vem do banco, não do token
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (req.auth?.role !== "ADMIN") throw new AppError("Acesso restrito a administradores", 403);
    next();
  });
};
