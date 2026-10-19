import { signToken } from "../../lib/auth.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/** O que o cliente (e o próprio painel) pode ver da conta. Nunca inclui hash de senha nem segredo do 2FA. */
const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  cpf: true,
  role: true,
  adminPermissions: true,
  tokenVersion: true,
  twoFactorEnabled: true,
  twoFactorOfferDismissedAt: true,
  verifiedPhone: true,
} as const;

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserRow>>>;

function findUserRow(id: string) {
  return prisma.profile.findUnique({ where: { id }, select: publicUserSelect });
}

export function toPublicUser(p: UserRow) {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    phone: p.phone,
    cpf: p.cpf,
    role: p.role,
    /** Áreas do painel liberadas (só para ADMIN; "*" = todas). */
    ...(p.role === "ADMIN" && { permissions: p.adminPermissions }),
    twoFactorEnabled: p.twoFactorEnabled,
    /** Oferta pendente: a verificação em duas etapas ainda não foi ativada nem dispensada. */
    twoFactorOffer: !p.twoFactorEnabled && p.twoFactorOfferDismissedAt === null,
    phoneVerified: p.verifiedPhone !== null,
  };
}

export async function loadUser(id: string) {
  const row = await findUserRow(id);
  if (!row) throw new AppError("Usuário não encontrado", 404);
  return row;
}

/** Sessão completa (token + conta) para uma conta já autenticada. */
export async function sessionFor(id: string) {
  const row = await loadUser(id);
  return { token: signToken({ sub: row.id, role: row.role, tv: row.tokenVersion }), user: toPublicUser(row) };
}
