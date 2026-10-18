/**
 * Texto das páginas institucionais (escrito no painel): blocos separados por linha em branco.
 *   ## Título                     → título de seção
 *   ## Rótulo | Título            → título de seção com um rótulo pequeno em cima
 *   ![descrição](/uploads/x.jpg)  → foto (só endereços /uploads/… ou https://…)
 *   ![descrição](/uploads/x.jpg){w=media r=16:9 x=30 y=20 z=1.4 mx=50 my=10 mz=1 lado=esquerda}
 *                                 → foto com opções: w = largura (total, grande, media, pequena); r = proporção do corte
 *                                   (auto, natural, 21:9, 16:9, 3:2, 1:1, 4:5); x/y = ponto de foco em % e z = zoom (1 a 3),
 *                                   como no enquadramento das campanhas; mx/my/mz = o mesmo só no celular (sem eles, o
 *                                   celular usa o do computador); lado = esquerda/direita põe a foto ao lado do texto seguinte
 *   várias fotos em linhas seguidas (sem linha em branco entre elas) → fotos lado a lado (grupo)
 *   - item                        → lista
 *   qualquer outro texto          → parágrafo
 */
import { CENTERED, sameCrop, type Crop } from "@/lib/crop";

export const PHOTO_WIDTHS = ["total", "grande", "media", "pequena"] as const;
export const PHOTO_RATIOS = ["auto", "natural", "21:9", "16:9", "3:2", "1:1", "4:5"] as const;
export const PHOTO_SIDES = ["nenhum", "esquerda", "direita"] as const;

export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];
export type PhotoRatio = (typeof PHOTO_RATIOS)[number];
export type PhotoSide = (typeof PHOTO_SIDES)[number];

export interface PagePhoto {
  src: string;
  alt: string;
  /** Largura na página (foto sozinha). */
  w: PhotoWidth;
  /** Proporção do enquadramento: "auto" = padrão do lugar onde a foto está; "natural" = foto inteira, sem cortar. */
  r: PhotoRatio;
  /** Enquadramento no computador (ponto de foco em % e zoom), igual ao das campanhas. */
  crop: Crop;
  /** Enquadramento só no celular; sem ele, vale o do computador. */
  mobile?: Crop;
  /** Ao lado do texto seguinte (esquerda/direita) ou sozinha ("nenhum"). */
  lado: PhotoSide;
}

export const newPhoto = (src: string, alt = ""): PagePhoto => ({ src, alt, w: "total", r: "auto", crop: { ...CENTERED }, lado: "nenhum" });
export const mobileCropOf = (p: PagePhoto): Crop => p.mobile ?? p.crop;

/** Nomes antigos do enquadramento (x=esquerda, y=topo…) continuam valendo. */
const LEGACY_POS: Record<string, number> = { esquerda: 0, topo: 0, centro: 50, direita: 100, base: 100 };
const percent = (v: string) => {
  const n = v in LEGACY_POS ? LEGACY_POS[v]! : Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : null;
};
const zoom = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(3, Math.max(1, Math.round(n * 100) / 100)) : null;
};

export type PageBlock =
  | ({ kind: "img" } & PagePhoto)
  | { kind: "gallery"; photos: PagePhoto[] }
  | { kind: "h2"; eyebrow?: string; title: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

/** Só fotos enviadas pelo painel ou de endereços https; qualquer outra coisa (javascript:, data:…) é ignorada. */
export function isSafeImageSrc(src: string) {
  return src.startsWith("/uploads/") || /^https:\/\/[^\s]+$/.test(src);
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?$/;
export const isImageLine = (line: string) => IMAGE_LINE.test(line.trim());

/** Lê uma linha de foto (com ou sem opções). Devolve null se não for uma foto válida e segura. */
export function parseImageLine(text: string): PagePhoto | null {
  const m = text.trim().match(IMAGE_LINE);
  if (!m || !isSafeImageSrc(m[2]!)) return null;
  const photo = newPhoto(m[2]!, m[1]!.trim());
  const mobile: Partial<Crop> = {};
  for (const token of (m[3] ?? "").split(/\s+/).filter(Boolean)) {
    const [key, value = ""] = token.split("=");
    if (key === "w" && (PHOTO_WIDTHS as readonly string[]).includes(value)) photo.w = value as PhotoWidth;
    if (key === "r" && (PHOTO_RATIOS as readonly string[]).includes(value)) photo.r = value as PhotoRatio;
    if (key === "lado" && (PHOTO_SIDES as readonly string[]).includes(value)) photo.lado = value as PhotoSide;
    const n = key === "z" || key === "mz" ? zoom(value) : percent(value);
    if (n === null) continue;
    if (key === "x") photo.crop.x = n;
    if (key === "y") photo.crop.y = n;
    if (key === "z") photo.crop.zoom = n;
    if (key === "mx") mobile.x = n;
    if (key === "my") mobile.y = n;
    if (key === "mz") mobile.zoom = n;
  }
  if (Object.keys(mobile).length) photo.mobile = { ...photo.crop, ...mobile };
  return photo;
}

/** Escreve a foto de volta como linha de texto (só grava as opções que fogem do padrão). */
export function serializeImage(p: PagePhoto): string {
  const m = p.mobile && !sameCrop(p.mobile, p.crop) ? p.mobile : null;
  const opts = [
    p.w !== "total" && `w=${p.w}`,
    p.r !== "auto" && `r=${p.r}`,
    p.crop.x !== 50 && `x=${p.crop.x}`,
    p.crop.y !== 50 && `y=${p.crop.y}`,
    p.crop.zoom !== 1 && `z=${p.crop.zoom}`,
    m && `mx=${m.x} my=${m.y} mz=${m.zoom}`,
    p.lado !== "nenhum" && `lado=${p.lado}`,
  ].filter(Boolean);
  return `![${p.alt.replace(/[\]\n]/g, " ").trim()}](${p.src})${opts.length ? `{${opts.join(" ")}}` : ""}`;
}

/** Blocos do texto exatamente como foram escritos (o painel de fotos mexe só nos que são foto). */
export const splitBody = (body: string) => (body.trim() ? body.trim().split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean) : []);
export const joinBody = (blocks: string[]) => blocks.join("\n\n");

/** Fotos de um bloco cru (uma foto sozinha ou um grupo em linhas seguidas); null se o bloco não for só de fotos. */
export function photosOfBlock(block: string): PagePhoto[] | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 || !lines.every(isImageLine)) return null;
  return lines.map(parseImageLine).filter((p): p is PagePhoto => p !== null);
}

