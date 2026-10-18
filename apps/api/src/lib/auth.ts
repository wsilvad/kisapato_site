import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  sub: string;
  role: "CUSTOMER" | "ADMIN";
  /** Versão das sessões da conta; trocar a senha ou o 2FA sobe a versão e derruba os tokens antigos. Tokens antigos sem `tv` valem como 0. */
  tv?: number;
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): AuthPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload & { purpose?: string };
  if (payload.purpose) throw new Error("Token de uso restrito"); // o desafio do 2FA não serve como sessão
  return payload;
}

/** Senha conferida, falta o código do 2FA: um token curto que só vale para a etapa seguinte da entrada. */
export function signTwoFactorChallenge(sub: string) {
  return jwt.sign({ sub, purpose: "2fa" }, env.JWT_SECRET, { expiresIn: "5m" });
}

export function verifyTwoFactorChallenge(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; purpose?: string };
  if (payload.purpose !== "2fa") throw new Error("Token inválido");
  return payload.sub;
}
