"use client";

import { useEffect, useState } from "react";
import { Notice, PageHead, Switch, useAdminList } from "@/components/admin/kit";
import { api } from "@/lib/api";
import type { Audience, Brand, Category, ProductClass, SiteLink, SiteSettings } from "@/types/product";

const TABS = [
  ["topo", "Topo e menu"],
  ["promo", "Faixa promocional"],
  ["beneficios", "Benefícios"],
  ["rodape", "Rodapé"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Move/remove itens de uma lista editável. */
function patchList<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}
function swap<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function RowTools({ index, total, onMove, onRemove }: { index: number; total: number; onMove: (d: -1 | 1) => void; onRemove: () => void }) {
  return (
    <span className="row-tools">
      <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
      <button type="button" aria-label="Descer" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
      <button type="button" aria-label="Remover" onClick={onRemove}>✕</button>
    </span>
  );
}

function LinkRows<T extends SiteLink>({ value, onChange, blank, listId, extra }: { value: T[]; onChange: (v: T[]) => void; blank: T; listId: string; extra?: (item: T, patch: (p: Partial<T>) => void) => React.ReactNode }) {
  return (
    <div className="rows">
      {value.map((item, i) => (
        <div key={i} className="row-edit">
          <input value={item.label} placeholder="Texto do link" aria-label="Texto do link" onChange={(e) => onChange(patchList(value, i, { label: e.target.value } as Partial<T>))} />
          <input value={item.url} placeholder="/produtos" aria-label="Endereço do link" list={listId} onChange={(e) => onChange(patchList(value, i, { url: e.target.value } as Partial<T>))} />
          {extra?.(item, (p) => onChange(patchList(value, i, p)))}
          <RowTools index={i} total={value.length} onMove={(d) => onChange(swap(value, i, d))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="link-btn" onClick={() => onChange([...value, blank])}>+ Adicionar link</button>
    </div>
  );
}

export default function ContentAdmin() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [tab, setTab] = useState<Tab>("topo");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const categories = useAdminList<Category>("categories").items;
  const classes = useAdminList<ProductClass>("classes").items;
  const audiences = useAdminList<Audience>("audiences").items;
  const brands = useAdminList<Brand>("brands").items;

  useEffect(() => {
    api.admin.getSettings().then(setS).catch((e: Error) => setError(e.message));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setOk("");
    try {
      setS(await api.admin.saveSettings(s));
      setError("");
      setOk("Alterações publicadas na loja.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const update = (patch: Partial<SiteSettings>) => {
    setOk("");
    setS((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  if (!s) return <><PageHead title="Textos e menu" /><Notice error={error} />{!error && <p>Carregando…</p>}</>;

  return (
    <>
      <PageHead title="Textos e menu" hint="Tudo o que aparece fora dos produtos: avisos do topo, menu, faixa promocional, benefícios e rodapé." />
      <datalist id="site-links">
        <option value="/produtos" />
        <option value="/conta" />
        {classes.map((c) => <option key={c.id} value={`/produtos?classe=${c.slug}`}>Classe: {c.name}</option>)}
        {categories.map((c) => <option key={c.id} value={`/produtos?categoria=${c.slug}`}>Categoria: {c.name}</option>)}
        {audiences.map((a) => <option key={a.id} value={`/produtos?publico=${a.slug}`}>Público: {a.name}</option>)}
        {brands.map((b) => <option key={b.id} value={`/produtos?marca=${b.slug}`}>Marca: {b.name}</option>)}
      </datalist>

      <div className="options admin-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`option${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="admin-form">
        {tab === "topo" && (
          <>
            <fieldset>
              <legend>Avisos da barra preta (até 4)</legend>
              <div className="span-2 rows">
                {s.topbar.map((message, i) => (
                  <div key={i} className="row-edit">
                    <input value={message} aria-label="Aviso" onChange={(e) => update({ topbar: s.topbar.map((m, j) => (j === i ? e.target.value : m)) })} />
                    <RowTools index={i} total={s.topbar.length} onMove={(d) => update({ topbar: swap(s.topbar, i, d) })} onRemove={() => update({ topbar: s.topbar.filter((_, j) => j !== i) })} />
                  </div>
                ))}
                {s.topbar.length < 4 && <button type="button" className="link-btn" onClick={() => update({ topbar: [...s.topbar, ""] })}>+ Adicionar aviso</button>}
              </div>
            </fieldset>
            <fieldset>
              <legend>Menu principal (até 10 links)</legend>
              <div className="span-2">
                <LinkRows
                  value={s.nav}
                  onChange={(nav) => update({ nav })}
                  blank={{ label: "", url: "/produtos", highlight: false }}
                  listId="site-links"
                  extra={(item, patch) => <label className="check"><input type="checkbox" checked={item.highlight} onChange={(e) => patch({ highlight: e.target.checked })} /> Destaque</label>}
                />
              </div>
            </fieldset>
          </>
        )}

        {tab === "promo" && (
          <fieldset>
            <legend>Faixa escura entre as vitrines da home</legend>
            <div className="field span-2"><Switch checked={s.promo.active} onChange={(active) => update({ promo: { ...s.promo, active } })} label={s.promo.active ? "Exibindo na home" : "Oculta"} /></div>
            <label>Chamada pequena<input value={s.promo.eyebrow} onChange={(e) => update({ promo: { ...s.promo, eyebrow: e.target.value } })} placeholder="Promoções da semana" /></label>
            <label>Título<input value={s.promo.title} onChange={(e) => update({ promo: { ...s.promo, title: e.target.value } })} placeholder="Até 30% off" /></label>
            <label>Rótulo do botão<input value={s.promo.buttonLabel} onChange={(e) => update({ promo: { ...s.promo, buttonLabel: e.target.value } })} /></label>
            <label>Link do botão<input value={s.promo.buttonUrl} list="site-links" onChange={(e) => update({ promo: { ...s.promo, buttonUrl: e.target.value } })} /></label>
          </fieldset>
        )}

        {tab === "beneficios" && (
          <fieldset>
            <legend>Faixa de benefícios no fim da home (até 6)</legend>
            <div className="span-2 rows">
              {s.benefits.map((b, i) => (
                <div key={i} className="row-edit">
                  <input value={b.title} placeholder="Frete grátis" aria-label="Título" onChange={(e) => update({ benefits: patchList(s.benefits, i, { title: e.target.value }) })} />
                  <input value={b.text} placeholder="Acima de R$ 299" aria-label="Texto" onChange={(e) => update({ benefits: patchList(s.benefits, i, { text: e.target.value }) })} />
                  <RowTools index={i} total={s.benefits.length} onMove={(d) => update({ benefits: swap(s.benefits, i, d) })} onRemove={() => update({ benefits: s.benefits.filter((_, j) => j !== i) })} />
                </div>
              ))}
              {s.benefits.length < 6 && <button type="button" className="link-btn" onClick={() => update({ benefits: [...s.benefits, { title: "", text: "" }] })}>+ Adicionar benefício</button>}
            </div>
          </fieldset>
        )}

        {tab === "rodape" && (
          <>
            <fieldset>
              <legend>Dados da loja</legend>
              <label>Título do bloco<input value={s.footer.storeTitle} onChange={(e) => update({ footer: { ...s.footer, storeTitle: e.target.value } })} /></label>
              <label>Endereço<input value={s.footer.address} onChange={(e) => update({ footer: { ...s.footer, address: e.target.value } })} /></label>
              <label>Telefone / WhatsApp<input value={s.footer.phone} onChange={(e) => update({ footer: { ...s.footer, phone: e.target.value } })} /></label>
              <label>Horário de atendimento<input value={s.footer.hours} onChange={(e) => update({ footer: { ...s.footer, hours: e.target.value } })} /></label>
              <label>CNPJ<input value={s.footer.cnpj} onChange={(e) => update({ footer: { ...s.footer, cnpj: e.target.value } })} /></label>
              <label>Formas de pagamento (linha inferior)<input value={s.footer.payments} onChange={(e) => update({ footer: { ...s.footer, payments: e.target.value } })} /></label>
            </fieldset>
            {s.footer.columns.map((column, ci) => (
              <fieldset key={ci}>
                <legend>Coluna de links {ci + 1}</legend>
                <label className="span-2">Título da coluna
                  <input value={column.title} onChange={(e) => update({ footer: { ...s.footer, columns: patchList(s.footer.columns, ci, { title: e.target.value }) } })} />
                </label>
                <div className="span-2">
                  <LinkRows
                    value={column.links}
                    onChange={(links) => update({ footer: { ...s.footer, columns: patchList(s.footer.columns, ci, { links }) } })}
                    blank={{ label: "", url: "/produtos" }}
                    listId="site-links"
                  />
                </div>
                <button type="button" className="link-btn danger" onClick={() => update({ footer: { ...s.footer, columns: s.footer.columns.filter((_, j) => j !== ci) } })}>Remover esta coluna</button>
              </fieldset>
            ))}
            {s.footer.columns.length < 4 && (
              <button type="button" className="link-btn" onClick={() => update({ footer: { ...s.footer, columns: [...s.footer.columns, { title: "", links: [] }] } })}>+ Adicionar coluna de links</button>
            )}
          </>
        )}

        <Notice error={error} ok={ok} />
        <div className="form-actions">
          <button type="button" className="btn btn-solid btn-sm" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Publicar alterações"}</button>
        </div>
      </div>
    </>
  );
}
