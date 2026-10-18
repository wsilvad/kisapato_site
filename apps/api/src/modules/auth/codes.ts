import type { CodeChannel, CodePurpose } from "../../generated/prisma/client.js";
import { hashCode, randomDigits, safeEqualHex } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";

export const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_SECONDS = 60;

const hashFor = (profileId: string, purpose: CodePurpose, code: string) => hashCode(`${profileId}:${purpose}:${code}`);

/**
 * Cria um código de 6 dígitos para a conta e invalida os anteriores do mesmo tipo.
 * Devolve null se um código foi pedido há menos de 1 minuto (evita disparar e-mail/SMS em sequência).
 */
export async function issueCode(profileId: string, purpose: CodePurpose, channel: CodeChannel, destination: string) {
  const recent = await prisma.verificationCode.findFirst({
    where: { profileId, purpose, consumedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_AFTER_SECONDS * 1000) } },
  });
  if (recent) return null;

  const code = randomDigits(6);
  await prisma.$transaction([
    prisma.verificationCode.updateMany({ where: { profileId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.verificationCode.create({
      data: { profileId, purpose, channel, destination, codeHash: hashFor(profileId, purpose, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) },
    }),
  ]);
  return code;
}

/**
 * Confere o código. Cada tentativa errada conta; com 5 erros o código é descartado. Código certo só vale uma vez.
 * `destination` amarra o código ao e-mail/telefone para onde foi enviado.
 */
export async function consumeCode(profileId: string, purpose: CodePurpose, destination: string, code: string) {
  const record = await prisma.verificationCode.findFirst({
    where: { profileId, purpose, destination, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_ATTEMPTS) return false;

  const ok = /^\d{6}$/.test(code) && safeEqualHex(record.codeHash, hashFor(profileId, purpose, code));
  if (!ok) {
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  // consumo atômico: se duas requisições chegarem juntas, só uma passa
  const claimed = await prisma.verificationCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
  return claimed.count === 1;
}

/**
 * Confere vários códigos de uma vez (ex.: o do e-mail e o do SMS no cadastro). Os códigos só são consumidos se TODOS
 * estiverem certos; assim o cliente que errou um não perde o outro. Cada código errado gasta uma das 5 tentativas dele.
 * Devolve, na mesma ordem, se cada um estava certo.
 */
export async function consumeAll(profileId: string, checks: { purpose: CodePurpose; destination: string; code: string }[]) {
  const records = await Promise.all(
    checks.map((c) =>
      prisma.verificationCode.findFirst({
        where: { profileId, purpose: c.purpose, destination: c.destination, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  const results = checks.map((c, i) => {
    const record = records[i];
    return Boolean(record) && record!.attempts < MAX_ATTEMPTS && /^\d{6}$/.test(c.code) && safeEqualHex(record!.codeHash, hashFor(profileId, c.purpose, c.code));
  });

  await Promise.all(records.flatMap((r, i) => (r && !results[i] ? [prisma.verificationCode.update({ where: { id: r.id }, data: { attempts: { increment: 1 } } })] : [])));

  if (!results.every(Boolean)) return results;
  const ids = records.map((r) => r!.id);
  const claimed = await prisma.verificationCode.updateMany({ where: { id: { in: ids }, consumedAt: null }, data: { consumedAt: new Date() } });
  return claimed.count === ids.length ? results : results.map(() => false);
}
