"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSegments } from "./useSegments";

interface Props {
  label: string;
  /** Destino de "Ver tudo": a própria seleção (ex.: /produtos?selo=lancamento). */
  url: string;
  className?: string;
  current: boolean;
}

/**
 * Item do menu principal que abre a escolha do público: Feminino, Masculino e Infantil (Menina e Menino só
 * aparecem dentro da página de Infantil). Só lista o que tem produtos naquela seleção, com a quantidade; "Ver tudo" leva à seleção inteira.
 * Abre ao passar o mouse ou ao clicar.
 */
export function NavMenu({ label, url, className, current }: Props) {
  // `hovered` vem do mouse passando por cima; `pinned` do clique. O menu fica aberto se qualquer um dos dois valer.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const { entries, total, ready } = useSegments(url, open);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        <div className="nav-menu" role="menu" aria-label={`${label}: escolha o público`}>
          <div className="nav-menu-box">
            <p className="nav-menu-title">{label} · escolha o público</p>
            <Link href={url} role="menuitem" onClick={close}>
              Ver tudo {total > 0 && <small>{total}</small>}
            </Link>
            {entries.map((e) => (
              <Link key={e.key} href={e.href} role="menuitem" onClick={close}>
                {e.label} <small>{e.count}</small>
              </Link>
            ))}
            {!ready && <span className="nav-menu-note">Carregando…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
