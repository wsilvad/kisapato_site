import "dotenv/config";
import { defineConfig } from "prisma/config";

// O CLI do Prisma (migrate, studio) usa DIRECT_URL quando definida; senão, a DATABASE_URL.
// O runtime da API usa DATABASE_URL via driver adapter em src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
