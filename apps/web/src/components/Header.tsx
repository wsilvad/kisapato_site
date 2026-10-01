"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";

const NAV_LINKS = [
  { label: "Feminino", href: "/produtos" },
  { label: "Masculino", href: "/produtos" },
  { label: "Infantil", href: "/produtos" },
  { label: "Marcas", href: "/produtos" },
  { label: "Lançamentos", href: "/produtos" },
];

export function Header() {
  const { count: cartCount } = useCart();
  const { user } = useSession();
  return (
    <header className="header">
      <div className="topbar">
        <span>Frete grátis acima de R$ [VALOR]</span>
        <span>Até 6x sem juros</span>
        <span>Retire grátis na loja</span>
      </div>

      <div className="header-main">
        <Link href="/" className="header-logo" aria-label="Ki Sapato — página inicial">
          <Image src="/logo.png" alt="Ki Sapato" width={220} height={275} priority />
        </Link>

        <nav className="nav" aria-label="Principal">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href}>
              {link.label}
            </Link>
          ))}
          <Link href="/produtos" className="nav-highlight">
            Promoções
          </Link>
        </nav>

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
          <Link href="/sacola" className="icon-btn cart-link" aria-label="Sacola">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 8h14l-1 13H6L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
