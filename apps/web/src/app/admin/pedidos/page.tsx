"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge, EmptyState, Notice, PageHead, formatDateTime, useAdminList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { ALL_STATUSES, ORDER_STATUS, REALIZED_STATUSES } from "@/lib/order-status";
import { downloadCsv } from "@/lib/csv";
import { formatDay, formatPrice } from "@/lib/format";
import type { Order } from "@/types/product";

const STATUS = ORDER_STATUS;
const ORDER_STATUS_KEYS = ALL_STATUSES;
const REALIZED = REALIZED_STATUSES;

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const dayOf = (iso: string) => dayFormat.format(new Date(iso));

export default function OrdersAdmin() {
  const { items, loading, error, setError, reload } = useAdminList<Order>("orders");
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((o) => {
      const day = dayOf(o.createdAt);
      return (
        (filter === "all" || o.status === filter) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!q || `${o.id} ${o.profile?.name ?? ""} ${o.profile?.email ?? ""}`.toLowerCase().includes(q))
      );
    });
  }, [items, filter, query, from, to]);

  const realized = visible.filter((o) => REALIZED.includes(o.status));
  const pending = visible.filter((o) => o.status === "PENDING");
  const sum = (list: Order[]) => list.reduce((s, o) => s + Number(o.total), 0);

  async function setStatus(order: Order, status: Order["status"]) {
    if (status === "CANCELED" && !window.confirm("Cancelar este pedido? Os itens voltam ao estoque e um pedido cancelado não pode ser reaberto.")) return;
    try {
      await api.admin.setOrderStatus(order.id, status);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageHead
        title="Vendas"
        hint="Todos os pedidos da loja. Cancelar um pedido devolve os itens ao estoque."
        action={
          items.length > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                downloadCsv("vendas.csv", ["Pedido", "Data", "Cliente", "E-mail", "Situação", "Total", "Itens"],
                  visible.map((o) => [o.id.slice(0, 8), formatDateTime(o.createdAt), o.profile?.name, o.profile?.email, STATUS[o.status].label, Number(o.total).toFixed(2),
                    o.items.map((i) => `${i.quantity}x ${i.variant.product.name} (${i.variant.color}, ${i.variant.size})`).join(" | ")]))
              }
            >
              Exportar CSV
            </button>
          )
        }
      />
      <Notice error={error} />

      <div className="kpi-grid">
        <div className="kpi"><span>Faturamento</span><strong>{formatPrice(sum(realized))}</strong><small>{realized.length} venda(s) paga(s), enviada(s) ou entregue(s)</small></div>
        <div className="kpi"><span>A receber</span><strong>{formatPrice(sum(pending))}</strong><small>{pending.length} em processamento</small></div>
        <div className="kpi"><span>Pedidos listados</span><strong>{visible.length}</strong><small>de {items.length} no total</small></div>
      </div>

      <div className="toolbar" style={{ marginTop: 24 }}>
        <input type="search" placeholder="Buscar por nº do pedido, nome ou e-mail" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrar por situação">
          <option value="all">Todas as situações</option>
          {ORDER_STATUS_KEYS.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <span className="period">
          <input type="date" aria-label="De" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <span>até</span>
          <input type="date" aria-label="Até" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && <button type="button" className="link-btn" onClick={() => (setFrom(""), setTo(""))}>Limpar datas</button>}
        </span>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState>{items.length === 0 ? "Nenhum pedido ainda. As vendas da loja aparecem aqui." : "Nenhum pedido com esses filtros."}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th className="num">Total</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {visible.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td><strong>#{o.id.slice(0, 8)}</strong></td>
                    <td>{o.profile?.name ?? o.profile?.email}<br /><small>{o.profile?.email}</small></td>
                    <td>{formatDateTime(o.createdAt)}</td>
                    <td className="num">{formatPrice(o.total)}</td>
                    <td>
                      {o.status === "CANCELED" ? (
                        <Badge tone="off">Cancelado</Badge>
                      ) : (
                        <select value={o.status} aria-label={`Situação do pedido ${o.id.slice(0, 8)}`} onChange={(e) => setStatus(o, e.target.value as Order["status"])}>
                          {ORDER_STATUS_KEYS.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="row-actions"><button type="button" className="link-btn" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? "Fechar" : "Detalhes"}</button></td>
                  </tr>
                  {open === o.id && (
                    <tr className="order-detail">
                      <td colSpan={6}>
                        <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge> <small>Feito em {formatDay(dayOf(o.createdAt))}</small>
                        <ul>
                          {o.items.map((item) => (
                            <li key={item.id}>
                              {item.quantity}× {item.variant.product.name} — {item.variant.color}, nº {item.variant.size} ({item.variant.sku}) · {formatPrice(item.unitPrice)}
                            </li>
                          ))}
                        </ul>
                        {o.shippingAddress && (
                          <p>
                            <strong>Entrega:</strong> {o.shippingAddress.recipient} · {o.shippingAddress.street}, {o.shippingAddress.number}
                            {o.shippingAddress.complement ? ` (${o.shippingAddress.complement})` : ""} · {o.shippingAddress.district} · {o.shippingAddress.city}/{o.shippingAddress.state} · CEP {o.shippingAddress.zip}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
