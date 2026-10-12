"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, Notice, PageHead, formatDateTime } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { formatInt, formatPrice } from "@/lib/format";
import type { Inventory, InventoryItem, StockMovement } from "@/types/product";

type Filter = "all" | "OUT" | "LOW" | "stalled";
const MOVEMENT_LABEL: Record<StockMovement["type"], string> = { SALE: "Venda", CANCELLATION: "Cancelamento", ADJUSTMENT: "Ajuste" };

export default function StockPage() {
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.admin.inventory());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (i) =>
        (showInactive || i.productActive) &&
        (filter === "all" || (filter === "stalled" ? i.stalled : i.status === filter)) &&
        (!q || `${i.productName} ${i.color} ${i.sku} ${i.brandName ?? ""} ${i.categoryName}`.toLowerCase().includes(q)),
    );
  }, [data, query, filter, showInactive]);

  const t = data?.totals;
  const chips: [Filter, string][] = [["all", "Todos"], ["OUT", "Esgotados"], ["LOW", "Estoque baixo"], ["stalled", "Parados"]];

  return (
    <>
      <PageHead
        title="Estoque"
        hint={`Estoque baixo = ${data?.lowStockThreshold ?? 3} unidades ou menos. “Parado” = com estoque, cadastrado há mais de 60 dias e sem nenhuma venda nesse período. A cobertura estima por quantos dias o estoque dura no ritmo de vendas dos últimos 30 dias.`}
        action={
          data && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                downloadCsv("estoque.csv", ["Produto", "Cor", "Número", "SKU", "Categoria", "Marca", "Estoque", "Vendidos 30 dias", "Cobertura (dias)", "Preço", "Custo"],
                  items.map((i) => [i.productName, i.color, i.size, i.sku, i.categoryName, i.brandName, i.stock, i.sold30, i.daysOfCover, i.price.toFixed(2), i.cost?.toFixed(2)]))
              }
            >
              Exportar CSV
            </button>
          )
        }
      />
      <Notice error={error} />

      {t && (
        <div className="kpi-grid">
          <div className="kpi"><span>Unidades em estoque</span><strong>{formatInt(t.units)}</strong><small>{t.variants} variações (produtos ativos)</small></div>
          <div className="kpi"><span>Valor a preço de venda</span><strong>{formatPrice(t.saleValue)}</strong></div>
          <div className="kpi">
            <span>Valor a custo</span>
            <strong>{t.variantsWithoutCost === t.variants ? "—" : formatPrice(t.costValue)}</strong>
            <small>{t.variantsWithoutCost > 0 ? `${t.variantsWithoutCost} variações sem custo cadastrado` : `Lucro potencial ${formatPrice(t.potentialProfit)}`}</small>
          </div>
          <div className={`kpi${t.outOfStock > 0 ? " kpi-warn" : ""}`}><span>Esgotadas</span><strong>{t.outOfStock}</strong><small>variações sem estoque</small></div>
          <div className={`kpi${t.lowStock > 0 ? " kpi-warn" : ""}`}><span>Estoque baixo</span><strong>{t.lowStock}</strong><small>repor em breve</small></div>
          <div className="kpi"><span>Parados</span><strong>{t.stalled}</strong><small>capital sem giro</small></div>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 24 }}>
        <input type="search" placeholder="Buscar por produto, cor, SKU, marca ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="options">
          {chips.map(([key, label]) => (
            <button key={key} type="button" className={`option${filter === key ? " is-active" : ""}`} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Incluir produtos desativados</label>
      </div>

      {!data ? (
        !error && <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nenhuma variação encontrada com esses filtros.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Produto</th><th>Cor / nº</th><th>SKU</th><th className="num">Estoque</th><th className="num">Vendidos (30 d)</th><th className="num">Cobertura</th><th className="num">Preço</th><th className="num">Custo</th><th /></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <Fragment key={i.variantId}>
                  <tr className={i.productActive ? undefined : "is-off"}>
                    <td><strong>{i.productName}</strong><br /><small>{[i.brandName, i.categoryName].filter(Boolean).join(" · ")}{i.productActive ? "" : " · desativado"}</small></td>
                    <td>{i.color} · {i.size}</td>
                    <td><small>{i.sku}</small></td>
                    <td className="num">
                      {i.status === "OUT" ? <Badge tone="off">Esgotado</Badge> : i.status === "LOW" ? <Badge tone="warn">{i.stock} (baixo)</Badge> : i.stock}
                      {i.stalled && <><br /><Badge tone="muted">Parado</Badge></>}
                    </td>
                    <td className="num">{i.sold30}</td>
                    <td className="num">{i.daysOfCover === null ? "—" : `${formatInt(i.daysOfCover)} dias`}</td>
                    <td className="num">{formatPrice(i.price)}</td>
                    <td className="num">{i.cost === null ? "—" : formatPrice(i.cost)}</td>
                    <td className="row-actions"><button type="button" className="link-btn" onClick={() => setOpen(open === i.variantId ? null : i.variantId)}>{open === i.variantId ? "Fechar" : "Ajustar / histórico"}</button></td>
                  </tr>
                  {open === i.variantId && (
                    <tr className="order-detail">
                      <td colSpan={9}><AdjustPanel item={i} onDone={load} /></td>
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

function AdjustPanel({ item, onDone }: { item: InventoryItem; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"in" | "out" | "set">("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<StockMovement[] | null>(null);

  const loadHistory = useCallback(() => api.admin.movements(item.variantId, 20).then(setHistory).catch((e: Error) => setError(e.message)), [item.variantId]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function apply() {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 0 || (mode !== "set" && n === 0)) return setError("Informe uma quantidade inteira maior que zero (no “definir total”, zero é permitido).");
    setBusy(true);
    try {
      await api.admin.adjustStock(item.variantId, mode === "set" ? { set: n } : { delta: mode === "in" ? n : -n }, note.trim() || undefined);
      setAmount("");
      setNote("");
      setError("");
      await Promise.all([onDone(), loadHistory()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="stock-adjust">
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Tipo de ajuste">
          <option value="in">Entrada (+)</option>
          <option value="out">Saída / perda (−)</option>
          <option value="set">Definir total</option>
        </select>
        <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Qtd." aria-label="Quantidade" />
        <input style={{ width: 220 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo" />
        <button type="button" className="btn btn-solid btn-sm" disabled={busy || amount === ""} onClick={apply}>{busy ? "Salvando…" : "Aplicar"}</button>
      </div>
      <Notice error={error} />
      <h3 style={{ margin: "16px 0 8px", fontSize: 14 }}>Últimas movimentações</h3>
      {history === null ? (
        <p>Carregando…</p>
      ) : history.length === 0 ? (
        <p className="admin-hint">Sem movimentações registradas. O histórico começa a partir de agora.</p>
      ) : (
        <table className="table table-tight">
          <thead><tr><th>Quando</th><th>Tipo</th><th className="num">Quantidade</th><th className="num">Saldo</th><th>Observação</th></tr></thead>
          <tbody>
            {history.map((m) => (
              <tr key={m.id}>
                <td>{formatDateTime(m.createdAt)}</td>
                <td>{MOVEMENT_LABEL[m.type]}</td>
                <td className="num">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                <td className="num">{m.balance}</td>
                <td>{m.note ?? (m.orderId ? `Pedido #${m.orderId.slice(0, 8)}` : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
