import { Router } from "express";
import { getSiteSettings } from "./settings.service.js";

export const settingsRouter = Router();

/** Conteúdo público do cabeçalho, home e rodapé. */
settingsRouter.get("/", async (_req, res) => {
  res.json(await getSiteSettings());
});
