import Link from "next/link";
import { formatPrice, installmentText } from "@/lib/format";
import { CardGallery } from "@/components/CardGallery";
import { FavoriteButton } from "@/components/FavoriteButton";
import { TrackCard } from "@/components/TrackCard";
import { BADGE_LABEL, type Product } from "@/types/product";

export function ProductCard({ product }: { product: Product }) {
  const badge = product.badge ?? (product.compareAtPrice ? "PROMOCAO" : undefined);
  const href = `/produtos/${product.slug}`;

  return (
    <TrackCard productId={product.id} price={Number(product.price)}>
      {product.images.length > 0 ? (
        <CardGallery images={product.images} name={product.name} href={href}>
          <FavoriteButton slug={product.slug} name={product.name} productId={product.id} price={Number(product.price)} />
          {badge && <span className={`badge${badge === "PROMOCAO" ? " badge-sale" : ""}`}>{BADGE_LABEL[badge]}</span>}
        </CardGallery>
      ) : (
        <div className="card-image">
          <Link href={href} className="slide card-empty" aria-label={product.name}>
            <svg width="120" height="64" viewBox="0 0 120 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 52c0-10 4-18 10-22l14-10c4 6 12 10 22 10l8-2 30 14c14 4 24 8 24 14v4H6v-8z" />
              <path d="M6 56h108" />
            </svg>
            <span className="card-photo-label">Foto do produto</span>
          </Link>
          <FavoriteButton slug={product.slug} name={product.name} productId={product.id} price={Number(product.price)} />
          {badge && <span className={`badge${badge === "PROMOCAO" ? " badge-sale" : ""}`}>{BADGE_LABEL[badge]}</span>}
        </div>
      )}

      <Link href={href} className="card-body">
        <span className="card-brand">{product.brand?.name ?? product.category.name}</span>
        <span className="card-name">{product.name}</span>
        <div className="card-prices">
          {product.compareAtPrice ? (
            <>
              <span className="price-old">{formatPrice(product.compareAtPrice)}</span>
              <span className="price price-sale">{formatPrice(product.price)}</span>
            </>
          ) : (
            <span className="price">{product.priceFrom && <small className="price-from">a partir de </small>}{formatPrice(product.price)}</span>
          )}
        </div>
        <span className="card-installments">{installmentText(product.price)}</span>
      </Link>
    </TrackCard>
  );
}
