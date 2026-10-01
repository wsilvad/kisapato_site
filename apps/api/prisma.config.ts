import "dotenv/config";
import { defineConfig } from "prisma/config";

// O CLI do Prisma (migrate, studio) usa a conexão direta do Supabase.
// O runtime da API usa DATABASE_URL (pooler) via driver adapter em src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
