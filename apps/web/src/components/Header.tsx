"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CategoryLinks } from "@/components/CategoryStrip";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";
import { NavMenu } from "@/components/NavMenu";
import { SearchBox } from "@/components/SearchBox";
import { prefetchSegments } from "@/components/useSegments";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useSession } from "@/lib/session";
import type { SiteSettings } from "@/types/product";

/**
 * Linha do menu: o menu principal (com a escolha do público) e, ao lado, as categorias da seleção atual. A página
 * escolhida fica sublinhada.
 */
function NavRow({ nav }: { nav: SiteSettings["nav"] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const selo = params.get("selo") ?? "";
  const inShop = pathname.startsWith("/produtos");
  const home = pathname === "/";
  // Na página inicial nada fica marcado como "atual" e as categorias não herdam seleção.
  const get = (key: string) => (home ? "" : (params.get(key) ?? ""));
  return (
    <nav className="sh-nav" aria-label="Principal">
      {nav.map((link) => {
        const target = new URL(link.url, "http://loja");
        const active = inShop && target.pathname === "/produtos" && (target.searchParams.get("selo") ?? "") === selo && !params.get("categoria");
        // Links da vitrine abrem a escolha do público; qualquer outro link do menu continua sendo um link comum.
        if (target.pathname === "/produtos") {
          return <NavMenu key={`${link.label}-${link.url}`} label={link.label} url={link.url} className={link.highlight ? "nav-highlight" : undefined} current={active} />;
        }
        return (
          <Link key={`${link.label}-${link.url}`} href={link.url} className={`${link.highlight ? "nav-highlight" : ""}${active ? " is-current" : ""}`.trim() || undefined} aria-current={active ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
      {(inShop || home) && <CategoryLinks selo={get("selo")} faixa={get("faixa")} genero={get("genero")} active={home ? null : get("categoria")} />}
    </nav>
  );
}

const Icon = {
  user: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.500-4 4.500-6 8-6s6.500 2 8 6" />
    </svg>
  ),
  heart: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.500S3 15.200 3 8.900C3 6 5.200 4 7.700 4c1.800 0 3.300.9 4.300 2.500C13 4.900 14.500 4 16.300 4 18.800 4 21 6 21 8.900 21 15.200 12 20.500 12 20.500Z" />
    </svg>
  ),
  bag: (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 8h14l-1 13H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.500-3.500" />
    </svg>
  ),
  menu: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
};

/**
 * Cabeçalho da loja: busca à esquerda, logo no centro e, à direita, favoritos, conta e sacola; embaixo, a barra do
 * menu (com as categorias) de ponta a ponta. Na página inicial fica transparente por cima da foto do banner e vira branco ao rolar. No
 * celular vira ☰ Menu + logo + busca e sacola, com o menu completo num painel lateral.
 */
export function Header({ topbar, nav, social }: Pick<SiteSettings, "topbar" | "nav" | "social">) {
  const { count: cartCount, openDrawer } = useCart();
  const { slugs } = useFavorites();
  const { user } = useSession();
  const pathname = usePathname();
  const overHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // As contagens dos submenus (Feminino, Masculino, Infantil) já chegam com a página, para o menu abrir pronto.
  useEffect(prefetchSegments, []);

  // Na home o cabeçalho fica por cima da foto; depois de rolar um pouco ganha fundo branco.
  useEffect(() => {
    if (!overHero) return;
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [overHero]);
  const transparent = overHero && !scrolled && !searchOpen;

  return (
    <header className={`sh${overHero ? " sh-over" : ""}${transparent ? " is-top" : ""}`}>
      {topbar.length > 0 && (
        <div className="sh-topbar">
          {topbar.map((message, i) => (
            <span key={message}>
              {i > 0 && <i aria-hidden="true">/</i>}
              {message}
            </span>
          ))}
        </div>
      )}

      <div className="sh-main">
        <div className="sh-left">
          <button type="button" className="sh-menu-btn" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            {Icon.menu}
            <span>Menu</span>
          </button>
          <Suspense fallback={<div className="sh-search sh-search-desktop" />}>
            <SearchBox className="sh-search-desktop" />
          </Suspense>
        </div>

        <Link href="/" className="sh-logo" aria-label="Ki Sapato — página inicial">
          <Logo onLight={!transparent} />
        </Link>

        <div className="sh-right">
          <button type="button" className="sh-icon sh-search-toggle" aria-label="Pesquisar" aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}>
            {Icon.search}
          </button>
          <Link href="/favoritos" className="sh-icon sh-fav" aria-label={`Favoritos${slugs.length ? ` (${slugs.length})` : ""}`} title="Favoritos">
            {Icon.heart}
            {slugs.length > 0 && <span className="sh-badge">{slugs.length}</span>}
          </Link>
          <Link href={user ? "/conta" : "/auth"} className="sh-icon sh-account" aria-label={user ? "Minha conta" : "Entrar ou cadastrar-se"} title={user ? `Olá, ${user.name?.split(" ")[0] ?? "cliente"}` : "Entrar ou cadastrar-se"}>
            {Icon.user}
          </Link>
          <button type="button" className="sh-icon" aria-label={`Sacola${cartCount ? ` (${cartCount} itens)` : ""}`} title="Sacola" onClick={openDrawer}>
            {Icon.bag}
            {cartCount > 0 && <span className="sh-badge">{cartCount}</span>}
          </button>
        </div>
      </div>

      <div className="sh-navbar">
        <Suspense fallback={<nav className="sh-nav" aria-label="Principal" />}>
          <NavRow nav={nav} />
        </Suspense>
      </div>

      {searchOpen && (
        <div className="sh-mobile-search">
          <Suspense fallback={null}>
            <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
          </Suspense>
        </div>
      )}

      <MobileMenu open={menuOpen} onClose={closeMenu} nav={nav} social={social} />
    </header>
  );
}
