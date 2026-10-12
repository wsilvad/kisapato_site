"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Delta } from "@/components/admin/charts";
import { Notice } from "@/components/admin/kit";
import { Heatmap } from "@/components/admin/viz/Heatmap";
import { RankPanel } from "@/components/admin/viz/RankPanel";
import { Sparkline } from "@/components/admin/viz/Sparkline";
import { StatusBar } from "@/components/admin/viz/StatusBar";
import { TrendChart, type TrendPoint } from "@/components/admin/viz/TrendChart";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatDay, formatInt, formatPercent, formatPrice } from "@/lib/format";
import { WEEKDAY_SHORT, binDaily, compact, dayLabel, metricOf, type MetricKey } from "@/lib/viz";
import type { DashFilters, Inventory, Overview } from "@/types/product";

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const today = () => dayFormat.format(new Date());
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "today", label: "Hoje", range: () => [today(), today()] },
  { key: "7d", label: "7 dias", range: () => [shift(today(), -6), today()] },
  { key: "30d", label: "30 dias", range: () => [shift(today(), -29), today()] },
  { key: "month", label: "Este mês", range: () => [`${today().slice(0, 8)}01`, today()] },
  { key: "90d", label: "90 dias", range: () => [shift(today(), -89), today()] },
  { key: "12m", label: "12 meses", range: () => [shift(today(), -364), today()] },
];

const METRIC: Record<MetricKey, { label: string; money: boolean }> = {
  profit: { label: "Lucro bruto", money: true },
  revenue: { label: "Faturamento", money: true },
  orders: { label: "Pedidos", money: false },
  ticket: { label: "Ticket médio", money: true },
  items: { label: "Itens vendidos", money: false },
};

const FILTER_LABEL: Record<keyof DashFilters, string> = { classe: "Classe", categoria: "Categoria", marca: "Marca", publico: "Público", produto: "Produto" };
const REFRESH_MS = 60_000;

