import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  sub: string;
  role: "CUSTOMER" | "ADMIN";
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}
