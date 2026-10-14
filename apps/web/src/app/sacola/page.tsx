"use client";

import Link from "next/link";
import { thumbUrl } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

export default function SacolaPage() {
  const { lines, total, setQuantity, remove } = useCart();

  if (lines.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Sacola</h1>
        <p>Sua sacola está vazia.</p>
        <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Sacola</h1>
      <ul className="cart-list">
        {lines.map((l) => (
          <li key={l.variantId} className="cart-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.image ? <img src={thumbUrl(l.image)} alt="" /> : <span className="cart-thumb" />}
            <div className="cart-info">
              <Link href={`/produtos/${l.slug}`}>{l.name}</Link>
              <span>Cor {l.color} · Nº {l.size}</span>
              <button type="button" className="link-btn" onClick={() => remove(l.variantId)}>Remover</button>
            </div>
            <input type="number" min={1} max={l.stock} value={l.quantity} aria-label="Quantidade"
              onChange={(e) => setQuantity(l.variantId, Number(e.target.value) || 1)} />
            <strong>{formatPrice(Number(l.price) * l.quantity)}</strong>
          </li>
        ))}
      </ul>
      <div className="cart-total">
        <span>Total</span>
        <strong>{formatPrice(total)}</strong>
      </div>
      <Link href="/checkout" className="btn btn-solid">Finalizar compra</Link>
    </div>
  );
}
