"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CategoryStrip } from "@/components/CategoryStrip";
import { Logo } from "@/components/Logo";
import { NavMenu } from "@/components/NavMenu";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useSession } from "@/lib/session";
import type { SiteSettings } from "@/types/product";

/** Menu principal (todos os produtos, lançamentos, promoções…) com a seleção atual marcada. */
function MainNav({ nav }: { nav: SiteSettings["nav"] }) {
  const pathname = usePathname();
  const selo = useSearchParams().get("selo") ?? "";
  const inShop = pathname.startsWith("/produtos");
  return (
    <nav className="nav" aria-label="Principal">
      {nav.map((link) => {
        const target = new URL(link.url, "http://loja");
        const active = inShop && target.pathname === "/produtos" && (target.searchParams.get("selo") ?? "") === selo;
        // Links da vitrine abrem a escolha do público; qualquer outro link do menu continua sendo um link comum.
        if (target.pathname === "/produtos") {
          return <NavMenu key={`${link.label}-${link.url}`} label={link.label} url={link.url} className={link.highlight ? "nav-highlight" : undefined} current={active} />;
        }
        return (
          <Link
            key={`${link.label}-${link.url}`}
            href={link.url}
            className={`${link.highlight ? "nav-highlight" : ""}${active ? " is-current" : ""}`.trim() || undefined}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Faixa de categorias: aparece na página inicial e nas telas de produtos, abaixo do menu principal. */
function Categories() {
  const pathname = usePathname();
  const params = useSearchParams();
  const home = pathname === "/";
  if (!home && !pathname.startsWith("/produtos")) return null;
  // Na página inicial nada fica marcado como "atual".
  return <CategoryStrip selo={home ? "" : (params.get("selo") ?? "")} audience={home ? "" : (params.get("publico") ?? "")} active={home ? null : (params.get("categoria") ?? "")} />;
}

export function Header({ topbar, nav }: Pick<SiteSettings, "topbar" | "nav">) {
  const { count: cartCount, openDrawer } = useCart();
  const { slugs } = useFavorites();
  const { user } = useSession();
  return (
    <header className="header">
      {topbar.length > 0 && (
        <div className="topbar">
          {topbar.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}

      <div className="header-main">
        <Link href="/" className="header-logo" aria-label="Ki Sapato — página inicial">
          <Logo />
        </Link>

        <Suspense fallback={<nav className="nav" aria-label="Principal" />}>
          <MainNav nav={nav} />
        </Suspense>

        <div className="header-actions">
          <button type="button" className="icon-btn" aria-label="Buscar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <Link href={user ? "/conta" : "/auth"} className="icon-btn" aria-label={user ? "Minha conta" : "Entrar"}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </Link>
          <Link href="/favoritos" className="icon-btn cart-link" aria-label={`Favoritos${slugs.length ? ` (${slugs.length})` : ""}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M12 20.5S3 15.2 3 8.9C3 6 5.2 4 7.7 4c1.8 0 3.3.9 4.3 2.5C13 4.9 14.500 4 16.300 4 18.800 4 21 6 21 8.900 21 15.200 12 20.500 12 20.500Z" />
            </svg>
            {slugs.length > 0 && <span className="cart-badge">{slugs.length}</span>}
          </Link>
          <button type="button" className="icon-btn cart-link" aria-label={`Sacola${cartCount ? ` (${cartCount} itens)` : ""}`} onClick={openDrawer}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 8h14l-1 13H6L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </div>

      <Suspense fallback={null}>
        <Categories />
      </Suspense>
    </header>
  );
}