export function parsePageBody(body: string): PageBlock[] {
  const blocks: PageBlock[] = [];
  for (const text of splitBody(body)) {
    const photos = photosOfBlock(text);
    if (photos) {
      if (photos.length === 1) blocks.push({ kind: "img", ...photos[0]! });
      else if (photos.length > 1) blocks.push({ kind: "gallery", photos });
      continue;
    }
    if (text.startsWith("## ")) {
      const [first, ...rest] = text.slice(3).split("|").map((s) => s.trim());
      const title = rest.join(" | ");
      blocks.push(title ? { kind: "h2", eyebrow: first, title } : { kind: "h2", title: first ?? "" });
      continue;
    }
    const lines = text.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) blocks.push({ kind: "ul", items: lines.map((l) => l.slice(2)) });
    else blocks.push({ kind: "p", text: lines.join(" ") });
  }
  return blocks;
}

type TextBlock = Extract<PageBlock, { kind: "p" | "ul" }>;

/** Para desenhar: a foto com `lado` leva junto os textos que vêm logo depois dela (até a próxima foto ou título). */
export type LayoutItem = Exclude<PageBlock, { kind: "img" }> | ({ kind: "img" } & PagePhoto) | { kind: "split"; photo: PagePhoto; texts: TextBlock[] };

export function groupForLayout(blocks: PageBlock[]): LayoutItem[] {
  const items: LayoutItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === "img" && b.lado !== "nenhum") {
      const texts: TextBlock[] = [];
      while (blocks[i + 1] && (blocks[i + 1]!.kind === "p" || blocks[i + 1]!.kind === "ul")) texts.push(blocks[++i] as TextBlock);
      const photo: PagePhoto = { src: b.src, alt: b.alt, w: b.w, r: b.r, crop: b.crop, mobile: b.mobile, lado: b.lado };
      items.push({ kind: "split", photo, texts });
    } else {
      items.push(b);
    }
  }
  return items;
}

export interface AboutSection {
  id: string;
  eyebrow?: string;
  title: string;
  blocks: PageBlock[];
}

export interface AboutLayout {
  /** Foto em largura total no topo (se o texto começa por uma foto sozinha). */
  hero?: Extract<PageBlock, { kind: "img" }>;
  /** Primeiro parágrafo: a frase de destaque. */
  lead?: string;
  /** Conteúdo entre a frase de destaque e a primeira seção. */
  intro: PageBlock[];
  sections: AboutSection[];
}

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "secao";

/** Organiza os blocos no desenho da página “Sobre”: foto, frase de destaque e seções. */
export function toAboutLayout(blocks: PageBlock[]): AboutLayout {
  let i = 0;
  let hero: AboutLayout["hero"];
  const first = blocks[0];
  if (first?.kind === "img" && first.lado === "nenhum") {
    hero = first;
    i = 1;
  }
  let lead: string | undefined;
  if (blocks[i]?.kind === "p") {
    lead = (blocks[i] as Extract<PageBlock, { kind: "p" }>).text;
    i += 1;
  }

  const intro: PageBlock[] = [];
  const sections: AboutSection[] = [];
  const used = new Set<string>();
  for (; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === "h2") {
      let id = slugify(b.eyebrow ?? b.title);
      while (used.has(id)) id += "-2";
      used.add(id);
      sections.push({ id, eyebrow: b.eyebrow, title: b.title, blocks: [] });
    } else {
      (sections.at(-1)?.blocks ?? intro).push(b);
    }
  }
  return { hero, lead, intro, sections };
}
