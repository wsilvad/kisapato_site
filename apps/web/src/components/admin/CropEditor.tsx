"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { assetUrl } from "@/lib/api";
import { CENTERED, cropStyle, type Crop } from "@/lib/crop";

export interface CropFrame {
  label: string;
  /** Proporção real da área da foto nessa tela (largura × altura em px). */
  width: number;
  height: number;
}

interface Props {
  title: string;
  hint: string;
  src: string | null | undefined;
  value: Crop;
  onChange: (crop: Crop) => void;
  frames: CropFrame[];
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));

/**
 * Parte da foto (em frações da largura/altura) que aparece numa tela com `object-fit: cover` + zoom:
 * a foto preenche a área, sobra corte no lado maior, e o zoom reduz a janela visível.
 */
function visibleWindow(ratio: number, frame: CropFrame, crop: Crop) {
  const frameRatio = frame.width / frame.height;
  const base = ratio > frameRatio ? { w: frameRatio / ratio, h: 1 } : { w: 1, h: ratio / frameRatio };
  const w = base.w / crop.zoom;
  const h = base.h / crop.zoom;
  // O ponto de foco da foto fica alinhado ao mesmo ponto da tela, então a janela se desloca na proporção dele.
  return { w, h, left: (crop.x / 100) * (1 - w), top: (crop.y / 100) * (1 - h) };
}

/**
 * Botão "Editar enquadramento" que abre um pop-up: arraste a moldura sobre a foto inteira (a parte sombreada
 * não aparece no site) e use o zoom. As prévias usam o mesmo CSS da loja. Só vale ao clicar em Aplicar.
 */
export function CropEditor({ title, hint, src, value, onChange, frames }: Props) {
  const [open, setOpen] = useState(false);
  const url = assetUrl(src);
  if (!url) return null;

  const adjusted = value.x !== CENTERED.x || value.y !== CENTERED.y || value.zoom !== CENTERED.zoom;
  return (
    <div className="crop-trigger span-2">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>Editar enquadramento</button>
      <small>{adjusted ? `${title}: foco ${Math.round(value.x)}% / ${Math.round(value.y)}%, zoom ${Math.round(value.zoom * 100)}%` : `${title}: centralizado`}</small>
      {open && (
        <CropDialog
          title={title}
          hint={hint}
          url={url}
          initial={value}
          frames={frames}
          onCancel={() => setOpen(false)}
          onApply={(crop) => {
            onChange(crop);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CropDialog({ title, hint, url, initial, frames, onCancel, onApply }: { title: string; hint: string; url: string; initial: Crop; frames: CropFrame[]; onCancel: () => void; onApply: (crop: Crop) => void }) {
  const [draft, setDraft] = useState(initial);
  const [frameIndex, setFrameIndex] = useState(Math.min(1, frames.length - 1));
  const [ratio, setRatio] = useState(1.5);
  const surface = useRef<HTMLDivElement>(null);
  const frame = frames[frameIndex]!;
  const win = visibleWindow(ratio, frame, draft);

  // Esc fecha; a página atrás não rola enquanto o pop-up está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel]);

  /** O ponteiro posiciona o centro da moldura; o foco é o valor que faz a janela ficar ali. */
  const pick = (e: React.PointerEvent) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return;
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    // Se a janela ocupa o eixo inteiro (sem corte ali), arrastar não muda nada nele: mantém o foco atual.
    const toFocus = (p: number, size: number, current: number) => (size >= 0.999 ? current : clamp(((p - size / 2) / (1 - size)) * 100));
    setDraft((cur) => ({ ...cur, x: toFocus(px, win.w, cur.x), y: toFocus(py, win.h, cur.y) }));
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal crop-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="crop-head">
          <strong>{title}</strong>
          <button type="button" className="link-btn" onClick={onCancel} aria-label="Fechar">Fechar ✕</button>
        </div>
        <p className="crop-hint">{hint}</p>
        <div className="crop-grid">
          <div className="crop-pane">
            <strong className="crop-label">Foto inteira — arraste a moldura</strong>
            <div
              ref={surface}
              className="crop-source"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pick(e);
              }}
              onPointerMove={(e) => e.buttons === 1 && pick(e)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
              {frames.map((f, i) => {
                if (i === frameIndex) return null;
                const w = visibleWindow(ratio, f, draft);
                return <span key={f.label} className="crop-ghost" style={{ left: `${w.left * 100}%`, top: `${w.top * 100}%`, width: `${w.w * 100}%`, height: `${w.h * 100}%` }} title={f.label} />;
              })}
              <span className="crop-window" style={{ left: `${win.left * 100}%`, top: `${win.top * 100}%`, width: `${win.w * 100}%`, height: `${win.h * 100}%` }}>
                <em>{frame.label}</em>
              </span>
            </div>
            <small className="crop-size">A parte escurecida não aparece no site nesta largura de tela. Linhas tracejadas: as outras larguras.</small>
            <label className="crop-zoom">
              Zoom
              <input type="range" min={1} max={3} step={0.05} value={draft.zoom} onChange={(e) => setDraft({ ...draft, zoom: Number(e.target.value) })} />
              <output>{Math.round(draft.zoom * 100)}%</output>
            </label>
            <button type="button" className="link-btn" onClick={() => setDraft(CENTERED)}>Centralizar e remover zoom</button>
          </div>
          <div className="crop-pane">
            <strong className="crop-label">Como aparece no site</strong>
            {frames.length > 1 && (
              <div className="crop-tabs" role="tablist">
                {frames.map((f, i) => (
                  <button key={f.label} type="button" role="tab" aria-selected={i === frameIndex} className={i === frameIndex ? "is-active" : undefined} onClick={() => setFrameIndex(i)}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <div className="crop-frame" style={{ aspectRatio: `${frame.width} / ${frame.height}`, maxWidth: frame.width < frame.height ? 240 : undefined }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" draggable={false} style={cropStyle(draft)} />
            </div>
            <small className="crop-size">{frame.label} · área da foto {frame.width} × {frame.height} px</small>
          </div>
        </div>
        <div className="crop-actions">
          <button type="button" className="btn btn-solid btn-sm" onClick={() => onApply(draft)}>Aplicar</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
