"use client";

import type { Category } from "@/types/product";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCategories } from "./useCategories";

/**
 * Links das categorias na mesma linha do menu principal, mantendo a seleção escolhida (selo, faixa e gênero). Só
 * lista categorias que têm produtos nela; "Ver tudo" fecha a lista. Quando não cabem, só esta parte rola (setas ‹ ›),
 * para o menu principal e os seus menus suspensos continuarem fixos.
 */
export function CategoryLinks({ selo, faixa, genero, active, initial }: { selo: string; faixa: string; genero: string; active: string | null; initial?: Category[] }) {
  const categories = useCategories(selo, faixa, genero, initial);
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

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
  }, [measure, categories]);

  const href = (slug?: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("categoria", slug);
    if (selo) query.set("selo", selo);
    if (faixa) query.set("faixa", faixa);
    if (genero) query.set("genero", genero);
    return query.size ? `/produtos?${query}` : "/produtos";
  };

  if (!categories || categories.length === 0) return null;
  const page = (direction: 1 | -1) => track.current?.scrollBy({ left: direction * track.current.clientWidth * 0.7 });

  return (
    <>
      <span className="sh-sep" aria-hidden="true" />
      <div className={`sh-cats${edge.start ? "" : " has-prev"}${edge.end ? "" : " has-next"}`}>
        {!edge.start && <button type="button" className="sh-cats-btn sh-cats-prev" aria-label="Categorias anteriores" onClick={() => page(-1)}>‹</button>}
        <div className="sh-cats-track" ref={track} onScroll={measure}>
          {categories.map((c) => (
            <Link key={c.id} href={href(c.slug)} className={active === c.slug ? "is-current" : undefined} aria-current={active === c.slug ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
          <Link href={href()} className={active === "" ? "is-current" : undefined} aria-current={active === "" ? "page" : undefined}>
            Ver tudo
          </Link>
        </div>
        {!edge.end && <button type="button" className="sh-cats-btn sh-cats-next" aria-label="Mais categorias" onClick={() => page(1)}>›</button>}
      </div>
    </>
  );
}
