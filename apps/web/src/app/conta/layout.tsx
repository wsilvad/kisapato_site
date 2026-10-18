"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

const TABS = [
  { href: "/conta", label: "Pedidos" },
  { href: "/conta/dados", label: "Meus dados" },
  { href: "/conta/enderecos", label: "Endereços" },
  { href: "/conta/seguranca", label: "Segurança" },
  { href: "/conta/cartoes", label: "Cartões" },
] as const;

/** Moldura de todas as páginas da conta: exige login, mostra o menu da conta e a oferta de verificação em duas etapas. */
export default function ContaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut, updateUser } = useSession();
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/auth?voltar=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (!user) return <div className="page"><p>Carregando…</p></div>;

  async function dismissOffer() {
    setDismissing(true);
    try {
      updateUser(await api.account.dismissTwoFactorOffer());
    } catch {
      setDismissing(false);
    }
  }

  return (
    <div className="page account">
      <h1 className="page-title">Minha conta</h1>
      <p className="account-who">{user.name} · {user.email}</p>
      <nav className="account-nav" aria-label="Minha conta">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={pathname === t.href ? "is-active" : undefined} aria-current={pathname === t.href ? "page" : undefined}>{t.label}</Link>
        ))}
        <button type="button" className="link-btn" onClick={() => { signOut(); router.push("/"); }}>Sair</button>
      </nav>

      {user.twoFactorOffer && pathname !== "/conta/seguranca" && (
        <aside className="offer-banner" aria-label="Proteja sua conta">
          <div>
            <strong>Proteja sua conta com a verificação em duas etapas</strong>
            <p>Além da senha, pedimos um código do seu celular na hora de entrar. É opcional e leva 2 minutos para ativar.</p>
          </div>
          <div className="offer-actions">
            <Link href="/conta/seguranca" className="btn btn-solid btn-sm">Ativar agora</Link>
            <button type="button" className="link-btn" onClick={dismissOffer} disabled={dismissing}>Agora não</button>
          </div>
        </aside>
      )}

      {children}
    </div>
  );
}
