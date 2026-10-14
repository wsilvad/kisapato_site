"use client";

import { useEffect, useRef } from "react";
import { assetUrl, thumbUrl } from "@/lib/api";
import { useCarousel } from "@/lib/use-carousel";

/** Fotos da página do produto: carrossel grande (deslize, setas e teclado) com miniaturas e contador. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const { ref, index, onScroll, goTo, prev, next } = useCarousel(images.length);
  const thumbs = useRef<HTMLUListElement>(null);
  const many = images.length > 1;

  // Mantém a miniatura da foto atual à vista na fileira (sem rolar a página).
  useEffect(() => {
    const row = thumbs.current;
    const active = row?.children[index] as HTMLElement | undefined;
    if (row && active) row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.clientWidth) / 2, behavior: "smooth" });
  }, [index]);

  function onKeyDown(e: React.KeyboardEvent) {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: images.length - 1 }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    goTo(target);
  }

  if (images.length === 0) {
    return (
      <div className="pdp-main pdp-empty" role="img" aria-label={`Sem foto de ${name}`}>
        <svg width="120" height="64" viewBox="0 0 120 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 52c0-10 4-18 10-22l14-10c4 6 12 10 22 10l8-2 30 14c14 4 24 8 24 14v4H6v-8z" />
          <path d="M6 56h108" />
        </svg>
        <span>Foto do produto</span>
      </div>
    );
  }

  return (
    <div className="pdp-gallery" role="region" aria-roledescription="carrossel" aria-label={`Fotos de ${name}`}>
      <div className="pdp-main">
        <div className="slides" ref={ref} onScroll={onScroll} tabIndex={many ? 0 : undefined} onKeyDown={many ? onKeyDown : undefined} aria-label={many ? "Use as setas do teclado para trocar de foto" : undefined}>
          {images.map((src, i) => (
            <div key={src} className="slide" aria-roledescription="foto" aria-label={`${i + 1} de ${images.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(src)} alt={i === 0 ? name : `${name} — foto ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} draggable={false} />
            </div>
          ))}
        </div>
        {many && (
          <>
            <button type="button" className="cg-arrow cg-prev" aria-label="Foto anterior" disabled={index === 0} onClick={prev}>‹</button>
            <button type="button" className="cg-arrow cg-next" aria-label="Próxima foto" disabled={index === images.length - 1} onClick={next}>›</button>
            <span className="pdp-count" aria-live="polite">{index + 1} / {images.length}</span>
          </>
        )}
      </div>
      {many && (
        <ul className="pdp-thumbs" ref={thumbs}>
          {images.map((src, i) => (
            <li key={src}>
              <button type="button" className={i === index ? "is-on" : undefined} aria-label={`Ver foto ${i + 1}`} aria-current={i === index} onClick={() => goTo(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(src)} alt="" loading="eager" draggable={false} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
