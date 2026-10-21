import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

/** Só o que a API de métricas e o servidor MCP usam: SQL puro, em transação. */
export interface MetricsDb {
  $queryRaw: PrismaClient["$queryRaw"];
  $transaction: <T>(fn: (tx: Pick<PrismaClient, "$executeRawUnsafe" | "$queryRaw" | "$queryRawUnsafe">) => Promise<T>) => Promise<T>;
}

let dedicated: PrismaClient | null = null;

/**
 * Conexão usada pela API de métricas e pelo servidor MCP. Com METRICS_DATABASE_URL (usuário bi_reader, só leitura no esquema bi),
 * usa uma conexão própria; sem ela, usa a conexão principal, e as consultas ficam limitadas ao esquema bi pelo código.
 */
export function metricsDb(): MetricsDb {
  if (!env.METRICS_DATABASE_URL) return prisma as unknown as MetricsDb;
  dedicated ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: env.METRICS_DATABASE_URL }) });
  return dedicated as unknown as MetricsDb;
}
