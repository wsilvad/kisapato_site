"use client";

import { useRef, useState } from "react";
import { CropEditor, type CropFrame } from "@/components/admin/CropEditor";
import { Notice } from "@/components/admin/kit";
import { api, assetUrl } from "@/lib/api";
import { cropStyle } from "@/lib/crop";
import {
  joinBody,
  mobileCropOf,
  newPhoto,
  photosOfBlock,
  serializeImage,
  splitBody,
  type PagePhoto,
  type PhotoRatio,
  type PhotoSide,
  type PhotoWidth,
} from "@/lib/page-body";

const WIDTHS: [PhotoWidth, string][] = [
  ["total", "Largura total"],
  ["grande", "Grande"],
  ["media", "Média"],
  ["pequena", "Pequena"],
];
const RATIOS: [PhotoRatio, string][] = [
  ["auto", "Automática"],
  ["natural", "Foto inteira (sem cortar)"],
  ["21:9", "Panorâmica (21:9)"],
  ["16:9", "Larga (16:9)"],
  ["3:2", "Clássica (3:2)"],
  ["1:1", "Quadrada (1:1)"],
  ["4:5", "Retrato (4:5)"],
];
const SIDES: [PhotoSide, string][] = [
  ["nenhum", "Sozinha (entre os textos)"],
  ["esquerda", "Na lateral esquerda do texto"],
  ["direita", "Na lateral direita do texto"],
];

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
/** Largura relativa da prévia, para dar ideia do tamanho na página. */
const PREVIEW_WIDTH: Record<PhotoWidth, string> = { total: "100%", grande: "85%", media: "62%", pequena: "40%" };

/** Onde a foto aparece na página: decide o tamanho da área da foto em cada tela (o mesmo cálculo do CSS da loja). */
type Place = { kind: "hero" } | { kind: "figure" } | { kind: "split" } | { kind: "gallery"; cols: number };

const DESKTOPS = [
  { label: "Notebook 1366", width: 1366 },
  { label: "Desktop 1440", width: 1440 },
  { label: "Tela grande 1920", width: 1920 },
];
const PHONES = [
  { label: "Celular 375", width: 375 },
  { label: "Celular grande 430", width: 430 },
];
const SOBRE_CAP: Record<PhotoWidth, number> = { total: Infinity, grande: 1100, media: 760, pequena: 480 };
const PAGE_CAP: Record<PhotoWidth, number> = { total: 1, grande: 1, media: 0.7, pequena: 0.45 };

const ratioOf = (r: PhotoRatio) => {
  if (r === "auto" || r === "natural") return null;
  const [a, b] = r.split(":").map(Number);
  return a! / b!;
};

/**
 * Molduras do editor de enquadramento (largura × altura da foto em cada tela), espelhando o CSS da página:
 * na página “Sobre” as fotos são maiores (topo, foto sozinha em largura total, laterais de 1200 px, grupos de 1280 px);
 * nas outras páginas, o texto tem 820 px. Devolve null quando a foto aparece inteira (sem corte, nada para enquadrar).
 */
function framesFor(photo: PagePhoto, place: Place, sobre: boolean): { desktop: CropFrame[]; mobile: CropFrame[] } | null {
  if (photo.r === "natural") return null;
  const chosen = ratioOf(photo.r);
  if (!sobre && place.kind === "figure" && !chosen) return null; // nas páginas comuns, a foto “automática” aparece inteira
  const make = (screens: { label: string; width: number }[], phone: boolean): CropFrame[] =>
    screens.map(({ label, width: screen }) => {
      const pad = phone ? 20 : 64;
      const content = (max: number) => Math.min(screen - pad * 2, max);
      let width: number;
      let height: number | undefined;
      let maxHeight: number | undefined;
      if (place.kind === "hero") {
        width = Math.min(screen, SOBRE_CAP[photo.w]);
        height = chosen ? width / chosen : Math.min(560, Math.max(260, screen / 2));
      } else if (place.kind === "figure") {
        width = sobre ? Math.min(screen, SOBRE_CAP[photo.w]) : content(820) * (phone ? 1 : PAGE_CAP[photo.w]);
        if (chosen) height = width / chosen;
        else maxHeight = 640;
      } else if (place.kind === "split") {
        width = phone ? content(Infinity) : sobre ? (content(1200) - 64) / 2 : ((content(820) - 28) * 0.9) / 2;
        height = width / (chosen ?? 0.8);
      } else {
        const gap = sobre ? 16 : 12;
        width = phone ? content(Infinity) * 0.78 : (content(sobre ? 1280 : 820) - gap * (place.cols - 1)) / place.cols;
        height = width / (chosen ?? 0.8);
      }
      return { label, width: Math.round(width), height: Math.round(height ?? maxHeight!), maxHeight };
    });
  return { desktop: make(DESKTOPS, false), mobile: make(PHONES, true) };
}

