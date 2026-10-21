"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";
import type { Product } from "@/types/product";

/** Registra a visualização da página do produto (uma vez por abertura). Não renderiza nada. */
export function TrackProductView({ product }: { product: Product }) {
  const { id, price } = product;
  const stock = (product.variants ?? []).reduce((sum, v) => sum + v.stock, 0);
  useEffect(() => {
    track("product_view", { product_id: id, price: Number(price), props: { stock } });
  }, [id, price, stock]);
  return null;
}
