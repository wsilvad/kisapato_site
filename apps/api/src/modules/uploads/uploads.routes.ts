import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { requireAdmin } from "../../middlewares/auth.js";
import { saveImage } from "./image.js";

export const uploadDir = path.resolve(env.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

// Em memória: o arquivo original nunca vai para o disco; só as versões otimizadas (foto de celular chega a vários MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new AppError("Envie imagens JPG, PNG, WebP, AVIF ou GIF", 400));
  },
});

/** Vídeos dos stories: guardados como vieram (não há conversão no servidor), direto no disco para não ocupar a memória. */
const VIDEO_EXT: Record<string, string> = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" };
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

const videoUpload = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${randomUUID()}${VIDEO_EXT[file.mimetype] ?? ".mp4"}`) }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_EXT[file.mimetype]) return cb(null, true);
    cb(new AppError("Envie um vídeo MP4, WebM ou MOV", 400));
  },
});

/** Confere os primeiros bytes: MP4/MOV têm "ftyp" na posição 4; WebM começa com 1A 45 DF A3. */
async function looksLikeVideo(file: string) {
  const handle = await open(file, "r");
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    return head.subarray(4, 8).toString("latin1") === "ftyp" || head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  } finally {
    await handle.close();
  }
}

export const uploadsRouter = Router();

/** Recebe o vídeo, confere o formato e devolve o endereço. Separado da rota para poder ser testado sem login. */
export const videoHandlers: RequestHandler[] = [
  videoUpload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError("Nenhum arquivo enviado", 400);
    if (!(await looksLikeVideo(file.path))) {
      await rm(file.path, { force: true });
      throw new AppError("O arquivo não parece ser um vídeo válido. Use MP4 (H.264), WebM ou MOV.", 400);
    }
    res.status(201).json({ url: `/uploads/${file.filename}` });
  },
];

uploadsRouter.post("/video", requireAdmin, ...videoHandlers);

uploadsRouter.post("/", requireAdmin, upload.array("files", 8), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new AppError("Nenhum arquivo enviado", 400);
  try {
    const urls = [];
    for (const file of files) urls.push(await saveImage(file.buffer, uploadDir, file.mimetype === "image/gif")); // uma por vez: poupa memória
    res.status(201).json({ urls });
  } catch {
    throw new AppError("Não foi possível ler uma das imagens. Se for um GIF, ele pode ter quadros demais ou ser grande demais: reduza as dimensões ou a duração e tente de novo.", 400);
  }
});
