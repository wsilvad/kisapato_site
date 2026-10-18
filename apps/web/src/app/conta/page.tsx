"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS, safeUrl } from "@/lib/order-status";
import type { Order } from "@/types/product";

export default function ContaPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.myOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <>
      <h2 id="pedidos">Pedidos</h2>
      {orders === null ? <p>Carregando…</p> : orders.length === 0 ? <p>Você ainda não fez pedidos.</p> : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <strong>#{o.id.slice(0, 8)}</strong> · {new Date(o.createdAt).toLocaleDateString("pt-BR")} · {ORDER_STATUS[o.status].label} · {formatPrice(o.total)}
              <ul>{o.items.map((i) => <li key={i.id}>{i.quantity}× {i.variant.product.name} ({i.variant.color}, {i.variant.size})</li>)}</ul>
              {(o.trackingCode || safeUrl(o.trackingUrl)) && (
                <p className="tracking-box">
                  <strong>Rastreio{o.carrier ? ` · ${o.carrier}` : ""}:</strong> {o.trackingCode && <code>{o.trackingCode}</code>}{" "}
                  {safeUrl(o.trackingUrl) && <a href={safeUrl(o.trackingUrl)!} target="_blank" rel="noopener noreferrer">Acompanhar entrega</a>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
