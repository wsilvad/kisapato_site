import Link from "next/link";
import { formatPrice, installmentText } from "@/lib/format";
import type { Product } from "@/types/product";

export function ProductCard({ product }: { product: Product }) {
  const badge = product.badge ?? (product.compareAtPrice ? "Promoção" : undefined);
  const image = product.images[0];

  return (
    <Link href={`/produtos/${product.slug}`} className="card">
      <div className="card-image">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} />
        ) : (
          <>
            <svg width="120" height="64" viewBox="0 0 120 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 52c0-10 4-18 10-22l14-10c4 6 12 10 22 10l8-2 30 14c14 4 24 8 24 14v4H6v-8z" />
              <path d="M6 56h108" />
            </svg>
            <span className="card-photo-label">Foto do produto</span>
          </>
        )}
        {badge && <span className={`badge${badge === "Promoção" ? " badge-sale" : ""}`}>{badge}</span>}
      </div>

      <div className="card-body">
        <span className="card-brand">{product.brand ?? product.category.name}</span>
        <span className="card-name">{product.name}</span>
        <div className="card-prices">
          {product.compareAtPrice ? (
            <>
              <span className="price-old">{formatPrice(product.compareAtPrice)}</span>
              <span className="price price-sale">{formatPrice(product.price)}</span>
            </>
          ) : (
            <span className="price">{formatPrice(product.price)}</span>
          )}
        </div>
        <span className="card-installments">{installmentText(product.price)}</span>
      </div>
    </Link>
  );
}
