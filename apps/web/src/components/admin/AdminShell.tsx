"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { UploadQueueNotice } from "@/components/admin/UploadQueueNotice";
import { can } from "@/lib/permissions";

export const ADMIN_MENU: { href: string; label: string; group?: string; perm: string }[] = [
  { href: "/admin", label: "Resumo", perm: "resumo" },
  { href: "/admin/gestao", label: "Indicadores", group: "Gestão", perm: "indicadores" },
  { href: "/admin/expedicao", label: "Expedição", group: "Gestão", perm: "expedicao" },
  { href: "/admin/pedidos", label: "Vendas", group: "Gestão", perm: "vendas" },
  { href: "/admin/estoque", label: "Estoque", group: "Gestão", perm: "estoque" },
  { href: "/admin/clientes", label: "Clientes", group: "Gestão", perm: "clientes" },
  { href: "/admin/produtos", label: "Produtos", group: "Catálogo", perm: "produtos" },
  { href: "/admin/classes", label: "Classes", group: "Catálogo", perm: "classes" },
  { href: "/admin/categorias", label: "Categorias", group: "Catálogo", perm: "categorias" },
  { href: "/admin/marcas", label: "Marcas", group: "Catálogo", perm: "marcas" },
  { href: "/admin/publicos", label: "Públicos-alvo", group: "Catálogo", perm: "publicos" },
  { href: "/admin/campanhas", label: "Campanhas (banners)", group: "Vitrine da loja", perm: "campanhas" },
  { href: "/admin/stories", label: "Stories (GIFs)", group: "Vitrine da loja", perm: "stories" },
  { href: "/admin/vitrines", label: "Vitrines de produtos", group: "Vitrine da loja", perm: "vitrines" },
  { href: "/admin/conteudo", label: "Textos e menu", group: "Vitrine da loja", perm: "conteudo" },
  { href: "/admin/paginas", label: "Páginas", group: "Vitrine da loja", perm: "paginas" },
  { href: "/admin/usuarios", label: "Usuários", group: "Administração", perm: "usuarios" },
];

/** Item do menu da página aberta (o caminho mais específico). */
const menuItemFor = (pathname: string) =>
  [...ADMIN_MENU].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)));

/** Cabeçalho e menu lateral do painel. Sem relação com o cabeçalho da loja (menu de produtos, busca, sacola). */
export function AdminShell({ permissions, onSignOut, children }: { permissions: string[]; onSignOut: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const menu = ADMIN_MENU.filter((item) => can(permissions, item.perm));
  const current = menuItemFor(pathname);
  const allowed = !current || can(permissions, current.perm);
  const router = useRouter();
  const first = menu[0]?.href;
  // Quem não tem o Resumo cai direto na primeira área liberada ao entrar no painel.
  useEffect(() => {
    if (pathname === "/admin" && !allowed && first) router.replace(first);
  }, [pathname, allowed, first, router]);
  return (
    <>
      <AdminHeader onSignOut={onSignOut} />
      <UploadQueueNotice />
      <div className="admin-shell">
        <aside className="admin-side">
          <nav aria-label="Administração">
            {menu.map((item, index) => {
              const showGroup = item.group && item.group !== menu[index - 1]?.group;
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
        <section className="admin-main">
          {allowed ? (
            children
          ) : (
            <div className="admin-denied">
              <h1>Sem acesso a esta área</h1>
              <p>Seu usuário não tem permissão para {current?.label ?? "esta área"}. Peça a quem administra o painel para liberar.</p>
              {menu[0] && <Link href={menu[0].href} className="btn btn-solid btn-sm">Ir para {menu[0].label}</Link>}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
