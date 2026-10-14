import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters, type FilterState } from "@/components/ProductFilters";
import { api } from "@/lib/api";
import type { Facets, Paginated, Product } from "@/types/product";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

type Params = { categoria?: string; publico?: string; marca?: string; cor?: string; numeracao?: string; min?: string; max?: string; ordem?: string; pagina?: string; selo?: string; busca?: string };

const SELO_TITLE: Record<string, string> = { lancamento: "Lançamentos", promocao: "Promoções", destaque: "Destaques" };
const SORTS = ["novidades", "menor-preco", "maior-preco", "nome"];
const PAGE_SIZE = 24;

const list = (value?: string) => (value ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const price = (value?: string) => (value && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined);

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const selo = params.selo && params.selo in SELO_TITLE ? params.selo : undefined;
  const ordem = params.ordem && SORTS.includes(params.ordem) ? params.ordem : "novidades";
  const pagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const state: FilterState = {
    categoria: list(params.categoria),
    publico: list(params.publico),
    marca: list(params.marca),
    cor: list(params.cor),
    numeracao: list(params.numeracao),
    min: price(params.min),
    max: price(params.max),
  };
  const fixed: Record<string, string> = { ...(selo && { selo }), ...(params.busca && { busca: params.busca }) };

  let result: Paginated<Product> | null = null;
  let facets: Facets | null = null;
  try {
    [result, facets] = await Promise.all([
      api.listProducts({
        page: pagina,
        pageSize: PAGE_SIZE,
        category: params.categoria,
        audience: params.publico,
        brand: params.marca,
        color: params.cor,
        size: params.numeracao,
        minPrice: state.min?.toString(),
        maxPrice: state.max?.toString(),
        sort: ordem,
        selo,
        search: params.busca,
      }),
      api.productFacets({ selo, search: params.busca }),
    ]);
  } catch {
    // tratado abaixo
  }

  // Com um único público escolhido, ele entra no título ("Lançamentos · Feminino").
  const audienceName = state.publico.length === 1 ? facets?.audiences.find((a) => a.slug === state.publico[0])?.name : undefined;
  const title = `${(selo && SELO_TITLE[selo]) || "Todos os produtos"}${audienceName ? ` · ${audienceName}` : ""}`;

  const pageHref = (page: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([key, v]) => v && key !== "pagina") as [string, string][]);
    if (page > 1) query.set("pagina", String(page));
    return query.size ? `/produtos?${query}` : "/produtos";
  };

  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>

      <ProductFilters facets={facets} state={state} fixed={fixed} ordem={ordem} total={result?.total ?? 0} />

      {!result ? (
        <p>Não foi possível carregar os produtos. Tente novamente em instantes.</p>
      ) : result.items.length === 0 ? (
        <p className="shop-empty">Nenhum produto encontrado com esses filtros.</p>
      ) : (
        <div className="product-grid">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {result && result.totalPages > 1 && (
        <nav className="pager" aria-label="Páginas">
          {result.page > 1 && <Link href={pageHref(result.page - 1)}>← Anterior</Link>}
          <span>Página {result.page} de {result.totalPages}</span>
          {result.page < result.totalPages && <Link href={pageHref(result.page + 1)}>Próxima →</Link>}
        </nav>
      )}
    </div>
  );
}
