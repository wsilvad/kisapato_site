"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, Notice, PageHead, formatDateTime } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatInt, formatPrice } from "@/lib/format";
import type { CustomerStat } from "@/types/product";

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerStat[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.admin.customers().then(setItems).catch((e: Error) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((c) => !q || `${c.name ?? ""} ${c.email} ${c.phone ?? ""}`.toLowerCase().includes(q));
  }, [items, query]);

  const buyers = (items ?? []).filter((c) => c.orders > 0);
  const recurring = buyers.filter((c) => c.orders >= 2).length;
  const revenue = buyers.reduce((s, c) => s + c.spent, 0);

  return (
    <>
      <PageHead
        title="Clientes"
        hint="Ordenados por quanto gastaram. Só pedidos pagos, enviados ou entregues contam nas compras e no total gasto."
        action={
          items && (
            <button className="btn btn-outline btn-sm" onClick={() => downloadCsv("clientes.csv", ["Nome", "E-mail", "Telefone", "Compras", "Total gasto", "Ticket médio", "Última compra", "Cadastro"],
              visible.map((c) => [c.name, c.email, c.phone, c.orders, c.spent.toFixed(2), c.avgTicket.toFixed(2), c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "", formatDateTime(c.createdAt)]))}>
              Exportar CSV
            </button>
          )
        }
      />
      <Notice error={error} />
      {items && (
        <div className="kpi-grid">
          <div className="kpi"><span>Clientes cadastrados</span><strong>{formatInt(items.length)}</strong></div>
          <div className="kpi"><span>Já compraram</span><strong>{formatInt(buyers.length)}</strong><small>{items.length > 0 ? `${Math.round((buyers.length / items.length) * 100)}% dos cadastrados` : ""}</small></div>
          <div className="kpi"><span>Recorrentes</span><strong>{formatInt(recurring)}</strong><small>2 ou mais compras</small></div>
          <div className="kpi"><span>Gasto médio por cliente</span><strong>{buyers.length ? formatPrice(revenue / buyers.length) : "—"}</strong></div>
        </div>
      )}
      <div className="toolbar" style={{ marginTop: 24 }}>
        <input type="search" placeholder="Buscar por nome, e-mail ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!items ? (
        !error && <p>Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState>{items.length === 0 ? "Nenhum cliente cadastrado ainda. Eles aparecem aqui quando criarem conta na loja." : "Nenhum cliente encontrado."}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Contato</th><th className="num">Compras</th><th className="num">Total gasto</th><th className="num">Ticket médio</th><th>Última compra</th><th>Cadastro</th></tr></thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name ?? "—"}</strong></td>
                  <td>{c.email}{c.phone && <><br /><small>{c.phone}</small></>}</td>
                  <td className="num">{c.orders}{c.canceled > 0 && <><br /><small>{c.canceled} cancelada(s)</small></>}</td>
                  <td className="num">{formatPrice(c.spent)}</td>
                  <td className="num">{c.orders ? formatPrice(c.avgTicket) : "—"}</td>
                  <td>{c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "—"}</td>
                  <td>{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
