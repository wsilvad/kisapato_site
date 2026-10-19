import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { AboutProduct } from "@/components/pdp/AboutProduct";
import { ProductPurchase } from "@/components/pdp/ProductPurchase";
import { api } from "@/lib/api";
import { segmentLabel } from "@/lib/segment";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await api.getProduct(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product?.name ?? "Produto" };
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  // "Compre junto" é um complemento: se falhar, a página abre normalmente sem ele.
  const related = await api.relatedProducts(slug).catch(() => [] as Product[]);

  const specs = [
    product.brand?.name && { label: "Marca", value: product.brand.name },
    { label: "Categoria", value: product.category.name },
    { label: "Público", value: segmentLabel(product.ageGroup, product.gender) },
    product.reference && { label: "Referência", value: product.reference },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="page pdp">
      <nav className="crumbs" aria-label="Você está em">
        <Link href="/">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/produtos">Produtos</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/produtos?categoria=${product.category.slug}`}>{product.category.name}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp-grid">
        <ProductPurchase product={product} />
      </div>

      <AboutProduct description={product.description} care={product.careInstructions ?? null} specs={specs} />

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title" className="section-title">Compre junto</h2>
          <p className="related-hint">Peças de outras categorias que combinam com {product.name}.</p>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
