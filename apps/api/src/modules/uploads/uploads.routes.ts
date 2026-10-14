import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { requireAdmin } from "../../middlewares/auth.js";
import { saveImage } from "./image.js";

export const uploadDir = path.resolve(env.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

// Em memória: o arquivo original nunca vai para o disco; só as versões otimizadas (foto de celular chega a vários MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new AppError("Envie imagens JPG, PNG, WebP ou AVIF", 400));
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/", requireAdmin, upload.array("files", 8), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new AppError("Nenhum arquivo enviado", 400);
  try {
    const urls = [];
    for (const file of files) urls.push(await saveImage(file.buffer, uploadDir)); // uma por vez: poupa memória
    res.status(201).json({ urls });
  } catch {
    throw new AppError("Não foi possível ler uma das imagens. Tente outro arquivo.", 400);
  }
});
