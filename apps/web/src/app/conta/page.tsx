"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS, safeUrl } from "@/lib/order-status";
import { useSession } from "@/lib/session";
import type { Order } from "@/types/product";

export default function ContaPage() {
  const router = useRouter();
  const { user, loading, signOut } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/auth");
    api.myOrders().then(setOrders).catch(() => setOrders([]));
  }, [user, loading, router]);

  if (!user) return <div className="page"><p>Carregando…</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">Minha conta</h1>
      <p>{user.name} · {user.email}</p>
      <h2 id="pedidos">Pedidos</h2>
      {orders.length === 0 ? <p>Você ainda não fez pedidos.</p> : (
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
      <button type="button" className="btn btn-outline" onClick={() => { signOut(); router.push("/"); }}>Sair</button>
    </div>
  );
}
