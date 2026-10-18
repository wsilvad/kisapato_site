import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Ki Sapato";

function totpFor(secretBase32: string, account: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: account,
    algorithm: "SHA1", // o padrão aceito por Google Authenticator, Authy, Microsoft Authenticator, 1Password…
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/** Segredo novo (160 bits) em base32. */
export function newTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** Endereço `otpauth://` e QR code (imagem PNG em data URL) para o cliente escanear no aplicativo autenticador. */
export async function enrollmentFor(secretBase32: string, account: string) {
  const otpauthUrl = totpFor(secretBase32, account).toString();
  return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }) };
}

/** Aceita o código atual e o do intervalo anterior/seguinte (±30 s), para tolerar diferença de relógio. */
export function verifyTotp(secretBase32: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return totpFor(secretBase32, "x").validate({ token, window: 1 }) !== null;
}
