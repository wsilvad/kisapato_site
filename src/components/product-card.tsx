import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, installmentText, productImage, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart";

export function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  return (
    <article className="group min-w-0">
      <Link to="/produtos/$slug" params={{ slug: product.slug }} className="block overflow-hidden bg-muted">
        <div className="relative aspect-square overflow-hidden">
          <img src={productImage(product)} alt={product.name} width={1024} height={1024} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
          {product.badge && <span className="absolute left-3 top-3 bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-background">{product.badge}</span>}
        </div>
      </Link>
      <div className="pt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{product.category_name ?? product.gender}</p>
        <Link to="/produtos/$slug" params={{ slug: product.slug }} className="mt-1 block font-display text-xl leading-tight hover:underline">{product.name}</Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <strong className="text-sm">{formatPrice(product.price)}</strong>
          {product.compare_at_price && <span className="text-xs text-muted-foreground line-through">{formatPrice(product.compare_at_price)}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{installmentText(product.price)}</p>
        <Button variant="outline" className="mt-4 h-10 w-full rounded-none border-foreground uppercase tracking-[0.12em]" onClick={() => cart.addItem(product)}>
          <ShoppingBag /> Adicionar
        </Button>
      </div>
    </article>
  );
}