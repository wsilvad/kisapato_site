"use client";

import { useMemo, useState } from "react";
import { formatInt, formatPrice } from "@/lib/format";
import { WEEKDAY_SHORT, useWidth } from "@/lib/viz";
import type { HeatCell } from "@/types/product";

/** Rampa sequencial de uma só cor (azul 100 → 700): mais escuro = mais vendas. */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
type Metric = "orders" | "revenue";

const hourRange = (start: number, step: number) => (step === 1 ? `${start}h` : `${start}h–${start + step}h`);

/**
 * Quando a loja vende: dias da semana × hora do dia. Em tela estreita agrupa de 3 em 3 horas, para o toque
 * acertar a célula. Passar o mouse, tocar ou usar as setas atualiza a leitura acima; a tabela traz o mesmo dado.
 */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(600);
  const [metric, setMetric] = useState<Metric>("orders");
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [table, setTable] = useState(false);

  const step = width < 520 ? 3 : 1;
  const cols = 24 / step;

  const { grid, max, best } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array.from({ length: cols }, () => ({ orders: 0, revenue: 0 })));
    for (const cell of cells) {
      const slot = g[cell.weekday]![Math.floor(cell.hour / step)]!;
      slot.orders += cell.orders;
      slot.revenue += cell.revenue;
    }
    let maxValue = 0;
    let top: { r: number; c: number } | null = null;
    g.forEach((row, r) => row.forEach((slot, c) => {
      if (slot[metric] > maxValue) {
        maxValue = slot[metric];
        top = { r, c };
      }
    }));
    return { grid: g, max: maxValue, best: top as { r: number; c: number } | null };
  }, [cells, cols, step, metric]);

  const describe = (pos: { r: number; c: number }) => {
    const slot = grid[pos.r]![pos.c]!;
    return `${WEEKDAY_SHORT[pos.r]}, ${hourRange(pos.c * step, step)}: ${slot.orders === 0 ? "sem vendas" : `${formatInt(slot.orders)} pedido(s) · ${formatPrice(slot.revenue)}`}`;
  };

  function onKeyDown(e: React.KeyboardEvent) {
    const cur = sel ?? best ?? { r: 0, c: 0 };
    const next = { ...cur };
    if (e.key === "ArrowRight") next.c = Math.min(cols - 1, cur.c + 1);
    else if (e.key === "ArrowLeft") next.c = Math.max(0, cur.c - 1);
    else if (e.key === "ArrowDown") next.r = Math.min(6, cur.r + 1);
    else if (e.key === "ArrowUp") next.r = Math.max(0, cur.r - 1);
    else return;
    e.preventDefault();
    setSel(next);
  }

  const color = (value: number) => (value <= 0 || max <= 0 ? "var(--viz-empty)" : RAMP[Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length))]!);
  const focus = sel ?? best;
  const ranked = [...cells].sort((a, b) => b[metric] - a[metric]).slice(0, 8);

  return (
    <div className="heat" ref={wrapRef}>
      <div className="trend-bar">
        <div className="seg" role="group" aria-label="Métrica do mapa de calor">
          <button type="button" className={metric === "orders" ? "is-on" : ""} aria-pressed={metric === "orders"} onClick={() => setMetric("orders")}>Pedidos</button>
          <button type="button" className={metric === "revenue" ? "is-on" : ""} aria-pressed={metric === "revenue"} onClick={() => setMetric("revenue")}>Faturamento</button>
        </div>
        <button type="button" className="link-btn" onClick={() => setTable((t) => !t)}>{table ? "Ver mapa" : "Ver como tabela"}</button>
      </div>

      {table ? (
        <div className="table-wrap">
          <table className="table table-tight">
            <thead><tr><th>Dia e horário</th><th className="num">Pedidos</th><th className="num">Faturamento</th></tr></thead>
            <tbody>
              {ranked.length === 0 ? <tr><td colSpan={3}>Sem vendas no período.</td></tr> : ranked.map((c) => (
                <tr key={`${c.weekday}-${c.hour}`}><td>{WEEKDAY_SHORT[c.weekday]}, {hourRange(c.hour, 1)}</td><td className="num">{c.orders}</td><td className="num">{formatPrice(c.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="heat-readout" aria-live="polite">
            {max === 0 ? "Sem vendas no período." : focus ? <><strong>{sel ? "" : "Melhor horário · "}</strong>{describe(focus)}</> : ""}
          </p>
          <div
            className="heat-grid"
            role="grid"
            aria-label="Vendas por dia da semana e horário. Use as setas para percorrer."
            tabIndex={0}
            style={{ gridTemplateColumns: `34px repeat(${cols}, minmax(0, 1fr))` }}
            onKeyDown={onKeyDown}
            onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}
          >
            <span />
            {Array.from({ length: cols }, (_, c) => (
              <span key={c} className="heat-hour" aria-hidden="true">{(step === 1 ? c % 3 === 0 : true) ? `${c * step}h` : ""}</span>
            ))}
            {grid.map((row, r) => (
              <div key={r} role="row" className="heat-row">
                <span className="heat-day" role="rowheader">{WEEKDAY_SHORT[r]}</span>
                {row.map((slot, c) => (
                  <div
                    key={c}
                    role="gridcell"
                    aria-label={describe({ r, c })}
                    className={`heat-cell${sel?.r === r && sel.c === c ? " is-sel" : ""}`}
                    style={{ background: color(slot[metric]) }}
                    onPointerEnter={() => setSel({ r, c })}
                    onPointerDown={() => setSel({ r, c })}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="heat-scale" aria-hidden="true">
            <span>menos</span>
            <i style={{ background: `linear-gradient(90deg, ${RAMP.join(",")})` }} />
            <span>mais</span>
          </div>
        </>
      )}
    </div>
  );
}
