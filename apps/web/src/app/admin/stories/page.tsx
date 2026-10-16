"use client";

import { useState } from "react";
import { Badge, ConfirmButton, EmptyState, MediaField, MoveButtons, Notice, PageHead, RowSwitch, Switch, reorder, useAdminList } from "@/components/admin/kit";
import { api, assetUrl } from "@/lib/api";
import { isVideoUrl } from "@/lib/media";
import type { Product, Story } from "@/types/product";

interface FormState {
  id?: string;
  title: string;
  mediaUrl: string | null;
  linkUrl: string;
  sortOrder: number;
  active: boolean;
}

const body = (f: FormState) => ({ title: f.title.trim() || null, mediaUrl: f.mediaUrl ?? "", linkUrl: f.linkUrl.trim() || null, sortOrder: f.sortOrder, active: f.active });
const fromStory = (s: Story): FormState => ({ id: s.id, title: s.title ?? "", mediaUrl: s.mediaUrl, linkUrl: s.linkUrl ?? "", sortOrder: s.sortOrder, active: s.active });

export default function StoriesAdmin() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Story>("stories");
  const products = useAdminList<Product>("products").items;
  const [form, setForm] = useState<FormState | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function setActive(story: Story, active: boolean) {
    setItems((list) => list.map((x) => (x.id === story.id ? { ...x, active } : x)));
    try {
      await api.admin.setActive("stories", story.id, active);
      setError("");
    } catch (e) {
      await reload();
      setError((e as Error).message);
    }
  }

  if (form) {
    return (
      <StoryForm
        initial={form}
        products={products}
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
        title="Stories (GIFs na home)"
        hint="Cartões verticais em movimento (vídeo ou GIF), em fila logo abaixo do banner da home, no estilo dos stories do Instagram. Cada um leva a um produto ou a uma página da loja."
        action={<button className="btn btn-solid btn-sm" onClick={() => setForm({ title: "", mediaUrl: null, linkUrl: "", sortOrder: items.length, active: true })}>+ Novo story</button>}
      />
      <Notice error={error} />
      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState>Nenhum story. Sem stories, a faixa não aparece na home.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordem</th><th>Cartão</th><th>Legenda e link</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={s.id} className={s.active ? undefined : "is-off"}>
                  <td><MoveButtons index={i} total={items.length} onMove={(d) => run(() => reorder(items, i, d, (x) => api.admin.update("stories", x.id, body(fromStory(x)))))} /></td>
                  <td>
                    {isVideoUrl(s.mediaUrl) ? (
                      <video className="story-thumb" src={assetUrl(s.mediaUrl)} muted loop autoPlay playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="story-thumb" src={assetUrl(s.mediaUrl)} alt="" />
                    )}
                  </td>
                  <td><strong>{s.title || <small>(sem legenda)</small>}</strong><br /><small>{s.linkUrl || "Sem link: o cartão não é clicável"}</small></td>
                  <td>
                    <span className="active-cell">
                      <RowSwitch checked={s.active} label={`${s.active ? "Desativar" : "Ativar"} story`} onChange={(v) => setActive(s, v)} />
                      {s.active ? <Badge tone="ok">Ativo</Badge> : <Badge tone="off">Desativado</Badge>}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button type="button" className="link-btn" onClick={() => setForm(fromStory(s))}>Editar</button>
                    <ConfirmButton message="Excluir story?" onConfirm={() => run(() => api.admin.remove("stories", s.id))}>Excluir</ConfirmButton>
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

function StoryForm({ initial, products, onCancel, onSaved }: { initial: FormState; products: Product[]; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.mediaUrl) return setError("Envie o vídeo, o GIF ou a foto do cartão.");
    setSaving(true);
    try {
      if (f.id) await api.admin.update("stories", f.id, body(f));
      else await api.admin.create("stories", body(f));
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <PageHead title={f.id ? "Editar story" : "Novo story"} action={<button type="button" className="link-btn" onClick={onCancel}>← Voltar à lista</button>} />
      <datalist id="story-links">
        <option value="/produtos" />
        <option value="/produtos?selo=lancamento">Lançamentos</option>
        <option value="/produtos?selo=promocao">Promoções</option>
        {products.map((p) => <option key={p.id} value={`/produtos/${p.slug}`}>Produto: {p.name}</option>)}
      </datalist>
      <fieldset>
        <legend>Cartão</legend>
        <div className="span-2">
          <MediaField
            label="Vídeo, GIF ou foto"
            value={f.mediaUrl}
            onChange={(mediaUrl) => setF({ ...f, mediaUrl })}
            hint="Até 15 MB. Vídeo: MP4 (H.264), WebM ou MOV; toca sozinho, sem som e em repetição. GIF: é convertido para um formato mais leve, mantendo a animação. Formato vertical 2:3 (ex.: 600 × 900 px) é o que melhor preenche o cartão."
          />
        </div>
        <label>Legenda (opcional)<input value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Bota Couro Trail" /></label>
        <label>Link ao clicar (opcional)
          <input value={f.linkUrl} list="story-links" onChange={(e) => setF({ ...f, linkUrl: e.target.value })} placeholder="/produtos/bota-couro-trail" />
          <small>Comece a digitar o nome do produto para escolher na lista, ou informe qualquer endereço da loja.</small>
        </label>
        <div className="field"><Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label={f.active ? "Ativo" : "Desativado"} /></div>
      </fieldset>
      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar story"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
