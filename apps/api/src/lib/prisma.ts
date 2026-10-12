import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/**
 * Dados internos (custo e observação do pedido) nunca saem em consultas por padrão (lojista vê, cliente não). Quem precisa
 * deles (painel admin, relatórios, registro do custo na venda) pede com `omit: { costPrice: false }`.
 */
export const prisma = new PrismaClient({
  adapter,
  omit: { product: { costPrice: true }, orderItem: { unitCost: true }, order: { internalNote: true } },
  // O banco é remoto (~100 ms por consulta): pedidos com vários itens e cancelamentos precisam de mais que os 5 s padrão.
  transactionOptions: { timeout: 30_000, maxWait: 10_000 },
});
