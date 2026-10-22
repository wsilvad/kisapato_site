import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Foto principal (exibição) e miniatura (listas, sacola, miniaturas da galeria). */
export const MAIN_SIZE = 1600;
export const THUMB_SIZE = 420;

/**
 * Memória: sem cache interno e com um fio só por operação. O que decide o pico é quantas fotos processam juntas (ver
 * upload-queue.ts), não a velocidade de uma foto: o custo é ~10% de tempo por imagem, imperceptível num envio.
 */
sharp.cache(false);
sharp.concurrency(1);

/** Foto estática acima disso é recusada antes de ser lida (PNG/WebP de poucos KB podem esconder centenas de megapixels). */
export const MAX_PIXELS = 100_000_000;

/** Mensagem clara para o usuário quando o `sharp` recusa a imagem por tamanho; `null` para qualquer outro erro. */
export function imageLimitMessage(error: unknown) {
  return error instanceof Error && /pixel limit/i.test(error.message)
    ? `Uma das imagens é grande demais (o máximo é ${MAX_PIXELS / 1_000_000} megapixels, bem acima de uma foto de celular). Reduza as dimensões e tente de novo.`
    : null;
}

const jpeg = (quality: number) => ({ quality, mozjpeg: true, progressive: true }) as const;

/**
 * Gera as duas versões de uma foto: respeita a rotação gravada pelo celular (EXIF), limita o lado maior a
 * MAIN_SIZE (sem ampliar fotos pequenas) e faz uma miniatura quadrada. PNG/WebP com fundo transparente ganham
 * fundo branco, já que a saída é JPEG. A foto original é lida uma vez só: a miniatura sai da versão principal já reduzida.
 */
export async function renderVersions(input: Buffer | string) {
  const main = await sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: MAIN_SIZE, height: MAIN_SIZE, fit: "inside", withoutEnlargement: true })
    .jpeg(jpeg(82))
    .toBuffer();
  const thumb = await sharp(main).resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover" }).jpeg(jpeg(78)).toBuffer();
  return { main, thumb };
}

/** Largura máxima de um GIF animado (os cartões "stories" aparecem com ~300 px; 640 cobre telas retina). */
export const ANIMATED_WIDTH = 640;

/**
 * GIF animado: vira WebP animado (bem mais leve, mesma animação) com largura limitada, mais a miniatura com o
 * primeiro quadro. `limitInputPixels` barra GIFs enormes (largura × altura × quadros) antes de estourar a memória.
 */
export async function renderAnimated(input: Buffer) {
  const [main, thumb] = await Promise.all([
    sharp(input, { animated: true, limitInputPixels: 200_000_000 }).resize({ width: ANIMATED_WIDTH, withoutEnlargement: true }).webp({ quality: 80, effort: 3 }).toBuffer(),
    sharp(input, { page: 0 }).flatten({ background: "#ffffff" }).resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: "cover" }).jpeg(jpeg(78)).toBuffer(),
  ]);
  return { main, thumb };
}

/** Nome da miniatura de um arquivo: `abc.jpg` / `abc.png` → `abc-thumb.jpg`. */
export const thumbName = (file: string) => `${path.parse(file).name}-thumb.jpg`;

/** Grava as duas versões em `dir` e devolve o caminho público da principal (`/uploads/<id>.jpg`). */
export async function saveImage(buffer: Buffer, dir: string, animated = false) {
  const id = randomUUID();
  const ext = animated ? "webp" : "jpg";
  const { main, thumb } = animated ? await renderAnimated(buffer) : await renderVersions(buffer);
  await Promise.all([writeFile(path.join(dir, `${id}.${ext}`), main), writeFile(path.join(dir, `${id}-thumb.jpg`), thumb)]);
  return `/uploads/${id}.${ext}`;
}
