import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(process.env.NODE_ENV === "production" ? 8080 : 3333),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de ao menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  /** Pasta onde as fotos enviadas pelo admin são gravadas (na Discloud, um caminho dentro do app). */
  UPLOAD_DIR: z.string().default("uploads"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
