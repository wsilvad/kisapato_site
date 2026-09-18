import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import type { Paginated, Product } from "@/types/product";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; busca?: string }>;
}) {
  const { categoria, busca } = await searchParams;

  let result: Paginated<Product> | null = null;
  try {
    result = await api.listProducts({ category: categoria, search: busca });
  } catch {
    // tratado abaixo
  }

  return (
    <>
      <h1>Produtos</h1>
      {!result ? (
        <p>Não foi possível carregar os produtos. Tente novamente em instantes.</p>
      ) : result.items.length === 0 ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="grid">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
