"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Cabeçalho do painel, no mesmo padrão visual da loja (barra de aviso, faixa preta com a logo grande e links em
 * maiúsculas), mas sem o menu de produtos, a busca e a sacola. Sem `onSignOut` (tela de login) mostra só a logo.
 */
export function AdminHeader({ userName, onSignOut }: { userName?: string; onSignOut?: () => void }) {
  return (
    <header className="header">
      <div className="topbar">
        <span>Painel administrativo</span>
        {userName && <span>{userName}</span>}
      </div>
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
