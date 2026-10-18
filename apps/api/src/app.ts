import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { uploadDir } from "./modules/uploads/uploads.routes.js";
import { routes } from "./routes/index.js";

export const app = express();

// Atrás do proxy da Discloud o IP do cliente vem no X-Forwarded-For; o limitador de tentativas lê o IP daqui.
app.set("trust proxy", env.TRUST_PROXY ?? (env.NODE_ENV === "production" ? 1 : 0));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
app.use(express.json());

app.use("/uploads", express.static(uploadDir, { maxAge: "7d", immutable: true }));
app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);
