"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Order } from "@/types/product";

const STATUS: Record<Order["status"], string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

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
      {user.role === "ADMIN" && <p><Link href="/admin">Ir para o painel administrativo</Link></p>}
      <h2>Pedidos</h2>
      {orders.length === 0 ? <p>Você ainda não fez pedidos.</p> : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <strong>#{o.id.slice(0, 8)}</strong> · {new Date(o.createdAt).toLocaleDateString("pt-BR")} · {STATUS[o.status]} · {formatPrice(o.total)}
              <ul>{o.items.map((i) => <li key={i.id}>{i.quantity}× {i.variant.product.name} ({i.variant.color}, {i.variant.size})</li>)}</ul>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-outline" onClick={() => { signOut(); router.push("/"); }}>Sair</button>
    </div>
  );
}
