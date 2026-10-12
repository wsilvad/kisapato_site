import { formatPercent } from "@/lib/format";

/** Variação percentual contra o período anterior (▲ verde, ▼ vermelho; sem base de comparação não mostra nada). */
export function Delta({ current, previous, invert, short }: { current: number; previous: number; invert?: boolean; short?: boolean }) {
  if (previous === 0) return current > 0 ? <small className="delta delta-up">novo</small> : null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.0005) return <small className="delta">= {short ? "igual" : "igual ao período anterior"}</small>;
  const good = invert ? change < 0 : change > 0;
  return (
    <small className={`delta ${good ? "delta-up" : "delta-down"}`}>
      {change > 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))} {short ? "vs anterior" : "vs. período anterior"}
    </small>
  );
}
