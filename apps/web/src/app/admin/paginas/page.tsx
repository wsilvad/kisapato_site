"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, Notice, PageHead } from "@/components/admin/kit";
import { PagePhotos } from "@/components/admin/PagePhotos";
import { api } from "@/lib/api";
import type { SiteSettings } from "@/types/product";

type Page = SiteSettings["pages"][number];

/** Dicas por página: o que aparece além do texto. */
const EXTRA: Record<string, string> = {
  "quem-somos": "Página editorial: se o texto começar por uma foto, ela vira o topo; o 1º parágrafo vira a frase de destaque e cada “## Rótulo | Título” abre uma seção.",
  "politicas-de-entrega": "Mostra também a tabela de valores e prazos de Textos e menu → Frete.",
  "fale-conosco": "Mostra também o endereço, telefone, horário e redes sociais de Textos e menu → Rodapé e Topo.",
  "nossas-lojas": "Mostra também o endereço, telefone, horário e CNPJ de Textos e menu → Rodapé.",
  "perguntas-frequentes": "Cada linha que começa com “## ” é uma pergunta (item suspenso); o texto logo abaixo dela é a resposta.",
};

/**
 * Edição das páginas do site (Sobre, trocas, política de privacidade, perguntas frequentes…). Só edita as que já existem:
 * não há como criar nem excluir páginas, porque cada uma tem um endereço e um lugar fixos no site.
 */
export default function PagesAdmin() {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [editing, setEditing] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.admin.pages().then(setPages).catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function save(page: Page) {
    setSaving(true);
    setOk("");
    try {
      // grava só esta página (título e texto); o resto do site fica como está
      const saved = await api.admin.savePage(page.slug, { title: page.title.trim() || page.slug, body: page.body });
      setPages((list) => (list ?? []).map((p) => (p.slug === saved.slug ? saved : p)));
      setEditing(null);
      setError("");
      setOk(`Página “${page.title.trim() || page.slug}” publicada na loja.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!pages) return <><PageHead title="Páginas" /><Notice error={error} />{!error && <p>Carregando…</p>}</>;

  if (editing) {
    const page = editing;
    const set = (patch: Partial<Page>) => setEditing({ ...page, ...patch });
    return (
      <form className="admin-form" onSubmit={(e) => (e.preventDefault(), void save(page))}>
        <PageHead title={`Editar página: ${page.title || page.slug}`} action={<button type="button" className="link-btn" onClick={() => (setEditing(null), setError(""))}>← Voltar à lista</button>} />
        <fieldset>
          <legend>Conteúdo</legend>
          <label className="span-2">Título<input value={page.title} required maxLength={80} onChange={(e) => set({ title: e.target.value })} /></label>
          <p className="span-2 field-hint">Endereço: <strong>/institucional/{page.slug}</strong> (fixo). {EXTRA[page.slug] ?? ""}</p>
          <label className="span-2">Texto
            <textarea rows={16} value={page.body} onChange={(e) => set({ body: e.target.value })} />
            <small>Separe os parágrafos com uma linha em branco; comece a linha com “## ” para um subtítulo e com “- ” para um item de lista. Página sem texto fica fora do ar e some do rodapé.</small>
          </label>
          <PagePhotos body={page.body} heroHint={page.slug === "quem-somos"} onChange={(body) => set({ body })} />
        </fieldset>
        <Notice error={error} />
        <div className="form-actions">
          <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : "Salvar e publicar"}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => (setEditing(null), setError(""))}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <PageHead title="Páginas" hint="Edite os textos e as fotos das páginas do site (Sobre, políticas, perguntas frequentes…). As páginas são fixas: dá para editar, mas não criar nem excluir." />
      <Notice error={error} ok={ok} />
      {pages.length === 0 ? (
        <EmptyState>Nenhuma página cadastrada.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Página</th><th>Endereço</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const live = p.body.trim().length > 0;
                return (
                  <tr key={p.slug} className={live ? undefined : "is-off"}>
                    <td><strong>{p.title}</strong></td>
                    <td><small>/institucional/{p.slug}</small></td>
                    <td>{live ? <Badge tone="ok">No ar</Badge> : <Badge tone="off">Sem texto (fora do ar)</Badge>}</td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => (setEditing(p), setOk(""), setError(""))}>Editar</button>
                      {live && <a href={`/institucional/${p.slug}`} target="_blank" rel="noopener noreferrer" className="link-btn">Ver ↗</a>}
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
