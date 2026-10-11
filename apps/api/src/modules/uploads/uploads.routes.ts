import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { requireAdmin } from "../../middlewares/auth.js";

export const uploadDir = path.resolve(env.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const allowed: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${allowed[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (allowed[file.mimetype]) return cb(null, true);
    cb(new AppError("Envie imagens JPG, PNG, WebP ou AVIF", 400));
  },
});

export const uploadsRouter = Router();

uploadsRouter.post("/", requireAdmin, upload.array("files", 10), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new AppError("Nenhum arquivo enviado", 400);
  res.status(201).json({ urls: files.map((f) => `/uploads/${f.filename}`) });
});
