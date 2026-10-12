"use client";

import { useId, useMemo, useState } from "react";
import { niceTicks, useWidth } from "@/lib/viz";

export interface TrendPoint {
  /** Rótulo curto no eixo (ex.: "14/10"). */
  label: string;
  /** Título completo no tooltip e na tabela (ex.: "qua, 14/10"). */
  title: string;
  value: number;
  /** Valor do mesmo ponto no período anterior (null = sem comparação). */
  prev: number | null;
  prevTitle?: string;
}

interface Props {
  points: TrendPoint[];
  /** Valor completo (tooltip, tabela). */
  formatValue: (n: number) => string;
  /** Valor curto (rótulos diretos e eixo Y). */
  formatShort: (n: number) => string;
  seriesName: string;
  /** Cor da série atual (a mesma do cartão da métrica, para a cor seguir a entidade). */
  color?: string;
  compare: boolean;
  ariaLabel: string;
  emptyText: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Linha/área de uma métrica ao longo do tempo. Mouse, toque e teclado aproximam o ponto mais próximo
 * (crosshair + tooltip). O período anterior entra como linha cinza de apoio, sem competir com o atual.
 * Todo valor também está disponível na visão em tabela.
 */
export function TrendChart({ points, formatValue, formatShort, seriesName, color = "var(--viz-s1)", compare, ariaLabel, emptyText }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const gradient = useId();

  const n = points.length;
  const H = width < 520 ? 220 : 280;
  const padL = 46;
  const padR = 16;
  const padT = 22;
  const axisH = 26;
  const plotH = H - padT - axisH;
  const plotW = Math.max(width - padL - padR, 10);

  const showPrev = compare && points.some((p) => p.prev !== null);
  const maxValue = Math.max(0, ...points.map((p) => p.value), ...(showPrev ? points.map((p) => p.prev ?? 0) : []));
  const { max, ticks } = useMemo(() => niceTicks(maxValue), [maxValue]);
  const empty = maxValue === 0;

  const x = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = n > 1 ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const prevLine = points.reduce((acc, p, i) => (p.prev === null ? acc : `${acc}${acc && points[i - 1]?.prev !== null ? "L" : "M"}${x(i).toFixed(1)},${y(p.prev).toFixed(1)}`), "");

  const peak = empty ? -1 : points.reduce((best, p, i) => (p.value > points[best]!.value ? i : best), 0);
  const labelled = [...new Set([peak, n - 1].filter((i) => i >= 0 && points[i]!.value > 0))];
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));

  function pick(clientX: number, svg: SVGSVGElement) {
    const px = clientX - svg.getBoundingClientRect().left;
    setActive(n <= 1 ? 0 : clamp(Math.round(((px - padL) / plotW) * (n - 1)), 0, n - 1));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const move = (to: number) => (e.preventDefault(), setActive(clamp(to, 0, n - 1)));
    if (e.key === "ArrowRight") move((active ?? -1) + 1);
    else if (e.key === "ArrowLeft") move((active ?? n) - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(n - 1);
    else if (e.key === "Escape") setActive(null);
  }

  const point = active !== null ? points[active] : undefined;
  const delta = point && point.prev ? (point.value - point.prev) / point.prev : null;
  const readout = point ? `${point.title}: ${formatValue(point.value)}${point.prev !== null && showPrev ? `, período anterior ${formatValue(point.prev)}` : ""}` : "";

  return (
    <div className="trend" ref={wrapRef}>
      <div className="trend-bar">
        {showPrev ? (
          <ul className="legend" aria-label="Legenda">
            <li><i className="key" style={{ background: color }} /> {seriesName}</li>
            <li><i className="key" style={{ background: "var(--viz-prev)" }} /> Período anterior</li>
          </ul>
        ) : (
          <span />
        )}
        <button type="button" className="link-btn" onClick={() => setTable((t) => !t)}>{table ? "Ver gráfico" : "Ver como tabela"}</button>
      </div>

      {table ? (
        <div className="table-wrap trend-table">
          <table className="table table-tight">
            <thead><tr><th>Período</th><th className="num">{seriesName}</th>{showPrev && <><th className="num">Período anterior</th><th className="num">Variação</th></>}</tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.title}>
                  <td>{p.title}</td>
                  <td className="num">{formatValue(p.value)}</td>
                  {showPrev && <><td className="num">{p.prev === null ? "—" : formatValue(p.prev)}</td><td className="num">{p.prev ? pct.format((p.value - p.prev) / p.prev) : "—"}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trend-plot" style={{ height: H }}>
          <svg
            width={width}
            height={H}
            viewBox={`0 0 ${width} ${H}`}
            role="img"
            aria-label={ariaLabel}
            tabIndex={0}
            style={{ touchAction: "pan-y" }}
            onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
            onKeyDown={onKeyDown}
            onFocus={() => active === null && setActive(n - 1)}
            onBlur={() => setActive(null)}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.18" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{formatShort(t)}</text>
              </g>
            ))}
            {points.map((p, i) => i % tickEvery === 0 && (
              <text key={p.title} x={clamp(x(i), padL + 12, width - padR - 12)} y={H - 7} textAnchor="middle" className="viz-tick">{p.label}</text>
            ))}

            {!empty && n > 1 && <path d={area} fill={`url(#${gradient})`} />}
            {showPrev && prevLine && <path d={prevLine} fill="none" stroke="var(--viz-prev)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {!empty && <path d={n > 1 ? line : ""} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

            {!empty && labelled.map((i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(points[i]!.value)} r="4.5" fill={color} stroke="var(--viz-surface)" strokeWidth="2" />
                <text x={x(i)} y={y(points[i]!.value) - 11} textAnchor={x(i) > width - 70 ? "end" : x(i) < padL + 40 ? "start" : "middle"} className="viz-label">{formatShort(points[i]!.value)}</text>
              </g>
            ))}

            {point && active !== null && (
              <g pointerEvents="none">
                <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + plotH} stroke="var(--viz-ink-2)" strokeWidth="1" />
                {showPrev && point.prev !== null && <circle cx={x(active)} cy={y(point.prev)} r="4" fill="var(--viz-prev)" stroke="var(--viz-surface)" strokeWidth="2" />}
                <circle cx={x(active)} cy={y(point.value)} r="5" fill={color} stroke="var(--viz-surface)" strokeWidth="2" />
              </g>
            )}
            {/* área de captura maior que o desenho: o ponteiro só precisa estar perto */}
            <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" />
          </svg>

          {empty && <p className="trend-empty">{emptyText}</p>}

          {point && active !== null && (
            <div className="tip" style={{ left: clamp(x(active), 92, width - 92), top: 6 }} role="status">
              <span className="tip-title">{point.title}</span>
              <span className="tip-row"><i className="key" style={{ background: color }} /><strong>{formatValue(point.value)}</strong></span>
              {showPrev && point.prev !== null && (
                <span className="tip-row"><i className="key" style={{ background: "var(--viz-prev)" }} /><span>{formatValue(point.prev)} <small>{point.prevTitle ?? "período anterior"}</small></span></span>
              )}
              {delta !== null && <span className={`tip-delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {pct.format(Math.abs(delta))}</span>}
            </div>
          )}
          <span className="sr-only" aria-live="polite">{readout}</span>
        </div>
      )}
    </div>
  );
}
