import { decrypt, hashCode, normalizeRecoveryCode, randomRecoveryCode } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";
import { verifyTotp } from "../../lib/two-factor.js";

export const RECOVERY_CODE_COUNT = 10;

export const recoveryHash = (profileId: string, code: string) => hashCode(`recovery:${profileId}:${normalizeRecoveryCode(code)}`);

/**
 * Confere o segundo fator: o código de 6 dígitos do aplicativo autenticador ou um código de emergência.
 * O código de emergência só vale uma vez (a baixa é atômica).
 */
export async function verifySecondFactor(user: { id: string; twoFactorSecret: string | null }, input: string): Promise<boolean> {
  const digits = input.replace(/\s/g, "");
  if (/^\d{6}$/.test(digits)) {
    return user.twoFactorSecret ? verifyTotp(decrypt(user.twoFactorSecret), digits) : false;
  }
  if (input.trim().length < 10) return false;
  const used = await prisma.recoveryCode.updateMany({
    where: { profileId: user.id, codeHash: recoveryHash(user.id, input), usedAt: null },
    data: { usedAt: new Date() },
  });
  return used.count === 1;
}

/** Gera um novo conjunto de códigos de emergência, descartando o anterior. Os códigos em texto só existem nesta resposta. */
export async function replaceRecoveryCodes(profileId: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { profileId } }),
    prisma.recoveryCode.createMany({ data: codes.map((code) => ({ profileId, codeHash: recoveryHash(profileId, code) })) }),
  ]);
  return codes;
}
