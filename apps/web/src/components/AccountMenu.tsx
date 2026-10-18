"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { accountLinks } from "@/lib/account-menu";
import { useSession } from "@/lib/session";
import type { SiteSettings } from "@/types/product";

/**
 * Ícone de perfil do cabeçalho. Ao clicar, abre um menu: sem login, o botão de entrar/cadastrar-se; com login,
 * a conta, os pedidos, os favoritos, as políticas da loja e o “Sair”. Fecha ao clicar fora, com Esc ou ao escolher um link.
 */
export function AccountMenu({ pages, children }: { pages: SiteSettings["pages"]; children: React.ReactNode }) {
  const { user, signOut } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const first = user?.name?.split(" ")[0] ?? "cliente";

  return (
    <div className="sh-account-wrap" ref={root}>
      <button
        type="button"
        className="sh-icon sh-account"
        aria-label={user ? "Minha conta" : "Entrar ou cadastrar-se"}
        aria-expanded={open}
        aria-haspopup="true"
        title={user ? `Olá, ${first}` : "Entrar ou cadastrar-se"}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>

      {open && (
        <div className="account-pop">
          {user ? (
            <>
              <p className="account-pop-hello">Olá, {first}</p>
              {accountLinks(pages).map((l) => (
                <Link key={l.url} href={l.url} onClick={close}>{l.label}</Link>
              ))}
              <button type="button" className="link-btn" onClick={() => { close(); signOut(); router.push("/"); }}>Sair</button>
            </>
          ) : (
            <>
              <p className="account-pop-text">Entre para ver seus pedidos, favoritos e endereços.</p>
              <Link href="/auth" className="btn btn-solid btn-sm" onClick={close}>Entrar ou cadastrar-se</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
