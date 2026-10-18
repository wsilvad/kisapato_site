import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

/** Erros previsíveis do Prisma viram respostas claras em vez de 500. */
function knownPrismaError(err: unknown): { status: number; message: string } | null {
  const { code, meta } = (err ?? {}) as { code?: unknown; meta?: { target?: unknown } };
  if (typeof code !== "string") return null;
  if (code === "P2002") {
    const target = Array.isArray(meta?.target) ? meta.target.join(", ") : "valor informado";
    return { status: 409, message: `Já existe um registro com esse ${target}` };
  }
  if (code === "P2003") return { status: 409, message: "Este registro está em uso por outros dados e não pode ser alterado ou removido" };
  if (code === "P2025") return { status: 404, message: "Registro não encontrado" };
  return null;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Dados inválidos", details: z.flattenError(err) });
    return;
  }

  // multer (envio de arquivos): arquivo grande demais, campo inesperado…
  if (err?.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({ error: tooBig ? "Arquivo grande demais: o limite é 15 MB (vídeo, GIF ou foto). Reduza o tamanho e tente de novo." : "Não foi possível receber o arquivo." });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, ...(err.code && { code: err.code }) });
    return;
  }

  const prismaError = knownPrismaError(err);
  if (prismaError) {
    res.status(prismaError.status).json({ error: prismaError.message });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: "Erro interno do servidor",
    ...(env.NODE_ENV !== "production" && { message: String(err?.message ?? err) }),
  });
};
