import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { verifyToken, type AuthPayload } from "../lib/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthPayload;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError("Não autenticado", 401);
  try {
    req.auth = verifyToken(header.slice(7));
  } catch {
    throw new AppError("Sessão inválida ou expirada", 401);
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "ADMIN") throw new AppError("Acesso restrito a administradores", 403);
    next();
  });
};