/** Prévia da foto com o corte, o enquadramento e o tamanho escolhidos. */
function Preview({ photo, width, fallbackRatio }: { photo: PagePhoto; width: string; fallbackRatio: string }) {
  const ratio = photo.r === "natural" ? undefined : photo.r === "auto" ? fallbackRatio : photo.r.replace(":", " / ");
  return (
    <div className="page-photo-frame" style={{ width, aspectRatio: ratio }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- prévia da foto enviada */}
      <img src={assetUrl(photo.src)} alt="" style={photo.r === "natural" ? { height: "auto", objectFit: "contain" } : cropStyle(photo.crop)} />
    </div>
  );
}

/**
 * Fotos de uma página institucional: enviar, trocar, remover, mudar de lugar, descrever e escolher o tamanho (largura,
 * proporção do corte e a parte da foto que aparece), pôr a foto na lateral do texto ou montar um grupo de fotos lado a lado.
 * Tudo é gravado no próprio texto da página, nas linhas de foto.
 */
export function PagePhotos({ body, onChange, heroHint }: { body: string; onChange: (body: string) => void; heroHint?: boolean }) {
  const blocks = splitBody(body);
  const entries = blocks.flatMap((text, block) => {
    const photos = photosOfBlock(text);
    return photos && photos.length > 0 ? [{ block, photos }] : [];
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const addOne = useRef<HTMLInputElement>(null);
  const addGroup = useRef<HTMLInputElement>(null);

  const save = (next: string[]) => onChange(joinBody(next));
  /** Regrava as fotos de um bloco; sem fotos, o bloco some. */
  const setPhotos = (block: number, photos: PagePhoto[]) => {
    const next = [...blocks];
    if (photos.length === 0) next.splice(block, 1);
    else next[block] = photos.map(serializeImage).join("\n");
    save(next);
  };
  const patch = (block: number, photos: PagePhoto[], i: number, change: Partial<PagePhoto>) =>
    setPhotos(block, photos.map((p, j) => (j === i ? { ...p, ...change } : p)));
  const move = (block: number, direction: -1 | 1) => {
    const target = block + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[block], next[target]] = [next[target]!, next[block]!];
    save(next);
  };

  async function upload(files: FileList | null, key: string): Promise<string[]> {
    if (!files?.length) return [];
    setBusy(key);
    setError("");
    try {
      return (await api.admin.upload(files)).urls;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      setBusy(null);
    }
  }

  function photoFields(block: number, photos: PagePhoto[], i: number, place: Place) {
    const photo = photos[i]!;
    const inGroup = place.kind === "gallery";
    const frames = framesFor(photo, place, !!heroHint);
    return (
      <div className="page-photo-fields">
        <label>
          Descrição (para quem não vê a imagem)
          <input value={photo.alt} onChange={(e) => patch(block, photos, i, { alt: e.target.value })} placeholder="Ex.: vitrine da loja" />
        </label>
        {!inGroup && (
          <label>
            Posição
            <select value={photo.lado} onChange={(e) => patch(block, photos, i, { lado: e.target.value as PhotoSide })}>
              {SIDES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {!inGroup && photo.lado === "nenhum" && (
          <label>
            Largura
            <select value={photo.w} onChange={(e) => patch(block, photos, i, { w: e.target.value as PhotoWidth })}>
              {WIDTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <label>
          Altura (proporção)
          <select value={photo.r} onChange={(e) => patch(block, photos, i, { r: e.target.value as PhotoRatio })}>
            {RATIOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {frames ? (
          <>
            <CropEditor
              title="Enquadramento no computador"
              hint="Arraste a moldura sobre a foto para escolher a parte que aparece e use o zoom. Se o celular não tiver enquadramento próprio, ele segue este."
              src={photo.src}
              value={photo.crop}
              onChange={(crop) => patch(block, photos, i, { crop })}
              frames={frames.desktop}
            />
            <CropEditor
              title="Enquadramento no celular"
              hint={photo.mobile ? "Enquadramento só para o celular." : "Hoje o celular segue o enquadramento do computador; aqui você escolhe um só para o celular."}
              src={photo.src}
              value={mobileCropOf(photo)}
              onChange={(mobile) => patch(block, photos, i, { mobile })}
              frames={frames.mobile}
            />
          </>
        ) : (
          <small className="field-hint page-photo-note">A foto aparece inteira, sem corte: escolha uma altura (proporção) para poder enquadrar.</small>
        )}
        <div className="page-photo-actions">
          <label className="btn-small page-photo-swap">
            {busy === `swap-${block}-${i}` ? "Enviando…" : "Trocar foto"}
            <input
              type="file"
              accept={ACCEPT}
              hidden
              onChange={async (e) => {
                const [src] = await upload(e.target.files, `swap-${block}-${i}`);
                e.target.value = "";
                if (src) patch(block, photos, i, { src });
              }}
            />
          </label>
          <button type="button" className="link-btn danger" onClick={() => setPhotos(block, photos.filter((_, j) => j !== i))}>
            {inGroup ? "Tirar do grupo" : "Remover"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="span-2 page-photos">
      <div className="page-photos-head">
        <strong>Fotos da página</strong>
        <span className="page-photos-add">
          <button type="button" className="btn-small" disabled={busy !== null} onClick={() => addOne.current?.click()}>
            {busy === "add" ? "Enviando…" : "+ Foto"}
          </button>
          <button type="button" className="btn-small" disabled={busy !== null} onClick={() => addGroup.current?.click()}>
            {busy === "group" ? "Enviando…" : "+ Grupo de fotos lado a lado"}
          </button>
        </span>
        <input
          ref={addOne}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={async (e) => {
            const urls = await upload(e.target.files, "add");
            e.target.value = "";
            if (urls.length) save([...blocks, ...urls.map((src) => serializeImage(newPhoto(src)))]);
          }}
        />
        <input
          ref={addGroup}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={async (e) => {
            const urls = await upload(e.target.files, "group");
            e.target.value = "";
            if (urls.length) save([...blocks, urls.map((src) => serializeImage(newPhoto(src))).join("\n")]);
          }}
        />
      </div>
      <small className="field-hint">
        Fotos novas entram no fim da página: use ↑ ↓ para colocá-las entre os textos. “Na lateral” põe a foto ao lado do texto que vem logo
        depois dela. No grupo, escolha 2 a 4 fotos de uma vez para ficarem lado a lado.
        {heroHint && " Se a página começar com uma foto sozinha, ela vira a foto grande do topo."}
      </small>
      <Notice error={error} />

      {entries.length === 0 && <p className="field-hint">Esta página ainda não tem fotos.</p>}
      {entries.map(({ block, photos }, n) => {
        const group = photos.length > 1;
        const hero = !!heroHint && block === 0 && !group && photos[0]!.lado === "nenhum";
        const place: Place = group ? { kind: "gallery", cols: photos.length } : hero ? { kind: "hero" } : photos[0]!.lado !== "nenhum" ? { kind: "split" } : { kind: "figure" };
        const label = group
          ? `Grupo de ${photos.length} fotos lado a lado`
          : hero
            ? "Foto do topo da página"
            : photos[0]!.lado !== "nenhum"
              ? `Foto na lateral ${photos[0]!.lado} do texto`
              : `Foto ${n + 1}`;
        return (
          <div key={`${block}-${photos.map((p) => p.src).join("|")}`} className="page-photo-card">
            <div className="page-photo-card-head">
              <strong>{label}</strong>
              <span className="move">
                <button type="button" aria-label="Subir" title="Subir na página" disabled={block === 0} onClick={() => move(block, -1)}>↑</button>
                <button type="button" aria-label="Descer" title="Descer na página" disabled={block === blocks.length - 1} onClick={() => move(block, 1)}>↓</button>
              </span>
              {group && photos.length < 4 && (
                <label className="link-btn page-photo-swap">
                  {busy === `more-${block}` ? "Enviando…" : "+ foto neste grupo"}
                  <input
                    type="file"
                    accept={ACCEPT}
                    hidden
                    onChange={async (e) => {
                      const urls = await upload(e.target.files, `more-${block}`);
                      e.target.value = "";
                      if (urls.length) setPhotos(block, [...photos, ...urls.map((src) => newPhoto(src))].slice(0, 4));
                    }}
                  />
                </label>
              )}
            </div>
            {group && (
              <div className="page-photo-group-preview" aria-hidden="true">
                {photos.map((p, i) => <Preview key={i} photo={p} width="100%" fallbackRatio="4 / 5" />)}
              </div>
            )}
            {photos.map((photo, i) => (
              <div key={i} className="page-photo">
                {!group && (
                  <div className="page-photo-preview" aria-hidden="true">
                    <Preview photo={photo} width={photo.lado === "nenhum" ? PREVIEW_WIDTH[photo.w] : "50%"} fallbackRatio={photo.lado === "nenhum" ? "16 / 9" : "4 / 5"} />
                  </div>
                )}
                {group && <small className="page-photo-index">Foto {i + 1}</small>}
                {photoFields(block, photos, i, place)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
