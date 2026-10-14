"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { FacetOption } from "@/types/product";

const cache = new Map<string, { audiences: FacetOption[]; total: number }>();

interface Props {
  label: string;
  /** Destino de "Ver tudo": a própria seleção (ex.: /produtos?selo=lancamento). */
  url: string;
  className?: string;
  current: boolean;
}

/**
 * Item do menu principal que, ao clicar, abre a escolha do público (Feminino, Masculino…). Só lista públicos que
 * têm produtos naquela seleção, com a quantidade; "Ver tudo" leva à seleção inteira. Abre também ao passar o mouse.
 */
export function NavMenu({ label, url, className, current }: Props) {
  const target = new URL(url, "http://loja");
  const selo = target.searchParams.get("selo") ?? "";
  // `hovered` vem do mouse passando por cima; `pinned` do clique. O menu fica aberto se qualquer um dos dois valer.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const [data, setData] = useState(cache.get(selo) ?? null);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // As opções vêm da API na primeira abertura de cada seleção e ficam em cache.
  useEffect(() => {
    if (!open || cache.has(selo)) return;
    let cancelled = false;
    api
      .productFacets({ selo: selo || undefined })
      .then((facets) => {
        const value = { audiences: facets.audiences, total: facets.total };
        cache.set(selo, value);
        if (!cancelled) setData(value);
      })
      .catch(() => !cancelled && setData({ audiences: [], total: 0 }));
    return () => {
      cancelled = true;
    };
  }, [open, selo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onClick = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const audienceHref = (slug: string) => {
    const params = new URLSearchParams(target.search);
    params.set("publico", slug);
    return `/produtos?${params}`;
  };
  function close() {
    clearTimeout(timer.current);
    setHovered(false);
    setPinned(false);
  }
  // Só o mouse abre por hover; no toque vale o clique.
  const hover = (value: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(timer.current);
    if (value) setHovered(true);
    else timer.current = setTimeout(() => setHovered(false), 160);
  };

  return (
    <div className="nav-item" ref={root} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
      <button
        type="button"
        className={`nav-trigger${className ? ` ${className}` : ""}${current ? " is-current" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-current={current ? "page" : undefined}
        onClick={() => (pinned ? close() : setPinned(true))}
      >
        {label}
        <svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <path d={open ? "M1 5l3.500-3.500L8 5" : "M1 1l3.500 3.500L8 1"} />
        </svg>
      </button>
      {open && (
        <>
          <span className="nav-scrim" aria-hidden="true" onClick={close} />
          <div className="nav-menu" role="menu" aria-label={`${label}: escolha o público`}>
            <div className="nav-menu-box">
              <p className="nav-menu-title">{label} · escolha o público</p>
              <Link href={url} role="menuitem" onClick={close}>
                Ver tudo {data && data.total > 0 && <small>{data.total}</small>}
              </Link>
              {(data?.audiences ?? []).map((audience) => (
                <Link key={audience.slug} href={audienceHref(audience.slug)} role="menuitem" onClick={close}>
                  {audience.name} <small>{audience.count}</small>
                </Link>
              ))}
              {!data && <span className="nav-menu-note">Carregando…</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
