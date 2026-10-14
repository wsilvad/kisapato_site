import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Foto principal (exibição) e miniatura (listas, sacola, miniaturas da galeria). */
export const MAIN_SIZE = 1600;
export const THUMB_SIZE = 420;

const jpeg = (quality: number) => ({ quality, mozjpeg: true, progressive: true }) as const;

/**
 * Gera as duas versões de uma foto: respeita a rotação gravada pelo celular (EXIF), limita o lado maior a
 * MAIN_SIZE (sem ampliar fotos pequenas) e faz uma miniatura quadrada. PNG/WebP com fundo transparente ganham
 * fundo branco, já que a saída é JPEG.
 */
export async function renderVersions(input: Buffer | string) {
  const base = () => sharp(input, { failOn: "error" }).rotate().flatten({ background: "#ffffff" });
  const [main, thumb] = await Promise.all([
    base().resize({ width: MAIN_SIZE, height: MAIN_SIZE, fit: "inside", withoutEnlargement: true }).jpeg(jpeg(82)).toBuffer(),
    base().resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover" }).jpeg(jpeg(78)).toBuffer(),
  ]);
  return { main, thumb };
}

/** Nome da miniatura de um arquivo: `abc.jpg` / `abc.png` → `abc-thumb.jpg`. */
export const thumbName = (file: string) => `${path.parse(file).name}-thumb.jpg`;

/** Grava as duas versões em `dir` e devolve o caminho público da principal (`/uploads/<id>.jpg`). */
export async function saveImage(buffer: Buffer, dir: string) {
  const id = randomUUID();
  const { main, thumb } = await renderVersions(buffer);
  await Promise.all([writeFile(path.join(dir, `${id}.jpg`), main), writeFile(path.join(dir, `${id}-thumb.jpg`), thumb)]);
  return `/uploads/${id}.jpg`;
}
