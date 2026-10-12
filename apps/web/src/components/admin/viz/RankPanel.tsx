"use client";

import { useMemo, useState } from "react";
import { formatInt, formatPercent, formatPrice } from "@/lib/format";
import type { DashFilters, Overview, RankRow } from "@/types/product";

type Dim = keyof DashFilters;
type Sort = "revenue" | "profit" | "quantity";

const TABS: { dim: Dim; label: string; pick: (o: Overview) => RankRow[] }[] = [
  { dim: "produto", label: "Produtos", pick: (o) => o.topProducts },
  { dim: "categoria", label: "Categorias", pick: (o) => o.byCategory },
  { dim: "classe", label: "Classes", pick: (o) => o.byClass },
  { dim: "marca", label: "Marcas", pick: (o) => o.byBrand },
  { dim: "publico", label: "Públicos", pick: (o) => o.byAudience },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "revenue", label: "Faturamento" },
  { key: "profit", label: "Lucro" },
  { key: "quantity", label: "Unidades" },
];
const ABC_TONE = { A: "ok", B: "warn", C: "muted" } as const;

/**
 * Ranking por produto, categoria, classe, marca ou público. Clicar numa linha recorta o painel inteiro por ela
 * (e clicar de novo desfaz). As barras e os números mostram a métrica escolhida; o resto fica na linha de baixo.
 */
export function RankPanel({ data, filters, onToggle }: { data: Overview; filters: DashFilters; onToggle: (dim: Dim, name: string) => void }) {
  const [dim, setDim] = useState<Dim>("produto");
  const [sort, setSort] = useState<Sort>("revenue");
  const [more, setMore] = useState(false);

  const tab = TABS.find((t) => t.dim === dim)!;
  const rows = tab.pick(data);
  const hasProfit = rows.some((r) => r.profit !== null);
  const key: Sort = sort === "profit" && !hasProfit ? "revenue" : sort;
  const value = (r: RankRow) => (key === "profit" ? (r.profit ?? 0) : key === "quantity" ? r.quantity : r.revenue);

  const sorted = useMemo(() => [...rows].sort((a, b) => value(b) - value(a) || b.revenue - a.revenue), [rows, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = more ? sorted.slice(0, 20) : sorted.slice(0, 7);
  const max = Math.max(...sorted.map(value), 1);
  const color = key === "profit" ? "var(--viz-s3)" : key === "quantity" ? "var(--viz-s2)" : "var(--viz-s1)";
  const fmt = (n: number) => (key === "quantity" ? `${formatInt(n)} un.` : formatPrice(n));

  return (
    <div>
      <div className="trend-bar">
        <div className="seg seg-scroll" role="tablist" aria-label="Agrupar por">
          {TABS.map((t) => (
            <button key={t.dim} type="button" role="tab" aria-selected={dim === t.dim} className={dim === t.dim ? "is-on" : ""} onClick={() => (setDim(t.dim), setMore(false))}>{t.label}</button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Ordenar por">
          {SORTS.map((s) => (
            <button key={s.key} type="button" className={key === s.key ? "is-on" : ""} aria-pressed={key === s.key} disabled={s.key === "profit" && !hasProfit} title={s.key === "profit" && !hasProfit ? "Cadastre o custo dos produtos para ver o lucro" : undefined} onClick={() => setSort(s.key)}>{s.label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty">Sem vendas no período.</p>
      ) : (
        <ol className="rank2">
          {shown.map((r, i) => {
            const on = filters[dim] === r.name;
            return (
              <li key={r.name}>
                <button type="button" className={`rank2-row${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => onToggle(dim, r.name)} title={on ? "Clique para remover o filtro" : "Clique para filtrar o painel por este item"}>
                  <span className="rank2-pos">{i + 1}</span>
                  <span className="rank2-main">
                    <span className="rank2-head">
                      <span className="rank2-name"><span className="rank2-text">{r.name}</span>{"abc" in r && <span className={`tag tag-${ABC_TONE[(r as RankRow & { abc: "A" | "B" | "C" }).abc]}`} title="Curva ABC">{(r as RankRow & { abc: string }).abc}</span>}</span>
                      <strong>{fmt(value(r))}</strong>
                    </span>
                    <span className="rank2-track" aria-hidden="true"><span style={{ width: `${Math.max((value(r) / max) * 100, value(r) > 0 ? 2 : 0)}%`, background: color }} /></span>
                    <span className="rank2-sub">
                      {key !== "revenue" && <>{formatPrice(r.revenue)} · </>}
                      {key !== "quantity" && <>{formatInt(r.quantity)} un. · </>}
                      {formatPercent(r.share, 0)} das vendas
                      {r.margin !== null && <> · margem {formatPercent(r.margin, 0)}</>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {sorted.length > 7 && (
        <button type="button" className="link-btn" onClick={() => setMore((m) => !m)}>{more ? "Mostrar menos" : `Mostrar mais (${Math.min(sorted.length, 20) - 7})`}</button>
      )}
    </div>
  );
}