/** Preferências de tela guardadas no navegador; se o armazenamento estiver bloqueado, vale o padrão. */
function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`ks:dash:${key}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a preferência salva depois da hidratação
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* sem armazenamento: usa o padrão */
    }
  }, [key]);
  return [
    value,
    (v) => {
      setValue(v);
      try {
        window.localStorage.setItem(`ks:dash:${key}`, JSON.stringify(v));
      } catch {
        /* ignora */
      }
    },
  ];
}

interface Insight {
  tone: "info" | "warn" | "crit";
  icon: string;
  text: string;
  sub?: string;
  href?: string;
}

export default function IndicatorsPage() {
  const [preset, setPreset] = usePref("preset", "30d");
  const [compare, setCompare] = usePref("compare", true);
  const [auto, setAuto] = usePref("auto", true);
  const [gran, setGran] = usePref<"auto" | "day" | "week">("gran", "auto");
  const [custom, setCustom] = useState<[string, string] | null>(null);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [filters, setFilters] = useState<DashFilters>({});

  const [data, setData] = useState<Overview | null>(null);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [from, to] = useMemo<[string, string]>(() => custom ?? (PRESETS.find((p) => p.key === preset) ?? PRESETS[2]!).range(), [custom, preset]);
  const filtersKey = JSON.stringify(filters);
  const request = useRef(0);

  const load = useCallback(
    async (kind: "change" | "auto" | "manual") => {
      const id = ++request.current;
      if (kind === "manual") setSpinning(true);
      if (kind !== "auto") setLoading(true);
      try {
        const [overview, inventory] = await Promise.all([
          api.admin.overview(from, to, JSON.parse(filtersKey) as DashFilters),
          kind === "auto" ? Promise.resolve(null) : api.admin.inventory(),
        ]);
        if (id !== request.current) return; // uma consulta mais nova já respondeu
        setData(overview);
        if (inventory) setInv(inventory);
        setUpdatedAt(new Date());
        setError("");
      } catch (e) {
        if (id === request.current) setError((e as Error).message);
      } finally {
        if (id === request.current) {
          setLoading(false);
          setSpinning(false);
        }
      }
    },
    [from, to, filtersKey],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca ao trocar período ou filtros
    void load("change");
  }, [load]);

  // Atualização automática: a cada minuto, só com a aba visível.
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load("auto");
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [auto, load]);

  const toggleFilter = (dim: keyof DashFilters, name: string) =>
    setFilters((cur) => {
      const next = { ...cur };
      if (next[dim] === name) delete next[dim];
      else next[dim] = name;
      return next;
    });

  const k = data?.kpis;
  const hasProfit = k?.grossProfit !== null && k?.grossProfit !== undefined;
  const active: MetricKey = metric ?? (hasProfit ? "profit" : "revenue");

  /* ---- série do gráfico principal ---- */
  const size = data ? (gran === "week" || (gran === "auto" && data.period.days > 45) ? 7 : 1) : 1;
  const points = useMemo<TrendPoint[]>(() => {
    if (!data) return [];
    const bins = binDaily(data.daily, size);
    const prev = binDaily(data.previous.daily, size);
    const name = (b: { from: string; to: string }) => (size === 1 ? dayLabel(b.from) : `${dayLabel(b.from, false)} – ${dayLabel(b.to, false)}`);
    return bins.map((b, i) => ({
      label: dayLabel(b.from, false),
      title: name(b),
      value: metricOf(b, active),
      prev: prev[i] ? metricOf(prev[i]!, active) : null,
      prevTitle: prev[i] ? name(prev[i]!) : undefined,
    }));
  }, [data, size, active]);

  const money = METRIC[active].money;
  const formatValue = (n: number) => (money ? formatPrice(n) : formatInt(n));
  const formatShort = (n: number) => (money ? `R$ ${compact(n)}` : compact(n));

  /* ---- cartões ---- */
  const prevProfit = data?.previous.daily.reduce((s, d) => s + d.profit, 0) ?? 0;
  const spark = (m: MetricKey) => (data?.daily ?? []).map((d) => metricOf(d, m));
  const tiles: { key: MetricKey; value: string; cur: number; prev: number }[] =
    data && k
      ? [
          { key: "revenue", value: formatPrice(k.revenue), cur: k.revenue, prev: data.previous.revenue },
          { key: "orders", value: formatInt(k.orders), cur: k.orders, prev: data.previous.orders },
          { key: "ticket", value: formatPrice(k.avgTicket), cur: k.avgTicket, prev: data.previous.avgTicket },
          { key: "items", value: formatInt(k.items), cur: k.items, prev: data.previous.items },
        ]
      : [];

  /* ---- alertas e destaques ---- */
  const insights = useMemo<Insight[]>(() => {
    if (!data || !k) return [];
    const list: Insight[] = [];
    const t = inv?.totals;
    if (t && t.outOfStock > 0) list.push({ tone: "crit", icon: "⚠", text: `${t.outOfStock} variação(ões) esgotada(s)`, sub: "Reponha para não perder vendas", href: "/admin/estoque" });
    if (t && t.lowStock > 0) list.push({ tone: "warn", icon: "⚠", text: `${t.lowStock} com estoque baixo`, sub: `${inv!.lowStockThreshold} unidades ou menos`, href: "/admin/estoque" });
    if (k.pendingOrders > 0) list.push({ tone: "warn", icon: "◷", text: `${k.pendingOrders} pedido(s) em processamento`, sub: `${formatPrice(k.pendingRevenue)} a receber`, href: "/admin/pedidos" });
    if (k.canceledRate > 0.15 && k.orders + k.canceledOrders >= 3) list.push({ tone: "crit", icon: "✕", text: `Cancelamentos em ${formatPercent(k.canceledRate, 0)} dos pedidos`, sub: "Acima de 15%: vale entender o motivo", href: "/admin/pedidos" });
    const negative = data.topProducts.filter((p) => p.margin !== null && p.margin < 0);
    const thin = data.topProducts.filter((p) => p.margin !== null && p.margin >= 0 && p.margin < 0.15);
    if (negative.length > 0) list.push({ tone: "crit", icon: "▼", text: `${negative.length} produto(s) vendendo com prejuízo`, sub: negative.slice(0, 3).map((p) => p.name).join(", "), href: "/admin/produtos" });
    else if (thin.length > 0) list.push({ tone: "warn", icon: "▼", text: `${thin.length} produto(s) com margem abaixo de 15%`, sub: thin.slice(0, 3).map((p) => p.name).join(", "), href: "/admin/produtos" });
    if (t && t.variantsWithoutCost > 0 && (!hasProfit || k.profitCoverage < 0.995)) list.push({ tone: "info", icon: "$", text: `${t.variantsWithoutCost} variação(ões) sem custo cadastrado`, sub: "O lucro só considera produtos com custo", href: "/admin/produtos" });

    const best = [...data.daily].sort((a, b) => b.revenue - a.revenue)[0];
    if (best && best.revenue > 0) list.push({ tone: "info", icon: "★", text: `Melhor dia: ${dayLabel(best.date)}`, sub: `${formatPrice(best.revenue)} em ${best.orders} pedido(s)` });
    const slot = [...data.heatmap].sort((a, b) => b.orders - a.orders)[0];
    if (slot) list.push({ tone: "info", icon: "◷", text: `Pico de vendas: ${WEEKDAY_SHORT[slot.weekday]}, ${slot.hour}h`, sub: `${slot.orders} pedido(s) · ${formatPrice(slot.revenue)}` });
    const top = data.topProducts[0];
    if (top) list.push({ tone: "info", icon: "◆", text: `Campeão de vendas: ${top.name}`, sub: `${formatPrice(top.revenue)} · ${formatPercent(top.share, 0)} do faturamento` });
    if (data.previous.revenue > 0) {
      const change = (k.revenue - data.previous.revenue) / data.previous.revenue;
      list.push({ tone: "info", icon: change >= 0 ? "▲" : "▼", text: `Faturamento ${change >= 0 ? "+" : "−"}${formatPercent(Math.abs(change), 0)} sobre o período anterior`, sub: `${formatPrice(data.previous.revenue)} → ${formatPrice(k.revenue)}` });
    }
    return list;
  }, [data, k, inv, hasProfit]);

  const range = `${formatDay(from)} a ${formatDay(to)}`;
  const filterEntries = Object.entries(filters).filter(([, v]) => v) as [keyof DashFilters, string][];
  const costedRevenue = k ? k.revenue * k.profitCoverage : 0;
  const cost = hasProfit && k ? Math.max(costedRevenue - (k.grossProfit ?? 0), 0) : 0;
  const profitShare = costedRevenue > 0 && k ? Math.max(Math.min((k.grossProfit ?? 0) / costedRevenue, 1), 0) : 0;
  const withCost = inv ? inv.totals.variants - inv.totals.variantsWithoutCost : 0;

  return (
    <div className="dash">
      <div className="dash-bar">
        <div className="dash-row">
          <div className="dash-presets" role="group" aria-label="Período">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className={`pill${!custom && preset === p.key ? " is-on" : ""}`} aria-pressed={!custom && preset === p.key} onClick={() => (setCustom(null), setPreset(p.key))}>{p.label}</button>
            ))}
          </div>
          <button type="button" className={`icon-btn2${spinning ? " spin" : ""}`} aria-label="Atualizar agora" title="Atualizar agora" onClick={() => void load("manual")}>↻</button>
        </div>
      </div>

      <div className="dash-row wrap dash-opts">
        <button type="button" className={`pill${compare ? " is-on" : ""}`} aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "✓ " : ""}Comparar com anterior</button>
        <button type="button" className={`pill${auto ? " is-on" : ""}`} aria-pressed={auto} onClick={() => setAuto(!auto)}>{auto ? "✓ " : ""}Atualizar sozinho</button>
        <details className="dash-dates-box" open={!!custom}>
          <summary className="pill">{formatDay(from)} – {formatDay(to)} ▾</summary>
          <div className="dash-dates">
            <input type="date" aria-label="Data inicial" value={from} max={to} onChange={(e) => e.target.value && setCustom([e.target.value, to])} />
            <span>até</span>
            <input type="date" aria-label="Data final" value={to} min={from} max={today()} onChange={(e) => e.target.value && setCustom([from, e.target.value])} />
          </div>
        </details>
      </div>

      {(filterEntries.length > 0 || updatedAt) && (
        <div className="dash-meta" style={{ marginBottom: 12 }}>
          <div className="chips">
            {filterEntries.map(([dim, value]) => (
              <span key={dim} className="chip">{FILTER_LABEL[dim]}: <strong>{value}</strong><button type="button" aria-label={`Remover filtro ${FILTER_LABEL[dim]}`} onClick={() => toggleFilter(dim, value)}>✕</button></span>
            ))}
            {filterEntries.length > 1 && <button type="button" className="link-btn" onClick={() => setFilters({})}>Limpar filtros</button>}
          </div>
          {updatedAt && <span className={`live${auto ? " on" : ""}`}><i />Atualizado às {updatedAt.toLocaleTimeString("pt-BR")}</span>}
        </div>
      )}

      <Notice error={error} />

      {!data && !error && (
        <>
          <div className="skel" style={{ height: 180 }} />
          <div className="tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 108 }} />)}</div>
          <div className="skel" style={{ height: 320, marginTop: 12 }} />
        </>
      )}

      {data && k && (
        <div className="fade" style={{ opacity: loading ? 0.55 : 1 }}>
          {/* ---- destaque: "estou lucrando?" ---- */}
          {hasProfit ? (
            <section className="dhero profit" aria-label="Lucro bruto">
              <div>
                <span className="dh-eyebrow">Lucro bruto · {range}</span>
                <strong className="dh-value">{formatPrice(k.grossProfit!)}</strong>
                <div className="dh-line">
                  <span className="dh-chip">Margem {formatPercent(k.margin ?? 0)}</span>
                  <Delta current={k.grossProfit!} previous={prevProfit} />
                </div>
                {(k.grossProfit ?? 0) < 0 && <p className="dh-line" style={{ marginTop: 8 }}>⚠ O custo dos produtos vendidos passou da receita neste período.</p>}
              </div>
              <div className="compose" role="img" aria-label={`Do faturamento com custo cadastrado: ${formatPrice(cost)} de custo e ${formatPrice(k.grossProfit!)} de lucro`}>
                <span className="dh-eyebrow">Para onde vai cada R$ 100 vendidos</span>
                <div className="stack">
                  <span style={{ flexGrow: profitShare * 100 || 0.001, background: "#fff" }} />
                  <span style={{ flexGrow: (1 - profitShare) * 100 || 0.001, background: "rgba(255,255,255,0.4)" }} />
                </div>
                <div className="compose-legend">
                  <span><i style={{ background: "#fff" }} />Lucro R$ {(profitShare * 100).toFixed(0)}</span>
                  <span><i style={{ background: "rgba(255,255,255,0.4)" }} />Custo R$ {((1 - profitShare) * 100).toFixed(0)}</span>
                </div>
                <span className="dh-eyebrow">
                  {k.profitCoverage < 0.995 ? `Considera ${formatPercent(k.profitCoverage, 0)} das vendas (o resto não tem custo cadastrado).` : "Considera todas as vendas do período."} Não inclui frete, taxas e despesas fixas.
                </span>
              </div>
            </section>
          ) : (
            <section className="dhero" aria-label="Faturamento">
              <div>
                <span className="dh-eyebrow">Faturamento · {range}</span>
                <strong className="dh-value">{formatPrice(k.revenue)}</strong>
                <div className="dh-line"><Delta current={k.revenue} previous={data.previous.revenue} /></div>
              </div>
              <div className="compose">
                <span className="dh-eyebrow"><strong>Está lucrando?</strong> Cadastre o custo de compra dos produtos para ver lucro e margem aqui.</span>
                {inv && inv.totals.variants > 0 && (
                  <>
                    <div className="cost-meter" role="img" aria-label={`${withCost} de ${inv.totals.variants} variações com custo`}><span style={{ width: `${(withCost / inv.totals.variants) * 100}%` }} /></div>
                    <span className="dh-eyebrow">{withCost} de {inv.totals.variants} variações com custo cadastrado</span>
                  </>
                )}
                <Link href="/admin/produtos" className="dh-cta">Cadastrar custos</Link>
              </div>
            </section>
          )}

          {/* ---- cartões: clique para trocar a métrica do gráfico ---- */}
          <div className="tiles">
            {hasProfit && (
              <button type="button" className={`tile${active === "profit" ? " is-on" : ""}`} aria-pressed={active === "profit"} onClick={() => setMetric("profit")}>
                <span className="tile-label">Lucro bruto</span>
                <strong className="tile-value">{formatPrice(k.grossProfit!)}</strong>
                <Delta current={k.grossProfit!} previous={prevProfit} short />
                <Sparkline values={spark("profit")} color="var(--viz-s3)" />
              </button>
            )}
            {tiles.map((t) => (
              <button key={t.key} type="button" className={`tile${active === t.key ? " is-on" : ""}`} aria-pressed={active === t.key} onClick={() => setMetric(t.key)}>
                <span className="tile-label">{METRIC[t.key].label}</span>
                <strong className="tile-value">{t.value}</strong>
                <Delta current={t.cur} previous={t.prev} short />
                <Sparkline values={spark(t.key)} />
              </button>
            ))}
            <div className="tile">
              <span className="tile-label">A receber</span>
              <strong className="tile-value">{formatPrice(k.pendingRevenue)}</strong>
              <small>{k.pendingOrders} pedido(s) em processamento</small>
            </div>
            <div className={`tile${k.canceledRate > 0.15 ? " warn" : ""}`}>
              <span className="tile-label">Cancelamentos</span>
              <strong className="tile-value">{formatPercent(k.canceledRate)}</strong>
              <small>{k.canceledOrders} pedido(s) cancelado(s)</small>
            </div>
            <div className="tile">
              <span className="tile-label">Clientes que compraram</span>
              <strong className="tile-value">{formatInt(k.customers)}</strong>
              <small>{k.newCustomers} novo(s) · {k.returningCustomers} recorrente(s)</small>
            </div>
          </div>

          <div className="dash-grid two">
            <section className="dcard" aria-labelledby="trend-title">
              <header>
                <div className="trend-bar" style={{ marginBottom: 0 }}>
                  <h2 id="trend-title">{METRIC[active].label} por {size === 1 ? "dia" : "semana"}</h2>
                  <div className="seg" role="group" aria-label="Agrupar por">
                    <button type="button" className={size === 1 ? "is-on" : ""} aria-pressed={size === 1} onClick={() => setGran("day")}>Dia</button>
                    <button type="button" className={size === 7 ? "is-on" : ""} aria-pressed={size === 7} onClick={() => setGran("week")}>Semana</button>
                  </div>
                </div>
                <p>{range}{compare ? " · comparado ao período anterior" : ""}. Toque ou passe o mouse sobre o gráfico para ver cada ponto.</p>
              </header>
              <TrendChart
                points={points}
                formatValue={formatValue}
                formatShort={formatShort}
                seriesName={METRIC[active].label}
                color={active === "profit" ? "var(--viz-s3)" : "var(--viz-s1)"}
                compare={compare}
                ariaLabel={`${METRIC[active].label} por ${size === 1 ? "dia" : "semana"}, de ${range}.`}
                emptyText={active === "profit" ? "Sem lucro calculado neste período." : "Sem vendas neste período."}
              />
              <div className="dash-row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
                <button type="button" className="link-btn" onClick={() => downloadCsv(`indicadores-${from}-a-${to}.csv`, ["Data", "Faturamento", "Pedidos", "Itens", "Lucro (itens com custo)"], data.daily.map((d) => [formatDay(d.date), d.revenue.toFixed(2), d.orders, d.items, d.profit.toFixed(2)]))}>Exportar CSV</button>
              </div>
            </section>

            <section className="dcard" aria-labelledby="ins-title">
              <header><h2 id="ins-title">Atenção e destaques</h2><p>O que merece sua atenção agora e o que se destacou no período.</p></header>
              {insights.length === 0 ? (
                <p className="empty">Tudo em ordem. Os destaques aparecem quando houver vendas.</p>
              ) : (
                <ul className="insights">
                  {insights.map((it) => {
                    const body = (
                      <>
                        <span className="insight-icon" aria-hidden="true">{it.icon}</span>
                        <span>{it.text}{it.sub && <small>{it.sub}</small>}</span>
                      </>
                    );
                    return <li key={it.text}>{it.href ? <Link href={it.href} className={`insight ${it.tone}`}>{body}</Link> : <div className={`insight ${it.tone}`}>{body}</div>}</li>;
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="dash-grid two-even">
            <section className="dcard" aria-labelledby="rank-title">
              <header><h2 id="rank-title">O que mais vende{hasProfit ? " e dá lucro" : ""}</h2><p>Toque numa linha para filtrar o painel inteiro por ela.</p></header>
              <RankPanel data={data} filters={filters} onToggle={toggleFilter} />
            </section>
            <section className="dcard" aria-labelledby="status-title">
              <header><h2 id="status-title">Situação dos pedidos</h2><p>Venda realizada = pedido pago, enviado ou entregue. Cancelados não entram no faturamento.</p></header>
              <StatusBar byStatus={data.byStatus} />
            </section>
          </div>

          <div className="dash-grid">
            <section className="dcard" aria-labelledby="heat-title">
              <header><h2 id="heat-title">Quando a loja vende</h2><p>Pedidos por dia da semana e horário (horário de Brasília). Mais escuro = mais vendas.</p></header>
              <Heatmap cells={data.heatmap} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
