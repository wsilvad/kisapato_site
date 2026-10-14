"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { assetUrl } from "@/lib/api";
import { useCarousel } from "@/lib/use-carousel";

/**
 * (As duas primeiras fotos carregam já, para a 2ª aparecer na hora ao passar o mouse.)
 * Foto do cartão de produto. Com o mouse por cima, a vitrine mostra a 2ª foto (e volta à 1ª ao sair); as setas
 * continuam navegando por todas as fotos, e no celular vale o deslize com o dedo. Cada foto é o link do produto;
 * as setas ficam fora dos links, então trocar de foto nunca abre a página. `children` (selo, favorito) ficam sobre a foto.
 */
export function CardGallery({ images, name, href, children }: { images: string[]; name: string; href: string; children?: React.ReactNode }) {
  const { ref, index, onScroll, goTo, prev, next } = useCarousel(images.length);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const many = images.length > 1;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function onEnter(e: React.PointerEvent) {
    if (!many || e.pointerType !== "mouse") return;
    // Pequena espera: varrer a vitrine com o mouse não deve ficar trocando as fotos de todos os cartões.
    timer.current = setTimeout(() => goTo(1), 140);
  }

  function onLeave(e: React.PointerEvent) {
    if (!many || e.pointerType !== "mouse") return;
    if (timer.current) clearTimeout(timer.current);
    goTo(0);
  }

  return (
    <div className="card-image" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <div className="slides" ref={ref} onScroll={onScroll}>
        {images.map((src, i) => (
          <Link key={src} href={href} className="slide" tabIndex={i === 0 ? undefined : -1} aria-hidden={i === 0 ? undefined : true}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl(src)} alt={i === 0 ? name : ""} loading={i < 2 ? "eager" : "lazy"} draggable={false} />
          </Link>
        ))}
      </div>
      {many && (
        <>
          <button type="button" className="cg-arrow cg-prev" aria-label={`Foto anterior de ${name}`} disabled={index === 0} onClick={prev}>‹</button>
          <button type="button" className="cg-arrow cg-next" aria-label={`Próxima foto de ${name}`} disabled={index === images.length - 1} onClick={next}>›</button>
          <div className="cg-dots" aria-hidden="true">
            {images.map((src, i) => <i key={src} className={i === index ? "is-on" : undefined} />)}
          </div>
        </>
      )}
      {children}
    </div>
  );
}
