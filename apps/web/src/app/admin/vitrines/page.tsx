"use client";

import { useMemo, useState } from "react";
import { Badge, ConfirmButton, EmptyState, MoveButtons, Notice, PageHead, Switch, reorder, useAdminList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { isVisible } from "@/lib/visibility";
import { BADGE_LABEL, type BadgeKey, type Product, type Showcase } from "@/types/product";

interface FormState {
  id?: string;
  title: string;
  selectionRule: BadgeKey;
  itemLimit: number;
  sortOrder: number;
  active: boolean;
}

const body = (f: FormState) => ({ title: f.title.trim(), selectionRule: f.selectionRule, itemLimit: f.itemLimit, sortOrder: f.sortOrder, active: f.active });
const fromShowcase = (s: Showcase): FormState => ({ id: s.id, title: s.title, selectionRule: s.selectionRule, itemLimit: s.itemLimit, sortOrder: s.sortOrder, active: s.active });

export default function ShowcasesAdmin() {
  const { items, loading, error, setError, reload } = useAdminList<Showcase>("showcases");
  const products = useAdminList<Product>("products").items;
  const [form, setForm] = useState<FormState | null>(null);

  /** Quantos produtos à venda carregam cada selo, para avisar quando uma vitrine ficaria vazia. */
  const countByBadge = useMemo(() => {
    const counts: Partial<Record<BadgeKey, number>> = {};
    for (const p of products) if (p.badge && isVisible(p)) counts[p.badge] = (counts[p.badge] ?? 0) + 1;
    return counts;
  }, [products]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (form) {
    return (
      <ShowcaseForm
        initial={form}
        countByBadge={countByBadge}
        onCancel={() => setForm(null)}
        onSaved={async () => {
          setForm(null);
          await reload();
        }}
      />
    );
  }

  return (
    <>
      <PageHead
        title="Vitrines de produtos"
        hint="Cada vitrine é uma faixa de produtos na home. Os produtos entram sozinhos pelo selo (Lançamento, Promoção, Destaque) definido no cadastro deles."
        action={<button className="btn btn-solid btn-sm" onClick={() => setForm({ title: "", selectionRule: "LANCAMENTO", itemLimit: 4, sortOrder: items.length, active: true })}>+ Nova vitrine</button>}
      />
      <Notice error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nenhuma vitrine. Sem vitrines, a home mostra os 4 produtos mais recentes em &quot;Lançamentos&quot;.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordem</th><th>Vitrine</th><th>Regra</th><th>Itens</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {items.map((s, i) => {
                const available = countByBadge[s.selectionRule] ?? 0;
                return (
                  <tr key={s.id} className={s.active ? undefined : "is-off"}>
                    <td><MoveButtons index={i} total={items.length} onMove={(d) => run(() => reorder(items, i, d, (x) => api.admin.update("showcases", x.id, body(fromShowcase(x)))))} /></td>
                    <td><strong>{s.title}</strong></td>
                    <td>Produtos com selo “{BADGE_LABEL[s.selectionRule]}”</td>
                    <td>{Math.min(available, s.itemLimit)} de {s.itemLimit}{available === 0 && <> <Badge tone="warn">Sem produtos</Badge></>}</td>
                    <td>{s.active ? <Badge tone="ok">Ativa</Badge> : <Badge tone="off">Desativada</Badge>}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => setForm(fromShowcase(s))}>Editar</button>
                      <button type="button" className="link-btn" onClick={() => run(() => api.admin.update("showcases", s.id, { ...body(fromShowcase(s)), active: !s.active }))}>{s.active ? "Desativar" : "Ativar"}</button>
                      <ConfirmButton message="Excluir vitrine?" onConfirm={() => run(() => api.admin.remove("showcases", s.id))}>Excluir</ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ShowcaseForm({ initial, countByBadge, onCancel, onSaved }: { initial: FormState; countByBadge: Partial<Record<BadgeKey, number>>; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const available = countByBadge[f.selectionRule] ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setError("Informe o título da vitrine.");
    setSaving(true);
    try {
      if (f.id) await api.admin.update("showcases", f.id, body(f));
      else await api.admin.create("showcases", body(f));
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <PageHead title={f.id ? "Editar vitrine" : "Nova vitrine"} action={<button type="button" className="link-btn" onClick={onCancel}>← Voltar à lista</button>} />
      <fieldset>
        <legend>Vitrine</legend>
        <label className="span-2">Título na home<input value={f.title} required onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Lançamentos" /></label>
        <label>Mostrar produtos com o selo
          <select value={f.selectionRule} onChange={(e) => setF({ ...f, selectionRule: e.target.value as BadgeKey })}>
            {(Object.keys(BADGE_LABEL) as BadgeKey[]).map((k) => <option key={k} value={k}>{BADGE_LABEL[k]}</option>)}
          </select>
          <small>{available} produto(s) visíveis na loja com este selo.</small>
        </label>
        <label>Quantidade de produtos (1 a 24)<input type="number" min={1} max={24} value={f.itemLimit} onChange={(e) => setF({ ...f, itemLimit: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })} /></label>
        <div className="field"><Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={f.active ? "Ativa" : "Desativada"} /></div>
      </fieldset>
      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar vitrine"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
