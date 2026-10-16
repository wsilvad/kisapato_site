"use client";

import { useEffect, useState } from "react";
import { Notice, PageHead, Switch, useAdminList } from "@/components/admin/kit";
import { PAYMENT_ICONS, PaymentIcon } from "@/components/PaymentIcons";
import { api } from "@/lib/api";
import { audienceHref } from "@/lib/segment";
import type { Audience, Brand, Category, ProductClass, SiteLink, SiteSettings } from "@/types/product";

const TABS = [
  ["topo", "Topo e menu"],
  ["promo", "Faixa promocional"],
  ["beneficios", "Benefícios"],
  ["rodape", "Rodapé"],
  ["paginas", "Páginas"],
  ["frete", "Frete"],
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

/** Lista de estados (UF) digitada à mão: guarda o texto enquanto a pessoa digita e entrega a lista já limpa. */
function StatesInput({ value, onChange }: { value: string[]; onChange: (states: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      value={text}
      placeholder="RS, SC, PR"
      aria-label="Estados (siglas separadas por vírgula)"
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean));
      }}
    />
  );
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
        {audiences.map((a) => <option key={a.id} value={audienceHref(a)}>Público: {a.name}</option>)}
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
              <legend>Redes sociais (ícones no rodapé e no menu do celular)</legend>
              {([["instagram", "Instagram", "https://www.instagram.com/kisapato"], ["facebook", "Facebook", "https://www.facebook.com/kisapato"], ["pinterest", "Pinterest", "https://br.pinterest.com/kisapato"], ["tiktok", "TikTok", "https://www.tiktok.com/@kisapato"]] as const).map(([key, label, example]) => (
                <label key={key}>{label}
                  <input type="url" value={s.social[key]} placeholder={example} onChange={(e) => update({ social: { ...s.social, [key]: e.target.value } })} />
                </label>
              ))}
              <small className="span-2 field-hint">Só aparecem os ícones das redes com endereço preenchido.</small>
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
              <label>Endereço<input value={s.footer.address} onChange={(e) => update({ footer: { ...s.footer, address: e.target.value } })} /></label>
              <label>Telefone / WhatsApp<input value={s.footer.phone} onChange={(e) => update({ footer: { ...s.footer, phone: e.target.value } })} /></label>
              <label>Horário de atendimento<input value={s.footer.hours} onChange={(e) => update({ footer: { ...s.footer, hours: e.target.value } })} /></label>
              <label>CNPJ<input value={s.footer.cnpj} onChange={(e) => update({ footer: { ...s.footer, cnpj: e.target.value } })} /></label>
            </fieldset>
            <fieldset>
              <legend>Formas de pagamento (logos no rodapé)</legend>
              <div className="span-2 pay-pick">
                {Object.entries(PAYMENT_ICONS).map(([key, icon]) => {
                  const on = (s.footer.paymentMethods ?? []).includes(key);
                  return (
                    <label key={key} className={`pay-option${on ? " is-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          update({
                            footer: {
                              ...s.footer,
                              // Mantém sempre a ordem padrão das bandeiras.
                              paymentMethods: Object.keys(PAYMENT_ICONS).filter((k) => (k === key ? !on : (s.footer.paymentMethods ?? []).includes(k))),
                            },
                          })
                        }
                      />
                      <PaymentIcon method={key} />
                      <span>{icon.label}</span>
                    </label>
                  );
                })}
              </div>
              <small className="span-2 field-hint">Marque as bandeiras e meios aceitos pela loja; nenhuma marcada esconde o bloco.</small>
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

        {tab === "paginas" && (
          <>
            <p className="field-hint">
              Páginas do rodapé (em /institucional/…). Separe os parágrafos com uma linha em branco; comece a linha com
              &quot;## &quot; para um subtítulo e com &quot;- &quot; para um item de lista. Página sem texto fica fora do ar e some do rodapé.
              Políticas de entrega mostra também a tabela da aba Frete.
            </p>
            {(s.pages ?? []).map((page, i) => (
              <fieldset key={page.slug}>
                <legend>
                  {page.title || page.slug}{" "}
                  {page.body.trim() ? (
                    <a href={`/institucional/${page.slug}`} target="_blank" rel="noopener noreferrer" className="link-btn">ver página ↗</a>
                  ) : (
                    <small>(fora do ar: sem texto)</small>
                  )}
                </legend>
                <label className="span-2">Título<input value={page.title} onChange={(e) => update({ pages: patchList(s.pages, i, { title: e.target.value }) })} /></label>
                <label className="span-2">Texto<textarea rows={10} value={page.body} onChange={(e) => update({ pages: patchList(s.pages, i, { body: e.target.value }) })} /></label>
              </fieldset>
            ))}
          </>
        )}

        {tab === "frete" && (
          <>
            <fieldset>
              <legend>Regras gerais</legend>
              <label>Frete grátis acima de (R$)
                <input type="number" min="0" step="0.01" value={s.shipping.freeAbove} onChange={(e) => update({ shipping: { ...s.shipping, freeAbove: Number(e.target.value) } })} />
                <small>Use 0 para não oferecer frete grátis. Vale para o valor dos produtos.</small>
              </label>
              <div className="field">
                <Switch checked={s.shipping.pickup.active} onChange={(active) => update({ shipping: { ...s.shipping, pickup: { ...s.shipping.pickup, active } } })} label={s.shipping.pickup.active ? "Oferecer retirada na loja" : "Retirada na loja desligada"} />
              </div>
              <label>Nome da retirada<input value={s.shipping.pickup.label} onChange={(e) => update({ shipping: { ...s.shipping, pickup: { ...s.shipping.pickup, label: e.target.value } } })} /></label>
              <label>Aviso da retirada<input value={s.shipping.pickup.note} onChange={(e) => update({ shipping: { ...s.shipping, pickup: { ...s.shipping.pickup, note: e.target.value } } })} placeholder="Sem custo. Avisamos quando estiver pronto." /></label>
            </fieldset>
            <fieldset>
              <legend>Valor e prazo por região (até 12)</legend>
              <p className="span-2 admin-hint">
                O cliente digita o CEP na página do produto e vê o valor e o prazo da região do estado dele. Estados fora destas regiões só veem a retirada na loja.
                Os valores iniciais são exemplos: ajuste conforme o contrato com a sua transportadora. Os prazos contam em dias úteis.
              </p>
              <div className="span-2 rows">
                {s.shipping.regions.map((r, i) => (
                  <div key={i} className="ship-region">
                    <label>Região<input value={r.name} onChange={(e) => update({ shipping: { ...s.shipping, regions: patchList(s.shipping.regions, i, { name: e.target.value }) } })} placeholder="Sudeste" /></label>
                    <label>Estados<StatesInput value={r.states} onChange={(states) => update({ shipping: { ...s.shipping, regions: patchList(s.shipping.regions, i, { states }) } })} /></label>
                    <label>Valor (R$)<input type="number" min="0" step="0.01" value={r.price} onChange={(e) => update({ shipping: { ...s.shipping, regions: patchList(s.shipping.regions, i, { price: Number(e.target.value) }) } })} /></label>
                    <label>Prazo mín.<input type="number" min="0" value={r.minDays} onChange={(e) => update({ shipping: { ...s.shipping, regions: patchList(s.shipping.regions, i, { minDays: Number(e.target.value) }) } })} /></label>
                    <label>Prazo máx.<input type="number" min="0" value={r.maxDays} onChange={(e) => update({ shipping: { ...s.shipping, regions: patchList(s.shipping.regions, i, { maxDays: Number(e.target.value) }) } })} /></label>
                    <RowTools index={i} total={s.shipping.regions.length} onMove={(d) => update({ shipping: { ...s.shipping, regions: swap(s.shipping.regions, i, d) } })} onRemove={() => update({ shipping: { ...s.shipping, regions: s.shipping.regions.filter((_, j) => j !== i) } })} />
                  </div>
                ))}
                {s.shipping.regions.length < 12 && (
                  <button type="button" className="link-btn" onClick={() => update({ shipping: { ...s.shipping, regions: [...s.shipping.regions, { name: "", states: [], price: 0, minDays: 3, maxDays: 7 }] } })}>+ Adicionar região</button>
                )}
              </div>
            </fieldset>
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
