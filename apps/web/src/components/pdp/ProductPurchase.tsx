"use client";

import { useMemo, useState } from "react";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductInfo } from "@/components/pdp/ProductInfo";
import type { Product } from "@/types/product";

/**
 * Galeria e compra lado a lado, ligadas pela cor escolhida: ao trocar a cor, a galeria mostra as fotos dela.
 * A página sempre abre na primeira cor do produto.
 */
export function ProductPurchase({ product, details, belowPhoto }: { product: Product; details?: React.ReactNode; belowPhoto?: React.ReactNode }) {
  const colors = useMemo(() => {
    if (product.colors && product.colors.length > 0) return product.colors;
    // Resposta sem cores (produto sem numerações): uma única "cor" com as fotos do produto.
    return [{ name: "", images: product.images }];
  }, [product.colors, product.images]);
  const [color, setColor] = useState(colors[0]!.name);
  const photos = colors.find((c) => c.name === color)?.images ?? product.images;

  return (
    <>
      <div className="product-media">
        {/* key: ao trocar de cor a galeria recomeça na primeira foto */}
        <ProductGallery key={color} images={photos} name={color ? `${product.name} — ${color}` : product.name} />
        {belowPhoto}
      </div>
      <ProductInfo product={product} colors={colors.filter((c) => c.name)} color={color} onColorChange={setColor} cartImage={photos[0]} details={details} />
    </>
  );
}
