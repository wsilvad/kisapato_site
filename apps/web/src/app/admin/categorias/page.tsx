"use client";

import { useState } from "react";
import { Badge, ConfirmButton, EmptyState, ImageField, MoveButtons, Notice, PageHead, RowOpen, RowSwitch, Switch, SlugField, reorder, slugify, useAdminList, Thumb, useBackToList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import type { Category, ProductClass } from "@/types/product";

interface FormState {
  id?: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  classId: string;
  imageUrl: string | null;
  sortOrder: number;
  showOnHome: boolean;
}

const body = (f: FormState) => ({ name: f.name.trim(), slug: f.slug, classId: f.classId, imageUrl: f.imageUrl, sortOrder: f.sortOrder, showOnHome: f.showOnHome });

export default function CategoriesAdmin() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Category>("categories");
  const classes = useAdminList<ProductClass>("classes").items;
  const [form, setForm] = useState<FormState | null>(null);
  useBackToList(form !== null, () => setForm(null));
  const openEdit = (c: Category) => setForm({ id: c.id, name: c.name, slug: c.slug, slugTouched: true, classId: c.classId ?? "", imageUrl: c.imageUrl ?? null, sortOrder: c.sortOrder ?? 0, showOnHome: c.showOnHome ?? false });

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = (c: Category) => api.admin.update("categories", c.id, body({ ...c, slugTouched: true, classId: c.classId ?? "", imageUrl: c.imageUrl ?? null, sortOrder: c.sortOrder ?? 0, showOnHome: c.showOnHome ?? false }));

  /** Desativar tira a categoria e os produtos dela da loja: confirma quando há produtos. */
  async function setActive(c: Category, active: boolean) {
    const count = c._count?.products ?? 0;
    if (!active && count > 0 && !window.confirm(`Desativar “${c.name}”? Os ${count} produto(s) dela deixam de aparecer na loja (continuam cadastrados e voltam ao reativar).`)) return;
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, active } : x)));
    try {
      await api.admin.setActive("categories", c.id, active);
      setError("");
    } catch (e) {
      await reload(); // volta ao estado do servidor...
      setError((e as Error).message); // ...e só então mostra o erro (o reload o limparia)
    }
  }

  if (form) {
    return (
      <CategoryForm
        initial={form}
        classes={classes}
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
        title="Categorias"
        hint='As categorias marcadas como "mostrar na home" viram os cartões de "Compre por categoria".'
        action={<button className="btn btn-solid btn-sm" onClick={() => setForm({ name: "", slug: "", slugTouched: false, classId: classes[0]?.id ?? "", imageUrl: null, sortOrder: items.length, showOnHome: true })}>+ Nova categoria</button>}
      />
      <Notice error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nenhuma categoria cadastrada.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordem</th><th /><th>Categoria</th><th>Classe</th><th>Produtos</th><th>Na home</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {items.map((c, i) => {
                return (
                  <tr key={c.id} className={c.active === false ? "is-off" : undefined}>
                    <td><MoveButtons index={i} total={items.length} onMove={(d) => run(() => reorder(items, i, d, save))} /></td>
                    <td><RowOpen label={c.name} onOpen={() => openEdit(c)}><Thumb url={c.imageUrl} /></RowOpen></td>
                    <td><RowOpen label={c.name} onOpen={() => openEdit(c)}><strong>{c.name}</strong></RowOpen></td>
                    <td>{c.productClass?.name ?? <Badge tone="warn">Sem classe</Badge>}</td>
                    <td>{c._count?.products ?? 0}</td>
                    <td>{c.showOnHome ? <Badge tone="ok">Sim</Badge> : <Badge>Não</Badge>}</td>
                    <td>
                      <span className="active-cell">
                        <RowSwitch checked={c.active !== false} label={`${c.active === false ? "Ativar" : "Desativar"} ${c.name}`} onChange={(v) => setActive(c, v)} />
                        {c.active === false ? <Badge tone="off">Desativada</Badge> : c.productClass?.active === false ? <Badge tone="warn">Oculta</Badge> : <Badge tone="ok">Ativa</Badge>}
                      </span>
                      {c.active !== false && c.productClass?.active === false && <><br /><small>classe {c.productClass.name} desativada</small></>}
                    </td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => openEdit(c)}>Editar</button>
                      <ConfirmButton message="Excluir categoria?" onConfirm={() => run(() => api.admin.remove("categories", c.id))}>Excluir</ConfirmButton>
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

function CategoryForm({ initial, classes, onCancel, onSaved }: { initial: FormState; classes: ProductClass[]; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || !f.slug) return setError("Informe o nome da categoria.");
    if (!f.classId) return setError("Escolha a classe da categoria.");
    setSaving(true);
    try {
      if (f.id) await api.admin.update("categories", f.id, body(f));
      else await api.admin.create("categories", body(f));
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <PageHead title={f.id ? "Editar categoria" : "Nova categoria"} action={<button type="button" className="link-btn" onClick={onCancel}>← Voltar à lista</button>} />
      <fieldset>
        <legend>Categoria</legend>
        <label>Nome
          <input value={f.name} required onChange={(e) => setF((cur) => ({ ...cur, name: e.target.value, slug: cur.slugTouched ? cur.slug : slugify(e.target.value) }))} />
        </label>
        <SlugField value={f.slug} name={f.name} prefix="/produtos?categoria=" onChange={(slug) => setF({ ...f, slug, slugTouched: true })} />
        <label>Classe
          <select value={f.classId} required onChange={(e) => setF({ ...f, classId: e.target.value })}>
            <option value="">Selecione</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="span-2"><ImageField label="Foto do cartão na home" value={f.imageUrl} onChange={(url) => setF({ ...f, imageUrl: url })} hint="Formato vertical, ao menos 800 × 920 px." /></div>
        <div className="field"><Switch checked={f.showOnHome} onChange={(v) => setF({ ...f, showOnHome: v })} label="Mostrar na home" /></div>
      </fieldset>
      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
