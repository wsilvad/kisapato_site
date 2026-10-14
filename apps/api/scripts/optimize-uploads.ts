/**
 * Reprocessa as fotos já enviadas: reduz as grandes para 1600 px, corrige a rotação e cria as miniaturas.
 * Os originais vão para uma pasta ao lado (uploads-originais), fora do que o site serve.
 * Uso: npm run uploads:optimize -w @ki-sapato/api
 */
import "dotenv/config";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAIN_SIZE, renderVersions, thumbName } from "../src/modules/uploads/image.js";

const dir = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
const backup = `${dir}-originais`;
await mkdir(backup, { recursive: true });

let done = 0;
for (const file of await readdir(dir)) {
  if (!/\.(jpe?g|png|webp|avif)$/i.test(file) || /-thumb\.jpg$/i.test(file)) continue;
  const full = path.join(dir, file);
  if (!(await stat(full)).isFile()) continue;

  const meta = await sharp(full).metadata();
  const oversize = Math.max(meta.width ?? 0, meta.height ?? 0) > MAIN_SIZE;
  const hasThumb = await stat(path.join(dir, thumbName(file))).then(() => true, () => false);
  if (!oversize && !hasThumb) {
    // já é pequena: só falta a miniatura
    const { thumb } = await renderVersions(full);
    await writeFile(path.join(dir, thumbName(file)), thumb);
    console.log(`miniatura criada: ${file}`);
    done++;
    continue;
  }
  if (!oversize && hasThumb) continue;

  await copyFile(full, path.join(backup, file));
  const { main, thumb } = await renderVersions(full);
  // O nome da principal continua o mesmo, para os endereços já gravados nos produtos seguirem valendo.
  const ext = path.extname(file).toLowerCase();
  const resized = ext === ".png" ? await sharp(main).png().toBuffer() : ext === ".webp" ? await sharp(main).webp({ quality: 82 }).toBuffer() : ext === ".avif" ? await sharp(main).avif({ quality: 60 }).toBuffer() : main;
  await writeFile(full, resized);
  await writeFile(path.join(dir, thumbName(file)), thumb);
  console.log(`otimizada: ${file}  ${meta.width}x${meta.height} → ${MAIN_SIZE}px (${((await stat(full)).size / 1024).toFixed(0)} KB)`);
  done++;
}
console.log(done === 0 ? "Nada a fazer: tudo já está otimizado." : `Pronto: ${done} arquivo(s). Originais em ${backup}`);
