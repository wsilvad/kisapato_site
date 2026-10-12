"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice, PageHead } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { ORDER_STATUS } from "@/lib/order-status";
import type { AdminStats, Order } from "@/types/product";

const ORDER_LABEL: Record<Order["status"], string> = Object.fromEntries(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])) as Record<Order["status"], string>;

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.stats().then(setStats).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <PageHead title="Resumo" hint="O que está no ar na loja agora e o que precisa da sua atenção." />
      <Notice error={error} />
      {stats && (
        <>
          <div className="stat-grid">
            <Link href="/admin/produtos" className="stat">
              <strong>{stats.products.active}</strong>
              <span>produtos à venda</span>
              {stats.products.inactive > 0 && <small>{stats.products.inactive} desativado(s)</small>}
            </Link>
            <Link href="/admin/produtos" className={`stat${stats.products.lowStock > 0 ? " stat-warn" : ""}`}>
              <strong>{stats.products.lowStock}</strong>
              <span>variações com estoque baixo</span>
              <small>{stats.products.lowStockThreshold} unidades ou menos</small>
            </Link>
            <Link href="/admin/campanhas" className="stat">
              <strong>{stats.campaigns}</strong>
              <span>campanhas no ar</span>
            </Link>
            <Link href="/admin/vitrines" className="stat">
              <strong>{stats.showcases}</strong>
              <span>vitrines ativas</span>
            </Link>
            <Link href="/admin/categorias" className="stat">
              <strong>{stats.categories}</strong>
              <span>categorias</span>
            </Link>
          </div>

          <h2 className="admin-sub">Pedidos</h2>
          <div className="stat-grid">
            {(Object.keys(ORDER_LABEL) as Order["status"][]).map((status) => (
              <Link key={status} href="/admin/pedidos" className={`stat${status === "PAID" && (stats.orders[status] ?? 0) > 0 ? " stat-warn" : ""}`}>
                <strong>{stats.orders[status] ?? 0}</strong>
                <span>{ORDER_LABEL[status]}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
