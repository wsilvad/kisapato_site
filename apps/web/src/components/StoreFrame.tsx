"use client";

import { usePathname } from "next/navigation";

/**
 * Moldura da loja (cabeçalho com menu/busca/sacola e rodapé). Nas telas de administração ela some:
 * o painel tem o seu próprio cabeçalho e menu lateral.
 */
export function StoreFrame({ header, footer, children }: { header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const inAdmin = usePathname()?.startsWith("/admin") ?? false;
  return (
    <>
      {!inAdmin && header}
      <main className={inAdmin ? "main-admin" : undefined}>{children}</main>
      {!inAdmin && footer}
    </>
  );
}
