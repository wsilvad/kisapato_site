import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ProductFilters, type FilterState } from "@/components/ProductFilters";
import { api } from "@/lib/api";
import { audienceHref, segmentTitle } from "@/lib/segment";
import type { Facets, Paginated, Product } from "@/types/product";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

type Params = { categoria?: string; faixa?: string; genero?: string; publico?: string; marca?: string; cor?: string; numeracao?: string; min?: string; max?: string; ordem?: string; pagina?: string; selo?: string; busca?: string };

const SELO_TITLE: Record<string, string> = { lancamento: "Lançamentos", promocao: "Promoções", destaque: "Destaques" };
const SORTS = ["relevancia", "novidades", "menor-preco", "maior-preco", "nome"];
const PAGE_SIZE = 24;

const list = (value?: string) => (value ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const price = (value?: string) => (value && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined);

/** Links antigos (`?publico=feminino`) viram a faixa e o gênero que o atalho daquele público guarda. */
async function legacyAudienceUrl(params: Params) {
  const rest = Object.fromEntries(Object.entries(params).filter(([key, v]) => v && key !== "publico" && key !== "pagina")) as Record<string, string>;
  const audience = await api
    .listAudiences()
    .then((audiences) => audiences.find((a) => a.slug === list(params.publico)[0]))
    .catch(() => undefined);
  return audience ? audienceHref(audience, rest) : audienceHref({}, rest);
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  if (params.publico) redirect(await legacyAudienceUrl(params));
  const selo = params.selo && params.selo in SELO_TITLE ? params.selo : undefined;
  // com busca, a ordem padrão é a relevância (o que mais se parece com o que foi digitado primeiro)
  const defaultOrdem = params.busca ? "relevancia" : "novidades";
  const ordem = params.ordem && SORTS.includes(params.ordem) && (params.ordem !== "relevancia" || params.busca) ? params.ordem : defaultOrdem;
  const pagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const state: FilterState = {
    categoria: list(params.categoria),
    faixa: list(params.faixa),
    genero: list(params.genero),
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
        ageGroup: params.faixa,
        gender: params.genero,
        brand: params.marca,
        color: params.cor,
        size: params.numeracao,
        minPrice: state.min?.toString(),
        maxPrice: state.max?.toString(),
        sort: ordem,
        selo,
        search: params.busca,
      }),
      api.productFacets({ selo, search: params.busca, ageGroup: params.faixa }),
    ]);
  } catch {
    // tratado abaixo
  }

  // Com uma faixa e/ou um gênero escolhidos, eles entram no título ("Lançamentos · Infantil · Menina").
  const segment = segmentTitle(state.faixa, state.genero);
  const title = params.busca ? `Resultados para “${params.busca}”` : `${(selo && SELO_TITLE[selo]) || "Todos os produtos"}${segment ? ` · ${segment}` : ""}`;

  const pageHref = (page: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([key, v]) => v && key !== "pagina") as [string, string][]);
    if (page > 1) query.set("pagina", String(page));
    return query.size ? `/produtos?${query}` : "/produtos";
  };

  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      {params.busca && result?.searchMode === "similar" && result.items.length > 0 && (
        <p className="search-similar">Não encontramos exatamente “{params.busca}”. Mostrando os produtos mais parecidos.</p>
      )}

      <ProductFilters facets={facets} state={state} fixed={fixed} ordem={ordem} total={result?.total ?? 0} />

      {!result ? (
        <p>Não foi possível carregar os produtos. Tente novamente em instantes.</p>
      ) : result.items.length === 0 ? (
        <p className="shop-empty">{params.busca ? `Nenhum produto encontrado para “${params.busca}”. Tente outra palavra, a marca, a categoria ou a referência.` : "Nenhum produto encontrado com esses filtros."}</p>
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
