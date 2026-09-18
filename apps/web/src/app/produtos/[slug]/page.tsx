import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

async function getProduct(slug: string): Promise<Product | null> {
  try {
    return await api.getProduct(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product?.name ?? "Produto" };
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const sizes = [...new Set(product.variants?.map((variant) => variant.size))];

  return (
    <article className="product">
      <div className="product-image" aria-hidden="true" />
      <div>
        <p className="card-category">{product.category.name}</p>
        <h1>{product.name}</h1>
        <p className="card-price">{formatPrice(product.price)}</p>
        {product.description && <p>{product.description}</p>}
        {sizes.length > 0 && (
          <p>
            <strong>Numeração:</strong> {sizes.join(", ")}
          </p>
        )}
      </div>
    </article>
  );
}
