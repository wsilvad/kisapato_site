"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assetUrl } from "@/lib/api";
import { isVideoUrl } from "@/lib/media";
import { StoryViewer } from "./StoryViewer";
import type { Story } from "@/types/product";

/** Vídeo do cartão: toca sozinho, sem som e em repetição; ao sair da tela é pausado e ao voltar retoma (poupa bateria). */
function StoryVideo({ src, label }: { src: string; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    // O último aviso da fila é o estado atual (os anteriores podem estar desatualizados).
    const observer = new IntersectionObserver((entries) => {
      if (entries.at(-1)?.isIntersecting) void el.play().catch(() => undefined);
      else el.pause();
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <video ref={video} src={src} autoPlay muted loop playsInline preload="metadata" aria-label={label} />;
}

/**
 * Fila de cartões verticais em movimento (vídeos e GIFs), no estilo dos stories do Instagram. Rola na horizontal
 * (arrastando no celular, com as setas no computador) e os cartões "encaixam" ao parar. Clicar num cartão abre o
 * story em destaque (StoryViewer), com som; de lá se vai ao produto.
 */
export function StoriesRow({ stories }: { stories: Story[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const [open, setOpen] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = track.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, stories.length]);

  if (stories.length === 0) return null;
  const scrollBy = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.8, behavior: "smooth" });
  const canScroll = !(edge.start && edge.end);

  return (
    <section className="stories" aria-label="Destaques">
      {canScroll && (
        <button type="button" className="stories-arrow stories-prev" aria-label="Anteriores" disabled={edge.start} onClick={() => scrollBy(-1)}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 1L2 8l6 7" /></svg>
        </button>
      )}
      <ul className="stories-track" ref={track} onScroll={measure}>
        {stories.map((story, i) => {
          const card = (
            <>
              {isVideoUrl(story.mediaUrl) ? (
                <StoryVideo src={assetUrl(story.mediaUrl) ?? ""} label={story.title ?? "Destaque"} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrl(story.mediaUrl)} alt={story.title ?? ""} loading="lazy" draggable={false} />
              )}
              {story.title && <span className="story-caption">{story.title}</span>}
            </>
          );
          return (
            <li key={story.id}>
              <button type="button" className="story-card" aria-label={`Abrir ${story.title ?? "destaque"}`} onClick={() => setOpen(i)}>{card}</button>
            </li>
          );
        })}
      </ul>
      {canScroll && (
        <button type="button" className="stories-arrow stories-next" aria-label="Próximos" disabled={edge.end} onClick={() => scrollBy(1)}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 1l6 7-6 7" /></svg>
        </button>
      )}
      {open !== null && <StoryViewer stories={stories} start={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
