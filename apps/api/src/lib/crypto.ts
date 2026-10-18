import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Chave de 32 bytes que cifra dados sensíveis no banco (segredo da verificação em duas etapas).
 * Produção: só DATA_ENCRYPTION_KEY (se faltar, retorna null e o recurso fica indisponível).
 * Desenvolvimento: se faltar, deriva do JWT_SECRET para não travar o trabalho local.
 */
function loadKey(): Buffer | null {
  if (env.DATA_ENCRYPTION_KEY) return Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
  if (env.NODE_ENV === "production") return null;
  return Buffer.from(hkdfSync("sha256", env.JWT_SECRET, "ki-sapato", "data-encryption-key", 32));
}

const key = loadKey();

export const encryptionAvailable = key !== null;

/** AES-256-GCM. Formato: `v1.<iv>.<tag>.<texto cifrado>` (base64url). */
export function encrypt(plain: string): string {
  if (!key) throw new Error("DATA_ENCRYPTION_KEY não configurada");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  if (!key) throw new Error("DATA_ENCRYPTION_KEY não configurada");
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Formato de dado cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash dos códigos curtos (e-mail/SMS e emergência): HMAC com o segredo do servidor, para um vazamento do banco não permitir testar códigos offline. */
export function hashCode(value: string) {
  return createHmac("sha256", env.JWT_SECRET).update(value).digest("hex");
}

/** Compara dois hashes hexadecimais em tempo constante. */
export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Código numérico aleatório (criptograficamente seguro), ex.: "048213". */
export function randomDigits(length = 6) {
  return Array.from({ length }, () => randomInt(0, 10)).join("");
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para não confundir ao digitar

/** Código de emergência no formato XXXXX-XXXXX (10 caracteres, ~50 bits). */
export function randomRecoveryCode() {
  const pick = () => RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  return `${Array.from({ length: 5 }, pick).join("")}-${Array.from({ length: 5 }, pick).join("")}`;
}

/** Normaliza o que o cliente digitou ("abcde 12345", "ABCDE12345") para comparar com o hash. */
export function normalizeRecoveryCode(input: string) {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}
