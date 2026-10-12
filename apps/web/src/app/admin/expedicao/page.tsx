"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, Notice, PageHead, Thumb, formatDateTime, useAdminList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { formatInt, formatPrice } from "@/lib/format";
import { ALL_STATUSES, CARRIERS, NEXT_STEP, ORDER_STATUS, safeUrl, type OrderStatus } from "@/lib/order-status";
import type { Order } from "@/types/product";

/** Abas na ordem de trabalho: o que precisa de ação primeiro. */
const TABS: OrderStatus[] = ["PAID", "PICKING", "PENDING", "SHIPPED", "DELIVERED", "CANCELED"];
const HOUR = 3_600_000;

function age(iso: string, now: number) {
  const ms = now - new Date(iso).getTime();
  if (ms < HOUR) return `há ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < 24 * HOUR) return `há ${Math.round(ms / HOUR)} h`;
  const days = Math.round(ms / (24 * HOUR));
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function addressText(o: Order) {
  const a = o.shippingAddress ?? {};
  return [a.recipient, `${a.street ?? ""}, ${a.number ?? ""}${a.complement ? ` - ${a.complement}` : ""}`, a.district, `${a.city ?? ""}/${a.state ?? ""}`, `CEP ${a.zip ?? ""}`].filter(Boolean).join("\n");
}

export default function ExpeditionPage() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Order>("orders");
  const [tab, setTab] = useState<OrderStatus | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of items) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [items]);

  // Abre na primeira fila que tem trabalho.
  const active: OrderStatus = tab ?? TABS.find((s) => (counts[s] ?? 0) > 0 && s !== "DELIVERED" && s !== "CANCELED") ?? "PAID";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((o) => `${o.id} ${o.profile?.name ?? ""} ${o.profile?.email ?? ""} ${o.trackingCode ?? ""}`.toLowerCase().includes(q))
      : items.filter((o) => o.status === active);
    // Fila de trabalho: o pedido mais antigo primeiro. Histórico (entregues/cancelados): o mais recente primeiro.
    const oldestFirst = !q && active !== "DELIVERED" && active !== "CANCELED";
    return [...list].sort((a, b) => (oldestFirst ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  }, [items, active, query]);

  const replace = useCallback((updated: Order) => setItems((list) => list.map((o) => (o.id === updated.id ? updated : o))), [setItems]);

  const oldestPaid = items.filter((o) => o.status === "PAID").sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];

  return (
    <>
      <PageHead title="Expedição" hint="Fila de pedidos para separar e enviar do estoque. Avance cada pedido pelas situações; ao enviar, informe o rastreio para o cliente acompanhar." />
      <Notice error={error} />

      <div className="kpi-grid">
        <div className={`kpi${(counts.PAID ?? 0) > 0 ? " kpi-warn" : ""}`}><span>Para separar</span><strong>{counts.PAID ?? 0}</strong><small>{oldestPaid ? `o mais antigo ${age(oldestPaid.createdAt, now)}` : "pagamento aprovado"}</small></div>
        <div className="kpi"><span>Em separação</span><strong>{counts.PICKING ?? 0}</strong><small>prontos para despachar</small></div>
        <div className="kpi"><span>Em processamento</span><strong>{counts.PENDING ?? 0}</strong><small>aguardando aprovação do pagamento</small></div>
        <div className="kpi"><span>Enviados</span><strong>{counts.SHIPPED ?? 0}</strong><small>a caminho do cliente</small></div>
      </div>

      <div className="toolbar" style={{ marginTop: 20 }}>
        <input type="search" placeholder="Buscar por nº do pedido, cliente, e-mail ou código de rastreio" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>Atualizar</button>
      </div>

      {!query && (
        <div className="options admin-tabs ex-tabs" role="tablist" aria-label="Situação do pedido" style={{ margin: "0 0 16px" }}>
          {TABS.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={active === s} className={`option${active === s ? " is-active" : ""}`} onClick={() => setTab(s)}>
              {ORDER_STATUS[s].label} <span className="ex-count">{formatInt(counts[s] ?? 0)}</span>
            </button>
          ))}
        </div>
      )}
      {query && <p className="admin-hint" style={{ marginBottom: 12 }}>Resultados da busca em todas as situações. Limpe a busca para voltar às filas.</p>}

      {loading ? (
        <p>Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState>{query ? "Nenhum pedido encontrado." : `Nenhum pedido em “${ORDER_STATUS[active].label}”.`}</EmptyState>
      ) : (
        <div className="ex-list">
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} now={now} onChange={replace} onError={setError} />
          ))}
        </div>
      )}
    </>
  );
}

function OrderCard({ order: o, now, onChange, onError }: { order: Order; now: number; onChange: (o: Order) => void; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState<"ship" | "edit" | null>(null);
  const [note, setNote] = useState(o.internalNote ?? "");
  const [noteState, setNoteState] = useState<"" | "salvando" | "salvo">("");
  const [copied, setCopied] = useState("");

  const next = NEXT_STEP[o.status];
  const picked = o.items.filter((i) => i.picked).length;
  const allPicked = picked === o.items.length;
  const waiting = (o.status === "PAID" || o.status === "PICKING") && now - new Date(o.createdAt).getTime() > 24 * HOUR;
  const a = o.shippingAddress ?? {};
  const tracking = safeUrl(o.trackingUrl);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await action();
      onError("");
      return result;
    } catch (e) {
      onError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function go(status: OrderStatus, extra: Parameters<typeof api.admin.setOrderStatus>[2] = {}) {
    if (status === "CANCELED" && !window.confirm("Cancelar este pedido? Os itens voltam ao estoque e um pedido cancelado não pode ser reaberto.")) return;
    const updated = await run(() => api.admin.setOrderStatus(o.id, status, extra));
    if (updated) {
      onChange(updated);
      setShipping(null);
    }
  }

  async function togglePicked(itemId: string, value: boolean) {
    onChange({ ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, picked: value } : i)) }); // muda na hora
    const ok = await run(() => api.admin.setItemPicked(o.id, itemId, value));
    if (!ok) onChange(o); // não gravou: volta ao que estava
  }

  async function saveNote() {
    if ((o.internalNote ?? "") === note.trim()) return;
    setNoteState("salvando");
    const updated = await run(() => api.admin.setOrderNote(o.id, note));
    if (updated) {
      onChange(updated);
      setNoteState("salvo");
    } else setNoteState("");
  }

  async function copyText(label: string, text: string) {
    if (await copy(text)) {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    }
  }

  return (
    <article className={`ocard${waiting ? " is-late" : ""}`} aria-label={`Pedido ${o.id.slice(0, 8)}`}>
      <header className="ocard-head">
        <div>
          <strong className="ocard-id">#{o.id.slice(0, 8)}</strong> <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
          {waiting && <> <Badge tone="warn">Parado {age(o.createdAt, now).replace("há ", "há ")}</Badge></>}
          <br />
          <small>{formatDateTime(o.createdAt)} · {age(o.createdAt, now)}</small>
        </div>
        <strong className="ocard-total">{formatPrice(o.total)}</strong>
      </header>

      <div className="ocard-cols">
        <section>
          <h3>Cliente e entrega</h3>
          <p className="ocard-text">
            <strong>{o.profile?.name ?? o.profile?.email}</strong>
            <br />
            {o.profile?.phone ? <a href={`tel:${o.profile.phone}`}>{o.profile.phone}</a> : <small>sem telefone</small>} · <small>{o.profile?.email}</small>
          </p>
          <address className="ocard-address">
            {a.recipient}<br />
            {a.street}, {a.number}{a.complement ? ` — ${a.complement}` : ""}<br />
            {a.district} · {a.city}/{a.state}<br />
            CEP {a.zip}
          </address>
          <button type="button" className="btn-small" onClick={() => copyText("endereço", addressText(o))}>{copied === "endereço" ? "✓ Copiado" : "Copiar endereço"}</button>
        </section>

        <section>
          <h3>Itens {o.status === "PAID" || o.status === "PICKING" ? <small>· {picked} de {o.items.length} separados</small> : null}</h3>
          <ul className="ocard-items">
            {o.items.map((i) => (
              <li key={i.id} className={i.picked ? "is-picked" : undefined}>
                <label className="ocard-check">
                  <input type="checkbox" checked={!!i.picked} disabled={o.status === "CANCELED" || o.status === "DELIVERED"} onChange={(e) => togglePicked(i.id, e.target.checked)} aria-label={`Separado: ${i.variant.product.name}`} />
                  <Thumb url={i.variant.product.images[0]} />
                  <span>
                    <strong>{i.quantity}× {i.variant.product.name}</strong>
                    <br />
                    <small>{i.variant.color} · nº {i.variant.size} · SKU {i.variant.sku}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {(o.status === "PAID" || o.status === "PICKING") && (
            <div className="ocard-meter" role="img" aria-label={`${picked} de ${o.items.length} itens separados`}><span style={{ width: `${(picked / Math.max(o.items.length, 1)) * 100}%` }} /></div>
          )}
        </section>
      </div>

      {(o.status === "SHIPPED" || o.status === "DELIVERED" || o.trackingCode || tracking) && shipping !== "edit" && (
        <div className="ocard-tracking">
          <div>
            <small>Rastreio{o.carrier ? ` · ${o.carrier}` : ""}</small>
            <br />
            {o.trackingCode ? <code>{o.trackingCode}</code> : <small>sem código informado</small>}
          </div>
          <div className="ocard-tracking-actions">
            {o.trackingCode && <button type="button" className="btn-small" onClick={() => copyText("código", o.trackingCode!)}>{copied === "código" ? "✓ Copiado" : "Copiar código"}</button>}
            {tracking && <a className="btn-small" href={tracking} target="_blank" rel="noopener noreferrer">Abrir rastreio ↗</a>}
            <button type="button" className="link-btn" onClick={() => setShipping("edit")}>Editar</button>
          </div>
        </div>
      )}

      {shipping && (
        <ShipForm
          order={o}
          mode={shipping}
          busy={busy}
          warnUnpicked={shipping === "ship" && !allPicked}
          onCancel={() => setShipping(null)}
          onSubmit={async (data) => {
            if (shipping === "edit") {
              const updated = await run(() => api.admin.setTracking(o.id, data));
              if (updated) {
                onChange(updated);
                setShipping(null);
              }
            } else await go("SHIPPED", data);
          }}
        />
      )}

      <div className="ocard-note">
        <label>
          <small>Observação interna (o cliente não vê)</small>
          <textarea rows={2} value={note} placeholder="Ex.: embalar para presente, falta a numeração 38…" onChange={(e) => (setNote(e.target.value), setNoteState(""))} onBlur={saveNote} />
        </label>
        {noteState && <small className="ocard-saved">{noteState === "salvando" ? "Salvando…" : "✓ Salvo"}</small>}
      </div>

      {!shipping && (
        <div className="ocard-actions">
          {next && (
            <button
              type="button"
              className="btn btn-solid btn-sm"
              disabled={busy}
              onClick={() => (next.to === "SHIPPED" ? setShipping("ship") : go(next.to))}
            >
              {busy ? "Salvando…" : next.label}
            </button>
          )}
          {o.status !== "CANCELED" && (
            <select value="" disabled={busy} aria-label="Mudar situação" onChange={(e) => e.target.value && go(e.target.value as OrderStatus)}>
              <option value="">Mudar situação…</option>
              {ALL_STATUSES.filter((s) => s !== o.status).map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
            </select>
          )}
        </div>
      )}

      {(o.events?.length ?? 0) > 0 && (
        <details className="ocard-history">
          <summary>Histórico ({o.events!.length})</summary>
          <ol>
            {[...o.events!].reverse().map((e) => (
              <li key={e.id}><strong>{ORDER_STATUS[e.status].label}</strong> <small>{formatDateTime(e.createdAt)}{e.note ? ` · ${e.note}` : ""}</small></li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

function ShipForm({ order, mode, busy, warnUnpicked, onCancel, onSubmit }: {
  order: Order;
  mode: "ship" | "edit";
  busy: boolean;
  warnUnpicked: boolean;
  onCancel: () => void;
  onSubmit: (data: { carrier: string; trackingCode: string; trackingUrl: string }) => Promise<void>;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "Correios");
  const [code, setCode] = useState(order.trackingCode ?? "");
  const [url, setUrl] = useState(order.trackingUrl ?? CARRIERS.find((c) => c.name === (order.carrier ?? "Correios"))?.url ?? "");
  const [error, setError] = useState("");

  function pickCarrier(name: string) {
    // Só troca o link se ele ainda for o sugerido da transportadora anterior (ou estiver vazio).
    const previous = CARRIERS.find((c) => c.name === carrier)?.url ?? "";
    if (!url || url === previous) setUrl(CARRIERS.find((c) => c.name === name)?.url ?? "");
    setCarrier(name);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim() && !safeUrl(url.trim())) return setError("O link deve começar com http:// ou https://");
    if (warnUnpicked && !window.confirm("Nem todos os itens foram marcados como separados. Marcar como enviado mesmo assim?")) return;
    await onSubmit({ carrier, trackingCode: code.trim(), trackingUrl: url.trim() });
  }

  return (
    <form className="ocard-ship" onSubmit={submit}>
      <h3>{mode === "ship" ? "Dados do envio" : "Editar rastreio"}</h3>
      {warnUnpicked && <p className="ocard-warn">⚠ Nem todos os itens foram marcados como separados.</p>}
      <div className="ocard-ship-grid">
        <label>Transportadora
          <select value={carrier} onChange={(e) => pickCarrier(e.target.value)}>{CARRIERS.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        </label>
        <label>Código de rastreio
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AA123456789BR" autoCapitalize="characters" />
        </label>
        <label className="span-2">Link de rastreio
          <input value={url} onChange={(e) => (setUrl(e.target.value), setError(""))} placeholder="https://…" inputMode="url" />
          <small>É a página de rastreio da transportadora; o cliente a vê junto com o código. Se tiver um link direto para este objeto, cole aqui.</small>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={busy}>{busy ? "Salvando…" : mode === "ship" ? (code.trim() ? "Confirmar envio" : "Enviar sem código") : "Salvar rastreio"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
