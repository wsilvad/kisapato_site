"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, assetUrl, thumbUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { isVideoUrl } from "@/lib/media";
import type { Product, Story } from "@/types/product";

/** Quanto tempo fica na tela um story de foto ou GIF (vídeo segue a própria duração). */
const IMAGE_MS = 6000;
const products = new Map<string, Promise<Product | null>>();

/** Produto do link do story (`/produtos/<slug>`), para mostrar foto, nome e preço; outros links ficam sem cartão. */
function useLinkedProduct(linkUrl: string | null) {
  const slug = linkUrl?.match(/^\/produtos\/([^/?#]+)$/)?.[1] ?? null;
  const [product, setProduct] = useState<Product | null>(null);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    if (!products.has(slug)) products.set(slug, api.getProduct(slug).catch(() => null));
    void products.get(slug)!.then((p) => !cancelled && setProduct(p));
    return () => {
      cancelled = true;
      setProduct(null);
    };
  }, [slug]);
  return product;
}

/**
 * Story aberto em destaque, como no Instagram: fundo escurecido, o story grande no centro com as barras de
 * progresso, setas para o anterior e o próximo, pausa, som e fechar. O vídeo abre com som. Clicar no story leva ao
 * produto (ou ao link cadastrado). Esc fecha e as setas do teclado navegam.
 */
export function StoryViewer({ stories, start, onClose }: { stories: Story[]; start: number; onClose: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(start);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const story = stories[index]!;
  const isVideo = isVideoUrl(story.mediaUrl);
  const product = useLinkedProduct(story.linkUrl);

  const go = useCallback(
    (step: 1 | -1) => {
      const next = index + step;
      if (next < 0) return;
      if (next >= stories.length) return onClose();
      setIndex(next);
      setProgress(0);
      setPaused(false);
    },
    [index, stories.length, onClose],
  );

  // Teclado e rolagem da página travada enquanto o story está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  // Vídeo: toca com som; se o navegador não deixar tocar com som (alguns celulares), toca mudo e o botão de som fica à mão.
  useEffect(() => {
    const el = video.current;
    if (!isVideo || !el) return;
    el.muted = muted;
    if (paused) return el.pause();
    el.play().catch(() => {
      el.muted = true;
      setMuted(true);
      void el.play().catch(() => undefined);
    });
  }, [isVideo, paused, muted, index]);

  // Foto ou GIF: a barra anda pelo relógio e o próximo entra sozinho ao fim.
  useEffect(() => {
    if (isVideo || paused) return;
    let frame = 0;
    const startAt = performance.now() - progress * IMAGE_MS;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startAt) / IMAGE_MS);
      setProgress(p);
      if (p >= 1) go(1);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só ao trocar de story ou pausar
  }, [isVideo, paused, index]);

  const openLink = () => {
    if (!story.linkUrl) return setPaused(!paused);
    onClose();
    router.push(story.linkUrl);
  };
  const neighbor = (i: number, side: "prev" | "next") => {
    const s = stories[i];
    if (!s) return null;
    return (
      <button type="button" className={`sv-peek sv-peek-${side}`} aria-label={side === "prev" ? "Story anterior" : "Próximo story"} onClick={() => go(side === "prev" ? -1 : 1)}>
        {isVideoUrl(s.mediaUrl) ? (
          // Tocando (mudo): o Safari não mostra o primeiro quadro de um vídeo parado, e ficaria um quadrado preto.
          <video key={s.id} src={assetUrl(s.mediaUrl)} autoPlay muted loop playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(s.mediaUrl)} alt="" />
        )}
      </button>
    );
  };

  return createPortal(
    <div className="sv-root" role="dialog" aria-modal="true" aria-label={story.title ?? "Destaque"}>
      <button type="button" className="sv-backdrop" aria-label="Fechar" tabIndex={-1} onClick={onClose} />
      {neighbor(index - 1, "prev")}
      {neighbor(index + 1, "next")}

      <div className="sv-stage">
        {index > 0 && (
          <button type="button" className="sv-arrow sv-arrow-prev" aria-label="Story anterior" onClick={() => go(-1)}>
            <svg width="14" height="24" viewBox="0 0 14 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 2L3 12l9 10" /></svg>
          </button>
        )}

        <div className="sv-story">
          <div className="sv-bars" aria-hidden="true">
            {stories.map((s, i) => (
              <span key={s.id}><i style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} /></span>
            ))}
          </div>
          <div className="sv-tools">
            <button type="button" aria-label={paused ? "Continuar" : "Pausar"} onClick={() => setPaused(!paused)}>
              {paused ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
              )}
            </button>
            {isVideo && (
              <button type="button" aria-label={muted ? "Ligar o som" : "Desligar o som"} onClick={() => setMuted(!muted)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                  {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12" />}
                </svg>
              </button>
            )}
            <button type="button" aria-label="Fechar" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
            </button>
          </div>

          <button type="button" className="sv-media" aria-label={story.linkUrl ? "Ver o produto" : paused ? "Continuar" : "Pausar"} onClick={openLink}>
            {isVideo ? (
              <video
                key={story.id}
                ref={video}
                src={assetUrl(story.mediaUrl)}
                playsInline
                preload="auto"
                onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
                onEnded={() => go(1)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={story.id} src={assetUrl(story.mediaUrl)} alt={story.title ?? ""} />
            )}
          </button>

          {(product || story.title) && (
            <button type="button" className="sv-card" onClick={openLink} disabled={!story.linkUrl}>
              {product?.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl(product.images[0])} alt="" />
              )}
              <span>
                <strong>{product?.name ?? story.title}</strong>
                {product && <small>{formatPrice(product.price)}</small>}
                {story.linkUrl && <em>Ver produto →</em>}
              </span>
            </button>
          )}
        </div>

        {index < stories.length - 1 && (
          <button type="button" className="sv-arrow sv-arrow-next" aria-label="Próximo story" onClick={() => go(1)}>
            <svg width="14" height="24" viewBox="0 0 14 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 2l9 10-9 10" /></svg>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
