import type { SiteSettings } from "@/types/product";

/** Link para uma página institucional ainda sem texto: fica fora dos menus até a loja escrever a página. */
export function isEmptyPage(url: string, pages: SiteSettings["pages"]) {
  const slug = url.match(/^\/institucional\/([^/?#]+)$/)?.[1];
  return slug !== undefined && !pages.some((p) => p.slug === slug && p.body.trim());
}

/** O que o cliente logado encontra no menu do ícone de perfil (o antigo bloco “Ajuda” do rodapé). */
const ACCOUNT_LINKS = [
  { label: "Minha conta", url: "/conta" },
  { label: "Meus pedidos", url: "/conta#pedidos" },
  { label: "Meus favoritos", url: "/favoritos" },
  { label: "Trocas e devoluções", url: "/institucional/trocas-e-devolucoes" },
  { label: "Políticas de entrega", url: "/institucional/politicas-de-entrega" },
] as const;

export function accountLinks(pages: SiteSettings["pages"]) {
  return ACCOUNT_LINKS.filter((l) => !isEmptyPage(l.url, pages));
}
