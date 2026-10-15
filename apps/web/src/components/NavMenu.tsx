"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Facets } from "@/types/product";

type Data = Pick<Facets, "segments" | "total">;
const cache = new Map<string, Data>();
const NONE: Data = { segments: { adulto: { total: 0, feminino: 0, masculino: 0 }, infantil: { total: 0, feminino: 0, masculino: 0 } }, total: 0 };

interface Props {
  label: string;
  /** Destino de "Ver tudo": a própria seleção (ex.: /produtos?selo=lancamento). */
  url: string;
  className?: string;
  current: boolean;
}

/**
 * Item do menu principal que, ao clicar, abre a escolha do público: Feminino, Masculino e Infantil (com Menina e
 * Menino logo abaixo). Só lista o que tem produtos naquela seleção, com a quantidade; unissex conta nos dois
 * gêneros. "Ver tudo" leva à seleção inteira. Abre também ao passar o mouse.
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
        const value = { segments: facets.segments, total: facets.total };
        cache.set(selo, value);
        if (!cancelled) setData(value);
      })
      .catch(() => !cancelled && setData(NONE));
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

  const href = (faixa: string, genero?: string) => {
    const params = new URLSearchParams(target.search);
    params.set("faixa", faixa);
    if (genero) params.set("genero", genero);
    return `/produtos?${params}`;
  };
  const { adulto, infantil } = (data ?? NONE).segments;
  const entries = [
    { key: "f", label: "Feminino", href: href("adulto", "feminino"), count: adulto.feminino },
    { key: "m", label: "Masculino", href: href("adulto", "masculino"), count: adulto.masculino },
    { key: "i", label: "Infantil", href: href("infantil"), count: infantil.total },
    { key: "i-f", label: "Menina", href: href("infantil", "feminino"), count: infantil.feminino, sub: true },
    { key: "i-m", label: "Menino", href: href("infantil", "masculino"), count: infantil.masculino, sub: true },
  ].filter((e) => e.count > 0);
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
              {entries.map((e) => (
                <Link key={e.key} href={e.href} role="menuitem" className={e.sub ? "nav-menu-sub" : undefined} onClick={close}>
                  {e.label} <small>{e.count}</small>
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
