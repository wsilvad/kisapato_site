import type { CSSProperties } from "react";
import type { Campaign } from "@/types/product";

/** Enquadramento de uma foto: ponto de foco (x, y em %) e zoom (1 = sem zoom). */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export const CENTERED: Crop = { x: 50, y: 50, zoom: 1 };

export const desktopCrop = (c?: Partial<Campaign>): Crop => ({ x: c?.desktopFocusX ?? 50, y: c?.desktopFocusY ?? 50, zoom: c?.desktopZoom ?? 1 });
export const mobileCrop = (c?: Partial<Campaign>): Crop => ({ x: c?.mobileFocusX ?? 50, y: c?.mobileFocusY ?? 50, zoom: c?.mobileZoom ?? 1 });

/** Estilo de uma foto `object-fit: cover` com foco e zoom: o zoom cresce a partir do próprio ponto de foco. */
export const cropStyle = (c: Crop): CSSProperties => ({
  objectPosition: `${c.x}% ${c.y}%`,
  transformOrigin: `${c.x}% ${c.y}%`,
  transform: c.zoom === 1 ? undefined : `scale(${c.zoom})`,
});

/** Na loja o recorte muda entre computador e celular; variáveis CSS deixam o @media escolher qual usar. */
export const cropVarsOf = (d: Crop, m: Crop) =>
  ({ "--dx": `${d.x}%`, "--dy": `${d.y}%`, "--dz": d.zoom, "--mx": `${m.x}%`, "--my": `${m.y}%`, "--mz": m.zoom }) as CSSProperties;

export const cropVars = (campaign?: Partial<Campaign>) => cropVarsOf(desktopCrop(campaign), mobileCrop(campaign));

export const sameCrop = (a: Crop, b: Crop) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;
