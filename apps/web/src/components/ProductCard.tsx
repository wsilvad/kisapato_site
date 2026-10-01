import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/product";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/produtos/${product.slug}`} className="card">
      <div className="card-image" aria-hidden="true" />
      <p className="card-category">{product.category.name}</p>
      <h3 className="card-title">{product.name}</h3>
      <p className="card-price">{formatPrice(product.price)}</p>
    </Link>
  );
}
