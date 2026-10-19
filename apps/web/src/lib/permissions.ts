/**
 * Áreas do painel que um usuário pode receber (a mesma lista da API: api/src/lib/permissions.ts). "*" = acesso total.
 */
export const FULL_ACCESS = "*";

export const PERMISSION_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Gestão",
    items: [
      { key: "resumo", label: "Resumo" },
      { key: "indicadores", label: "Indicadores" },
      { key: "expedicao", label: "Expedição" },
      { key: "vendas", label: "Vendas" },
      { key: "estoque", label: "Estoque" },
      { key: "clientes", label: "Clientes" },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { key: "produtos", label: "Produtos" },
      { key: "classes", label: "Classes" },
      { key: "categorias", label: "Categorias" },
      { key: "marcas", label: "Marcas" },
      { key: "publicos", label: "Públicos-alvo" },
    ],
  },
  {
    group: "Vitrine da loja",
    items: [
      { key: "campanhas", label: "Campanhas (banners)" },
      { key: "stories", label: "Stories (GIFs)" },
      { key: "vitrines", label: "Vitrines de produtos" },
      { key: "conteudo", label: "Textos e menu" },
      { key: "paginas", label: "Páginas" },
    ],
  },
  { group: "Administração", items: [{ key: "usuarios", label: "Usuários do painel" }] },
];

export const can = (granted: readonly string[] | undefined, key: string) => !!granted && (granted.includes(FULL_ACCESS) || granted.includes(key));

/** Resumo legível das permissões ("Acesso total", "Desativado" ou "Produtos, Estoque e +2"). */
export function permissionSummary(granted: readonly string[]) {
  if (granted.includes(FULL_ACCESS)) return "Acesso total";
  const labels = PERMISSION_GROUPS.flatMap((g) => g.items).filter((i) => granted.includes(i.key)).map((i) => i.label);
  if (labels.length === 0) return "Desativado";
  return labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 3).join(", ")} e +${labels.length - 3}`;
}
