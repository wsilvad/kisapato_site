import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import type { Audience, Brand, Category, Paginated, Product, ProductClass } from "@/types/product";

export const metadata: Metadata = { title: "Todos os modelos" };
export const dynamic = "force-dynamic";

type Filters = { classe?: string; categoria?: string; publico?: string; marca?: string; busca?: string };

/** Monta o link de um filtro mantendo os demais; clicar no filtro ativo o remove. */
function href(current: Filters, key: keyof Filters, value: string) {
  const next = { ...current, [key]: current[key] === value ? undefined : value };
  const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
  return query.size ? `/produtos?${query}` : "/produtos";
}

function FilterRow({ label, items, param, filters }: { label: string; items: { slug: string; name: string }[]; param: keyof Filters; filters: Filters }) {
  if (items.length === 0) return null;
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="options">
        {items.map((item) => (
          <Link key={item.slug} href={href(filters, param, item.slug)} className={`option${filters[param] === item.slug ? " is-active" : ""}`}>
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;

  let result: Paginated<Product> | null = null;
  let classes: ProductClass[] = [];
  let categories: Category[] = [];
  let audiences: Audience[] = [];
  let brands: Brand[] = [];
  try {
    [result, classes, categories, audiences, brands] = await Promise.all([
      api.listProducts({ category: filters.categoria, productClass: filters.classe, audience: filters.publico, brand: filters.marca, search: filters.busca }),
      api.listClasses(),
      api.listCategories(),
      api.listAudiences(),
      api.listBrands(),
    ]);
  } catch {
    // tratado abaixo
  }

  // Com uma classe escolhida, só mostra as categorias dela.
  const visibleCategories = filters.classe ? categories.filter((c) => c.productClass?.slug === filters.classe) : categories;

  return (
    <div className="page">
      <h1 className="page-title">Todos os modelos</h1>
      {result && <p className="page-count">{result.total} produtos</p>}

      <div className="filters">
        <FilterRow label="Classe" items={classes} param="classe" filters={filters} />
        <FilterRow label="Categoria" items={visibleCategories} param="categoria" filters={filters} />
        <FilterRow label="Público" items={audiences} param="publico" filters={filters} />
        <FilterRow label="Marca" items={brands} param="marca" filters={filters} />
      </div>

      {!result ? (
        <p>Não foi possível carregar os produtos. Tente novamente em instantes.</p>
      ) : result.items.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="product-grid">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
