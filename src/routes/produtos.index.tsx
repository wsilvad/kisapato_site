import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-catalog";

type Search = { busca?: string | undefined; categoria?: string | undefined; genero?: string | undefined };
export const Route = createFileRoute("/produtos/")({
  validateSearch: (search: Record<string, unknown>): Search => ({ busca: typeof search.busca === "string" ? search.busca : undefined, categoria: typeof search.categoria === "string" ? search.categoria : undefined, genero: typeof search.genero === "string" ? search.genero : undefined }),
  head: () => ({ meta: [
    { title: "Todos os produtos — Ki Sapato" }, { name: "description", content: "Compre calçados, bolsas e acessórios femininos, masculinos e infantis." },
    { property: "og:title", content: "Coleção Ki Sapato" }, { property: "og:description", content: "Calçados e acessórios selecionados para toda a família." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch(); const { data: products } = useProducts(); const [limit, setLimit] = useState(12); const [order, setOrder] = useState("relevance");
  const filtered = useMemo(() => {
    let result = products.filter((p) => (!search.busca || p.name.toLowerCase().includes(search.busca.toLowerCase())) && (!search.categoria || search.categoria === "promocao" ? search.categoria !== "promocao" || p.badge === "Promoção" : p.category_slug === search.categoria || p.gender.toLowerCase() === search.categoria) && (!search.genero || p.gender.toLowerCase() === search.genero));
    if (order === "lower") result = [...result].sort((a,b) => a.price-b.price); if (order === "higher") result = [...result].sort((a,b) => b.price-a.price);
    return result;
  }, [products, search, order]);
  return <div className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8"><div className="border-b pb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ki Sapato</p><h1 className="mt-2 font-display text-5xl">{search.busca ? `Resultados para “${search.busca}”` : search.categoria ? search.categoria.replaceAll("-", " ") : "Todos os produtos"}</h1><p className="mt-3 text-sm text-muted-foreground">{filtered.length} produtos</p></div><div className="flex items-center justify-between py-5"><Button variant="ghost" className="rounded-none px-0 lg:hidden"><SlidersHorizontal /> Filtros</Button><div className="hidden gap-6 text-xs uppercase tracking-[0.12em] lg:flex"><span>Feminino</span><span>Masculino</span><span>Infantil</span><span>Categoria</span><span>Preço</span></div><select value={order} onChange={(e) => setOrder(e.target.value)} className="border-0 bg-transparent text-xs uppercase outline-none"><option value="relevance">Mais relevantes</option><option value="lower">Menor preço</option><option value="higher">Maior preço</option></select></div>{filtered.length ? <><div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-7">{filtered.slice(0, limit).map((p) => <ProductCard key={p.id} product={p} />)}</div>{limit < filtered.length && <div className="mt-14 text-center"><Button variant="outline" className="h-12 rounded-none px-10" onClick={() => setLimit((v) => v+12)}>Carregar mais</Button></div>}</> : <div className="py-24 text-center"><p className="font-display text-3xl">Nenhum produto encontrado.</p><p className="mt-2 text-muted-foreground">Tente buscar por outro termo.</p></div>}</div>;
}