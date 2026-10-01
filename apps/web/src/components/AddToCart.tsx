"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import type { Product } from "@/types/product";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const variants = product.variants ?? [];
  const colors = [...new Set(variants.map((v) => v.color))];
  const [color, setColor] = useState(colors[0] ?? "");
  const [variantId, setVariantId] = useState("");
  const [added, setAdded] = useState(false);

  const sizes = variants.filter((v) => v.color === color);
  const selected = variants.find((v) => v.id === variantId);

  function handleAdd() {
    if (!selected) return;
    add({
      variantId: selected.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      size: selected.size,
      color: selected.color,
      price: product.price,
      stock: selected.stock,
    });
    setAdded(true);
  }

  if (variants.length === 0) return <p>Produto indisponível no momento.</p>;

  return (
    <div className="buy-box">
      {colors.length > 1 && (
        <div className="option-group">
          <strong>Cor: {color}</strong>
          <div className="options">
            {colors.map((c) => (
              <button key={c} type="button" className={`option${c === color ? " is-active" : ""}`}
                onClick={() => { setColor(c); setVariantId(""); setAdded(false); }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="option-group">
        <strong>Numeração</strong>
        <div className="options">
          {sizes.map((v) => (
            <button key={v.id} type="button" disabled={v.stock === 0}
              className={`option${v.id === variantId ? " is-active" : ""}`}
              onClick={() => { setVariantId(v.id); setAdded(false); }}>
              {v.size}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn btn-solid" disabled={!selected} onClick={handleAdd}>
        {selected ? "Adicionar à sacola" : "Escolha a numeração"}
      </button>
      {added && (
        <p className="form-ok">
          Adicionado! <Link href="/sacola">Ver sacola</Link>
        </p>
      )}
    </div>
  );
}
