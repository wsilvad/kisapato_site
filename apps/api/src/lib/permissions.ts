/**
 * Áreas do painel que um usuário pode receber. A mesma lista existe no site (web/src/lib/permissions.ts): ao criar uma
 * área nova no painel, acrescente nos dois. "*" = acesso total (inclusive áreas futuras).
 */
export const PERMISSIONS = [
  "resumo",
  "indicadores",
  "expedicao",
  "vendas",
  "estoque",
  "clientes",
  "produtos",
  "classes",
  "categorias",
  "marcas",
  "publicos",
  "campanhas",
  "stories",
  "vitrines",
  "conteudo",
  "paginas",
  "usuarios",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const FULL_ACCESS = "*";

export const hasPermission = (granted: readonly string[] | undefined, ...anyOf: Permission[]) =>
  !!granted && (granted.includes(FULL_ACCESS) || anyOf.some((p) => granted.includes(p)));

/** Lista recebida do painel → só valores conhecidos, sem repetir; "*" sozinho quando houver acesso total. */
export function cleanPermissions(input: readonly string[]): string[] {
  if (input.includes(FULL_ACCESS)) return [FULL_ACCESS];
  return PERMISSIONS.filter((p) => input.includes(p));
}

/** Leitura de cadastros usados como lista de escolha em várias telas (ex.: categorias no formulário de produto). */
const LOOKUPS = new Set(["products", "categories", "classes", "brands", "audiences"]);
const WRITE_PERMISSION: Record<string, Permission> = { products: "produtos", categories: "categorias", classes: "classes", brands: "marcas", audiences: "publicos" };

/**
 * Qual permissão uma chamada de /admin exige (qualquer uma das devolvidas basta). `[]` = qualquer usuário do painel;
 * `null` = rota desconhecida, só com acesso total.
 */
export function requiredPermissions(method: string, path: string): Permission[] | null {
  const [section = "", sub = ""] = path.replace(/^\/+/, "").split("/");
  const read = method === "GET" || method === "HEAD";
  if (section === "uploads") return [];
  if (LOOKUPS.has(section)) return read ? [] : [WRITE_PERMISSION[section]!];
  switch (section) {
    case "stats":
      return ["resumo"];
    case "reports":
      if (sub === "overview") return ["indicadores"];
      if (sub === "inventory") return ["indicadores", "estoque"];
      if (sub === "customers") return ["clientes"];
      return null;
    case "stock":
      return ["estoque"];
    case "orders":
      return ["vendas", "expedicao"];
    case "campaigns":
      return ["campanhas"];
    case "stories":
      return ["stories"];
    case "showcases":
      return ["vitrines"];
    case "settings":
      return ["conteudo"];
    case "pages":
      return ["paginas"];
    case "users":
      return ["usuarios"];
    default:
      return null;
  }
}
