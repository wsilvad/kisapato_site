"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Cabeçalho do painel: faixa preta com a logo e os atalhos "Ver a loja" e "Sair" (sem o menu de produtos, a busca e
 * a sacola da loja). Sem `onSignOut` (tela de login) mostra só a logo.
 */
export function AdminHeader({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="header">
      <div className="header-main">
        <Link href="/admin" className="header-logo" aria-label="Painel Ki Sapato — início">
          <Logo />
        </Link>
        {onSignOut && (
          <nav className="nav" aria-label="Atalhos do painel">
            <Link href="/" target="_blank" rel="noopener noreferrer">Ver a loja ↗</Link>
            <button type="button" className="nav-btn" onClick={onSignOut}>Sair</button>
          </nav>
        )}
      </div>
    </header>
  );
}
