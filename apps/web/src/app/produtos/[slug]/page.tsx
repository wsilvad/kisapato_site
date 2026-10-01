import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { api, assetUrl } from "@/lib/api";
import { formatPrice, installmentText } from "@/lib/format";
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

  const image = assetUrl(product.images[0]);

  return (
    <div className="page product">
      <div className="product-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image && <img src={image} alt={product.name} />}
      </div>
      <div className="product-info">
        <span className="card-brand">{product.brand ?? product.category.name}</span>
        <h1 className="page-title">{product.name}</h1>
        <p className="price">{formatPrice(product.price)}</p>
        <p className="card-installments">{installmentText(product.price)}</p>
        {product.description && <p>{product.description}</p>}
        <AddToCart product={product} />
        {product.careInstructions && (
          <p>
            <strong>Cuidados:</strong> {product.careInstructions}
          </p>
        )}
      </div>
    </div>
  );
}
