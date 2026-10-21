import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { startAnalytics, stopAnalytics } from "./modules/analytics/jobs.js";

const server = app.listen(env.PORT, () => {
  console.log(`API rodando em http://localhost:${env.PORT}/api`);
  startAnalytics();
});

async function shutdown() {
  server.close();
  await stopAnalytics(); // grava o que ainda está no buffer de eventos
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
