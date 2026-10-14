"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { api } from "@/lib/api";
import { useFavorites } from "@/lib/favorites";
import type { Product } from "@/types/product";

export default function FavoritosPage() {
  const { slugs } = useFavorites();
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem favoritos: nada a buscar
      setProducts([]);
      return;
    }
    let cancelled = false;
    api
      .listProducts({ slugs: key, pageSize: 50 })
      .then((r) => {
        // Mantém a ordem em que foram favoritados (os mais novos primeiro).
        const order = new Map(key.split(",").map((s, i) => [s, i]));
        if (!cancelled) setProducts([...r.items].sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)));
      })
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className="page">
      <h1 className="page-title">Favoritos</h1>
      <p className="page-count">Os favoritos ficam salvos neste aparelho.</p>
      {products === null ? (
        <p>Carregando…</p>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <p>Você ainda não favoritou nenhum produto.</p>
          <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
