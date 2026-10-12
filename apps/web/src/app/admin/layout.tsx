"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

const MENU: { href: string; label: string; group?: string }[] = [
  { href: "/admin", label: "Resumo" },
  { href: "/admin/gestao", label: "Indicadores", group: "Gestão" },
  { href: "/admin/expedicao", label: "Expedição", group: "Gestão" },
  { href: "/admin/pedidos", label: "Vendas", group: "Gestão" },
  { href: "/admin/estoque", label: "Estoque", group: "Gestão" },
  { href: "/admin/clientes", label: "Clientes", group: "Gestão" },
  { href: "/admin/produtos", label: "Produtos", group: "Catálogo" },
  { href: "/admin/classes", label: "Classes", group: "Catálogo" },
  { href: "/admin/categorias", label: "Categorias", group: "Catálogo" },
  { href: "/admin/marcas", label: "Marcas", group: "Catálogo" },
  { href: "/admin/publicos", label: "Públicos-alvo", group: "Catálogo" },
  { href: "/admin/campanhas", label: "Campanhas (banners)", group: "Vitrine da loja" },
  { href: "/admin/vitrines", label: "Vitrines de produtos", group: "Vitrine da loja" },
  { href: "/admin/conteudo", label: "Textos e menu", group: "Vitrine da loja" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") router.replace("/auth");
  }, [user, loading, router]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="page">
        <p>Carregando…</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <strong className="admin-brand">Painel Ki Sapato</strong>
        <nav aria-label="Administração">
          {MENU.map((item, index) => {
            const showGroup = item.group && item.group !== MENU[index - 1]?.group;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <div key={item.href}>
                {showGroup && <span className="admin-group">{item.group}</span>}
                <Link href={item.href} className={active ? "is-active" : undefined}>
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <Link href="/" className="admin-exit" target="_blank">
          Ver a loja ↗
        </Link>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}
