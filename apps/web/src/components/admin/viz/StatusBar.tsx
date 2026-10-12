import { formatInt, formatPrice } from "@/lib/format";
import type { Order, Overview } from "@/types/product";

/**
 * Situação dos pedidos. Estados com significado usam a paleta de status (âmbar e vermelho, sempre com ícone e
 * rótulo); os três estágios de uma venda realizada formam uma rampa azul ordenada (aprovado → separação → enviado → entregue).
 */
const STATUS: { key: Order["status"]; label: string; color: string; icon: string }[] = [
  { key: "PENDING", label: "Em processamento", color: "var(--st-warn)", icon: "⚠" },
  { key: "PAID", label: "Pagamento aprovado", color: "#9ec5f4", icon: "" },
  { key: "PICKING", label: "Em separação", color: "#6da7ec", icon: "" },
  { key: "SHIPPED", label: "Pedido enviado", color: "#2a78d6", icon: "" },
  { key: "DELIVERED", label: "Pedido entregue", color: "#184f95", icon: "" },
  { key: "CANCELED", label: "Cancelado", color: "var(--st-crit)", icon: "✕" },
];

export function StatusBar({ byStatus }: { byStatus: Overview["byStatus"] }) {
  const rows = STATUS.map((s) => ({ ...s, orders: byStatus[s.key]?.orders ?? 0, total: byStatus[s.key]?.total ?? 0 })).filter((r) => r.orders > 0);
  const total = rows.reduce((s, r) => s + r.orders, 0);
  if (total === 0) return <p className="empty">Nenhum pedido no período.</p>;
  return (
    <div>
      <div className="stack" role="img" aria-label={`${total} pedidos: ${rows.map((r) => `${r.orders} ${r.label.toLowerCase()}`).join(", ")}`}>
        {rows.map((r) => <span key={r.key} style={{ flexGrow: r.orders, background: r.color }} title={`${r.label}: ${r.orders}`} />)}
      </div>
      <ul className="status-list">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="status-label"><i className="swatch" style={{ background: r.color }} />{r.icon && <span className="status-icon" aria-hidden="true" style={{ color: r.key === "PENDING" ? "#8a5d00" : "var(--st-crit)" }}>{r.icon}</span>}{r.label}</span>
            <span><strong>{formatInt(r.orders)}</strong> <small>{formatPrice(r.total)}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
