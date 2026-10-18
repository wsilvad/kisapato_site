import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/**
 * Dados internos (custo e observação do pedido) nunca saem em consultas por padrão (lojista vê, cliente não). Quem precisa
 * deles (painel admin, relatórios, registro do custo na venda) pede com `omit: { costPrice: false }`.
 * O mesmo vale para o hash da senha e o segredo do 2FA: só o login e a verificação em duas etapas os pedem
 * (`omit: { passwordHash: false }` / `omit: { twoFactorSecret: false }`), então nenhuma listagem os devolve por engano.
 */
export const prisma = new PrismaClient({
  adapter,
  omit: {
    product: { costPrice: true },
    orderItem: { unitCost: true },
    order: { internalNote: true },
    profile: { passwordHash: true, twoFactorSecret: true },
  },
  // O banco é remoto (~100 ms por consulta): pedidos com vários itens e cancelamentos precisam de mais que os 5 s padrão.
  transactionOptions: { timeout: 30_000, maxWait: 10_000 },
});
