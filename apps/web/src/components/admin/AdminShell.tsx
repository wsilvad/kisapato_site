"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const ADMIN_MENU: { href: string; label: string; group?: string }[] = [
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

/** Cabeçalho e menu lateral do painel. Sem relação com o cabeçalho da loja (menu de produtos, busca, sacola). */
export function AdminShell({ userName, onSignOut, children }: { userName: string; onSignOut: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <AdminHeader userName={userName} onSignOut={onSignOut} />
      <div className="admin-shell">
        <aside className="admin-side">
          <nav aria-label="Administração">
            {ADMIN_MENU.map((item, index) => {
              const showGroup = item.group && item.group !== ADMIN_MENU[index - 1]?.group;
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
        </aside>
        <section className="admin-main">{children}</section>
      </div>
    </>
  );
}
