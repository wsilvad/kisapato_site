"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { useCategories } from "./useCategories";
import { useSegments } from "./useSegments";
import { accountLinks } from "@/lib/account-menu";
import { useFavorites } from "@/lib/favorites";
import { useSession } from "@/lib/session";
import type { SiteSettings } from "@/types/product";

/** Item do menu que abre o público (Feminino, Masculino, Infantil) em sanfona; links fora da vitrine são comuns. */
function NavGroup({ label, url, highlight, onNavigate }: { label: string; url: string; highlight: boolean; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const { entries, total, ready } = useSegments(url, open);
  return (
    <li>
      <button type="button" className={`mm-row${highlight ? " is-highlight" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d={open ? "M1 7l5-5 5 5" : "M1 1l5 5 5-5"} /></svg>
      </button>
      {open && (
        <ul className="mm-sub">
          <li><Link href={url} onClick={onNavigate}>Ver tudo {total > 0 && <small>{total}</small>}</Link></li>
          {entries.map((e) => (
            <li key={e.key}><Link href={e.href} onClick={onNavigate}>{e.label} <small>{e.count}</small></Link></li>
          ))}
          {!ready && <li className="mm-note">Carregando…</li>}
        </ul>
      )}
    </li>
  );
}

/** Menu do celular: painel que desliza da esquerda com o menu principal, as categorias, a conta e as redes sociais. */
export function MobileMenu({ open, onClose, nav, social, pages }: { open: boolean; onClose: () => void; nav: SiteSettings["nav"]; social: SiteSettings["social"]; pages: SiteSettings["pages"] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();
  const { slugs } = useFavorites();
  const categories = useCategories("", "", "");
  const closeRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  // Trocar de página fecha o menu (menos na primeira renderização).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à troca de rota
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="mm-root" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="mm-overlay" aria-label="Fechar menu" onClick={onClose} tabIndex={-1} />
      <aside className="mm-panel">
        <header className="mm-head">
          <strong>Menu</strong>
          <button ref={closeRef} type="button" className="mm-close" aria-label="Fechar menu" onClick={onClose}>✕</button>
        </header>
        <nav aria-label="Menu principal">
          <ul className="mm-list">
            {nav.map((link) => {
              const target = new URL(link.url, "http://loja");
              return target.pathname === "/produtos" ? (
                <NavGroup key={`${link.label}-${link.url}`} label={link.label} url={link.url} highlight={link.highlight} onNavigate={onClose} />
              ) : (
                <li key={`${link.label}-${link.url}`}><Link href={link.url} className={`mm-row${link.highlight ? " is-highlight" : ""}`} onClick={onClose}>{link.label}</Link></li>
              );
            })}
          </ul>
          {(categories ?? []).length > 0 && (
            <>
              <p className="mm-title">Categorias</p>
              <ul className="mm-list">
                {(categories ?? []).map((c) => <li key={c.id}><Link href={`/produtos?categoria=${c.slug}`} className="mm-row" onClick={onClose}>{c.name}</Link></li>)}
                <li><Link href="/produtos" className="mm-row" onClick={onClose}>Ver tudo</Link></li>
              </ul>
            </>
          )}
          <p className="mm-title">Minha conta</p>
          <ul className="mm-list">
            {user ? (
              <>
                {accountLinks(pages).map((l) => (
                  <li key={l.url}>
                    <Link href={l.url} className="mm-row" onClick={onClose}>
                      {l.label}{l.url === "/favoritos" && slugs.length > 0 && <small>{slugs.length}</small>}
                    </Link>
                  </li>
                ))}
                <li><button type="button" className="mm-row" onClick={() => { onClose(); signOut(); router.push("/"); }}>Sair</button></li>
              </>
            ) : (
              <>
                <li><Link href="/auth" className="mm-row" onClick={onClose}>Entrar ou cadastrar-se</Link></li>
                <li><Link href="/favoritos" className="mm-row" onClick={onClose}>Favoritos{slugs.length > 0 && <small>{slugs.length}</small>}</Link></li>
              </>
            )}
          </ul>
        </nav>
        <SocialLinks social={social} className="mm-social" />
      </aside>
    </div>
  );
}
