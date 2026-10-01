import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products: Product[] = [];
  try {
    products = (await api.listProducts({ page: 1 })).items.slice(0, 4);
  } catch {
    // API indisponível: a home renderiza sem a vitrine
  }

  return (
    <>
      <section className="hero">
        <h1>Calçados para todos os estilos</h1>
        <p>Conforto e qualidade do primeiro passo ao último.</p>
        <Link href="/produtos" className="button">
          Ver produtos
        </Link>
      </section>

      {products.length > 0 && (
        <section>
          <h2>Novidades</h2>
          <div className="grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
