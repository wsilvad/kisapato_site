"use client";

import { useState } from "react";
import { Badge, ConfirmButton, EmptyState, ImageField, MoveButtons, Notice, PageHead, RowSwitch, SlugField, Thumb, reorder, slugify, useAdminList } from "./kit";
import { api } from "@/lib/api";

interface Item {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  imageUrl?: string | null;
  active?: boolean;
  _count?: Record<string, number>;
}

interface Props {
  resource: "classes" | "audiences" | "brands";
  title: string;
  hint: string;
  /** Rótulo no singular, para botões e títulos ("classe", "público"). */
  noun: string;
  /** "Nova"/"Novo", conforme o gênero da palavra. */
  newLabel: string;
  /** Chave de `_count` e como descrever o uso ("categorias", "produtos"). */
  usage: { key: string; label: string };
  deleteMessage: string;
  placeholder: string;
  /** Quando informado, a tabela ganha o interruptor ativo/inativo; recebe a quantidade afetada e devolve o aviso. */
  activatable?: { warn: (name: string, count: number) => string };
  /** Quando informado, cada item tem uma foto (usada no cartão da home); a dica orienta o formato. */
  imageHint?: string;
}

const body = (i: { name: string; slug: string; sortOrder: number; imageUrl?: string | null }, withImage: boolean) => ({
  name: i.name.trim(),
  slug: i.slug,
  sortOrder: i.sortOrder,
  ...(withImage && { imageUrl: i.imageUrl ?? null }),
});

/** CRUD simples de uma lista ordenável (nome + endereço), usado por Classes e Públicos-alvo. */
export function TaxonomyAdmin({ resource, title, hint, noun, newLabel, usage, deleteMessage, placeholder, activatable, imageHint }: Props) {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Item>(resource);
  const [editing, setEditing] = useState<{ id?: string; name: string; slug: string; slugTouched: boolean; sortOrder: number; imageUrl?: string | null } | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim() || !editing.slug) return setFormError(`Informe o nome d${newLabel === "Nova" ? "a" : "o"} ${noun}.`);
    setSaving(true);
    try {
      if (editing.id) await api.admin.update(resource, editing.id, body(editing, !!imageHint));
      else await api.admin.create(resource, body(editing, !!imageHint));
      setEditing(null);
      setFormError("");
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(item: Item, active: boolean) {
    const count = item._count?.[usage.key] ?? 0;
    if (!active && count > 0 && activatable && !window.confirm(activatable.warn(item.name, count))) return;
    setItems((list) => list.map((x) => (x.id === item.id ? { ...x, active } : x)));
    try {
      await api.admin.setActive(resource as "classes" | "brands", item.id, active);
      setError("");
    } catch (e) {
      await reload(); // volta ao estado do servidor...
      setError((e as Error).message); // ...e só então mostra o erro (o reload o limparia)
    }
  }

  if (editing) {
    return (
      <form className="admin-form" onSubmit={submit}>
        <PageHead title={editing.id ? `Editar ${noun}` : `${newLabel} ${noun}`} action={<button type="button" className="link-btn" onClick={() => { setEditing(null); setFormError(""); }}>← Voltar à lista</button>} />
        <fieldset>
          <legend>{noun[0]!.toUpperCase() + noun.slice(1)}</legend>
          <label>Nome
            <input value={editing.name} required placeholder={placeholder} onChange={(e) => setEditing((cur) => cur && { ...cur, name: e.target.value, slug: cur.slugTouched ? cur.slug : slugify(e.target.value) })} />
          </label>
          <SlugField value={editing.slug} name={editing.name} prefix={`/produtos?${{ classes: "classe", audiences: "publico", brands: "marca" }[resource]}=`} onChange={(slug) => setEditing((cur) => cur && { ...cur, slug, slugTouched: true })} />
          {imageHint && <ImageField label="Foto na home" value={editing.imageUrl} onChange={(imageUrl) => setEditing((cur) => cur && { ...cur, imageUrl })} hint={imageHint} />}
        </fieldset>
        <Notice error={formError} />
        <div className="form-actions">
          <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setFormError(""); }}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PageHead
        title={title}
        hint={hint}
        action={<button className="btn btn-solid btn-sm" onClick={() => setEditing({ name: "", slug: "", slugTouched: false, sortOrder: items.length })}>+ {newLabel} {noun}</button>}
      />
      <Notice error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nada cadastrado ainda.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordem</th>{imageHint && <th>Foto</th>}<th>Nome</th><th>{usage.label[0]!.toUpperCase() + usage.label.slice(1)}</th>{activatable && <th>Situação</th>}<th /></tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className={item.active === false ? "is-off" : undefined}>
                  <td><MoveButtons index={i} total={items.length} onMove={(d) => run(() => reorder(items, i, d, (x) => api.admin.update(resource, x.id, body(x, !!imageHint))))} /></td>
                  {imageHint && <td><Thumb url={item.imageUrl} /></td>}
                  <td><strong>{item.name}</strong><br /><small>{item.slug}</small></td>
                  <td>{item._count?.[usage.key] ?? 0}</td>
                  {activatable && (
                    <td>
                      <span className="active-cell">
                        <RowSwitch checked={item.active !== false} label={`${item.active === false ? "Ativar" : "Desativar"} ${item.name}`} onChange={(v) => setActive(item, v)} />
                        {item.active === false ? <Badge tone="off">Desativada</Badge> : <Badge tone="ok">Ativa</Badge>}
                      </span>
                    </td>
                  )}
                  <td className="row-actions">
                    <button type="button" className="link-btn" onClick={() => setEditing({ id: item.id, name: item.name, slug: item.slug, slugTouched: true, sortOrder: item.sortOrder, imageUrl: item.imageUrl })}>Editar</button>
                    <ConfirmButton message={deleteMessage} onConfirm={() => run(() => api.admin.remove(resource, item.id))}>Excluir</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
