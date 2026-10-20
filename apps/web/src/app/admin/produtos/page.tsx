"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, ConfirmButton, EmptyState, ImageGallery, Notice, PageHead, RowSwitch, SearchSelect, SlugField, Switch, slugify, useAdminList, Thumb, type SearchOption } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { useErpRefresh } from "@/lib/erp-refresh";
import { formatPrice } from "@/lib/format";
import { AGE_GROUP_LABEL, GENDER_LABEL, KIDS_GENDER_LABEL, segmentLabel, type AgeGroup, type Gender } from "@/lib/segment";
import { hiddenReason } from "@/lib/visibility";
import { BADGE_LABEL, type BadgeKey, type Brand, type Category, type ErpIssue, type ErpRefreshStatus, type Product, type ProductClass } from "@/types/product";

/** Numeração de uma cor: estoque próprio e SKU (vazio = automático). */
interface SizeRow {
  /** Numeração (34, 35…); vazio quando a grade é de confecção. */
  size: string;
  /** Tamanho da grade de confecção ("P", "Único"…); vazio na numeração. */
  label: string;
  stock: string;
  sku: string;
}

/** Grade de confecção: a ordem é a de exibição (Único primeiro). */
const CLOTHING_OPTIONS = ["Único", "PP", "P", "M", "G", "GG", "XG", "XGG"] as const;
const CLOTHING_ORDER: Record<string, number> = { Único: 0, PP: 1, P: 2, M: 3, G: 4, GG: 5, XG: 6, XGG: 7 };
/** Digitado livremente ("p", "unico", "u") → rótulo da grade. */
const clothingLabelOf = (text: string) => {
  const t = text.trim().toUpperCase();
  if (t === "U" || t === "ÚNICO" || t === "UNICO" || t === "ÚNICA" || t === "UNICA") return "Único";
  return (CLOTHING_OPTIONS as readonly string[]).includes(t === "Único" ? "Único" : t) ? (t === "UNICO" ? "Único" : t) : "";
};

/** Um item por cor (o "filho" do produto): nome, até 4 fotos e o estoque de cada numeração. */
interface ColorItem {
  uid: string;
  color: string;
  images: string[];
  /** Preço próprio da cor e o "de" riscado (vazio = vale o preço do produto). */
  price: string;
  compareAtPrice: string;
  /** À venda na loja. Desabilitada some da loja e não tem estoque vendável. */
  active: boolean;
  /** Cor do ERP que o ERP não marca para o site: não pode ser habilitada aqui (só o ERP religa). */
  erpLocked: boolean;
  sizes: SizeRow[];
}

interface FormState {
  id?: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  brandId: string;
  ageGroup: AgeGroup;
  gender: Gender;
  reference: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  badge: string;
  active: boolean;
  description: string;
  careInstructions: string;
  images: string[];
  /** Cores do produto, na ordem da loja: a primeira é a que a página do produto abre. */
  items: ColorItem[];
  /** Nome do ERP (somente leitura; vem da sincronização). */
  erpName: string;
  /** Tipo de grade das numerações: numeração (34, 35…) ou confecção (P, M, G, Único…). */
  sizeScheme: "NUMERACAO" | "CONFECCAO";
}

/** Quantas fotos cada cor aceita. */
const MAX_COLOR_PHOTOS = 4;

let uidSeq = 0;
const newUid = () => `cor-${Date.now().toString(36)}-${uidSeq++}`;

const stockOf = (item: ColorItem) => item.sizes.reduce((sum, r) => sum + (Number(r.stock) || 0), 0);

const EMPTY: FormState = {
  name: "", slug: "", slugTouched: false, brandId: "", ageGroup: "ADULTO", gender: "UNISSEX", reference: "", categoryId: "", price: "",
  compareAtPrice: "", costPrice: "", badge: "", active: true, description: "", careInstructions: "", images: [], items: [], erpName: "", sizeScheme: "NUMERACAO",
};

/** SKU automático: slug do produto + cor + numeração (ex.: bota-couro-trail-marrom-40). */
const autoSku = (slug: string, color: string, size: string) => [slug, slugify(color), size.trim()].filter(Boolean).join("-");
/** `sku` vazio na linha significa "automático"; qualquer valor digitado é um código próprio. */
const skuOf = (slug: string, color: string, row: SizeRow) => row.sku.trim() || autoSku(slug, color, row.size);

function fromProduct(p: Product): FormState {
  return {
    id: p.id, name: p.name, slug: p.slug, slugTouched: true, brandId: p.brandId ?? p.brand?.id ?? "", ageGroup: p.ageGroup ?? "ADULTO", gender: p.gender ?? "UNISSEX", reference: p.reference ?? "",
    categoryId: p.categoryId ?? p.category.id, price: p.price, compareAtPrice: p.compareAtPrice ?? "", costPrice: p.costPrice ?? "", badge: p.badge ?? "",
    active: p.active ?? true, description: p.description ?? "", careInstructions: p.careInstructions ?? "", images: p.images,
    items: itemsFromProduct(p),
    erpName: p.erpName ?? "",
    sizeScheme: p.sizeScheme ?? "NUMERACAO",
  };
}

/** Agrupa as variações por cor, na ordem da loja (cores cadastradas primeiro), com as fotos de cada cor. */
function itemsFromProduct(p: Product): ColorItem[] {
  const variants = p.variants ?? [];
  const names = [...(p.colors ?? []).map((c) => c.name)];
  for (const v of variants) if (!names.includes(v.color)) names.push(v.color);
  return names.map((name) => ({
    uid: newUid(),
    color: name,
    images: (p.colors ?? []).find((c) => c.name === name)?.images ?? [],
    price: (p.colors ?? []).find((c) => c.name === name)?.price ?? "",
    compareAtPrice: (p.colors ?? []).find((c) => c.name === name)?.compareAtPrice ?? "",
    active: (p.colors ?? []).find((c) => c.name === name)?.active !== false,
    erpLocked: (() => {
      const c = (p.colors ?? []).find((x) => x.name === name);
      return !!c?.erpItemCode && c.erpFlagged === false;
    })(),
    sizes: variants
      .filter((v) => v.color === name)
      .map((v) => ({ size: v.sizeLabel ? "" : String(v.size), label: v.sizeLabel ?? "", stock: String(v.stock), sku: v.sku === autoSku(p.slug, v.color, v.sizeLabel ?? String(v.size)) ? "" : v.sku }))
      .sort((a, b) => (a.label ? CLOTHING_ORDER[a.label] ?? 0 : Number(a.size)) - (b.label ? CLOTHING_ORDER[b.label] ?? 0 : Number(b.size))),
  }));
}

/** Corpo aceito pela API (PUT/POST /admin/products). */
function toBody(f: FormState) {
  return {
    name: f.name.trim(), slug: f.slug, brandId: f.brandId || null, ageGroup: f.ageGroup, gender: f.gender, reference: f.reference.trim() || null,
    description: f.description.trim() || null, careInstructions: f.careInstructions.trim() || null,
    price: f.price, compareAtPrice: f.compareAtPrice || null, costPrice: f.costPrice || null, badge: f.badge || null, images: f.images, active: f.active, categoryId: f.categoryId,
    sizeScheme: f.sizeScheme,
    variants: f.items.flatMap((it) =>
      it.sizes.map((r) => {
        const confeccao = f.sizeScheme === "CONFECCAO";
        const color = it.color.trim();
        return {
          color,
          size: confeccao ? CLOTHING_ORDER[r.label] ?? 0 : Number(r.size),
          sizeLabel: confeccao ? r.label : null,
          stock: Number(r.stock) || 0,
          sku: skuOf(f.slug, color, { ...r, size: confeccao ? r.label : r.size }),
        };
      }),
    ),
    colors: f.items.map((it) => ({ name: it.color.trim(), active: it.active, images: it.images.slice(0, MAX_COLOR_PHOTOS), price: it.price || null, compareAtPrice: it.price ? it.compareAtPrice || null : null })),
  };
}

function validate(f: FormState): string {
  if (!f.name.trim()) return "Informe o nome do produto.";
  if (!f.slug) return "O endereço (slug) não pode ficar vazio.";
  if (!f.categoryId) return "Escolha uma categoria.";
  if (!(Number(f.price) >= 0) || f.price === "") return "Informe o preço.";
  if (f.costPrice && !(Number(f.costPrice) >= 0)) return "O custo não pode ser negativo.";
  if (f.compareAtPrice && Number(f.compareAtPrice) <= Number(f.price)) return 'O preço "de" deve ser maior que o preço atual.';
  const colors = new Set<string>();
  for (const it of f.items) {
    const color = it.color.trim();
    if (!color) return "Toda cor precisa de um nome.";
    if (colors.has(color.toLowerCase())) return `Cor repetida: ${color}.`;
    colors.add(color.toLowerCase());
    if (it.sizes.length === 0) return `Adicione ao menos uma numeração à cor ${color}.`;
    if (it.price && !(Number(it.price) >= 0)) return `O preço da cor ${color} é inválido.`;
    if (it.price && it.compareAtPrice && Number(it.compareAtPrice) <= Number(it.price)) return `Na cor ${color}, o preço "de" deve ser maior que o preço da cor.`;
    const sizes = new Set<number>();
    for (const r of it.sizes) {
      if (f.sizeScheme === "CONFECCAO") {
        if (!r.label) return `Escolha o tamanho (P, M, G, Único…) em todas as linhas da cor ${color}.`;
        if (sizes.has(CLOTHING_ORDER[r.label] ?? -1)) return `Tamanho repetido na cor ${color}: ${r.label}.`;
        sizes.add(CLOTHING_ORDER[r.label] ?? -1);
      } else {
        if (!(Number(r.size) > 0)) return `Toda numeração da cor ${color} precisa de um número.`;
        if (sizes.has(Number(r.size))) return `Numeração repetida na cor ${color}: ${r.size}.`;
        sizes.add(Number(r.size));
      }
    }
  }
  const skus = new Set<string>();
  for (const it of f.items) {
    for (const r of it.sizes) {
      const sku = skuOf(f.slug, it.color.trim(), r).toLowerCase();
      if (skus.has(sku)) return `SKU repetido: ${sku}. Cada numeração precisa de um código diferente.`;
      skus.add(sku);
    }
  }
  return "";
}

/** Triângulo de aviso (o mesmo do ícone das linhas). */
function IssueGlyph() {
  return <svg className="issue-glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" fill="currentColor" /><path d="M12 10v5M12 17.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>;
}

/** Ícone de aviso com o motivo da pendência da importação (aparece ao passar o mouse ou ao focar com o teclado). */
function IssueIcon({ reason }: { reason: string }) {
  const lines = reason.split("\n");
  return (
    <span className="issue-icon" tabIndex={0} role="img" aria-label={`Problema na importação do ERP: ${lines.join(" ")}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z" fill="currentColor" /><path d="M12 10v5M12 17.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
      <span className="issue-tip" role="tooltip">{lines.map((l, i) => <span key={i}>{l}</span>)}</span>
    </span>
  );
}

const DISMISSED_KEY = "ki-sapato:erp-refresh-dismissed";
const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const duration = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

/**
 * Janela da atualização com o ERP: enquanto roda, a barra com o % e a etapa (continua depois de recarregar a página, porque a
 * tarefa roda na API); ao terminar, o resultado com os números e o que entrou, mudou, foi criado ou ficou pendente.
 */
function ErpRefreshPanel({ status, onClose, onShowIssues }: { status: ErpRefreshStatus; onClose: () => void; onShowIssues: () => void }) {
  if (status.running) {
    return (
      <div className="erp-panel" role="status" aria-live="polite">
        <div className="erp-panel-head">
          <strong>Atualizando com o ERP… {status.percent}%</strong>
          <span className="muted">{status.label}</span>
        </div>
        <div className="erp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent} aria-label="Andamento da atualização">
          <span style={{ width: `${status.percent}%` }} />
        </div>
        <p className="muted">Pode continuar usando o painel ou recarregar a página: a atualização segue na API e avisamos quando terminar.</p>
      </div>
    );
  }
  if (status.phase === "failed") {
    return (
      <div className="erp-panel is-error" role="alert">
        <div className="erp-panel-head">
          <strong>A atualização com o ERP falhou</strong>
          <button type="button" className="link-btn" onClick={onClose}>Fechar</button>
        </div>
        <p>{status.error}</p>
      </div>
    );
  }
  const r = status.report;
  if (!r) return null;
  const made = r.catalogCreated;
  const madeList = [
    made.brands.length > 0 && `marcas: ${made.brands.join(", ")}`,
    made.classes.length > 0 && `classes: ${made.classes.join(", ")}`,
    made.categories.length > 0 && `categorias: ${made.categories.join(", ")}`,
  ].filter(Boolean);
  const unread = r.needsReview.filter((n) => n.reference === "—"); // falha ao ler uma marca: não vira pendência, só aparece aqui
  const stats: [string, number][] = [
    ["Itens marcados no ERP", r.flaggedItems],
    ["Produtos conferidos", r.productsChecked],
    ["Novos", r.created.length],
    ["Alterados", r.updated.length],
    ["Sem mudança", r.unchanged],
    ["Pendências", r.attention],
  ];
  return (
    <div className="erp-panel" role="status">
      <div className="erp-panel-head">
        <strong>Atualização com o ERP concluída</strong>
        <span className="muted">
          {new Date(r.finishedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {duration(r.durationMs)}
        </span>
        <button type="button" className="link-btn" onClick={onClose}>Fechar</button>
      </div>
      <dl className="erp-stats">
        {stats.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {r.created.length > 0 && (
        <details open>
          <summary><strong>{plural(r.created.length, "produto novo", "produtos novos")}</strong>: entram desativados; envie as fotos e a descrição e depois ative.</summary>
          <ul>{r.created.map((c) => <li key={c.reference + c.name}>{c.name} <span className="muted">({c.reference} · {plural(c.colors, "cor", "cores")})</span></li>)}</ul>
        </details>
      )}
      {r.updated.length > 0 && (
        <details>
          <summary><strong>{plural(r.updated.length, "produto alterado", "produtos alterados")}</strong></summary>
          <ul>
            {r.updated.map((u) => (
              <li key={u.reference + u.name}>
                {u.name} <span className="muted">({u.reference})</span>:{" "}
                {[
                  u.priceChanged && "preço",
                  u.newColors > 0 && plural(u.newColors, "cor nova", "cores novas"),
                  u.disabledColors.length > 0 && `${plural(u.disabledColors.length, "cor desabilitada", "cores desabilitadas")} (${u.disabledColors.join(", ")}): o ERP não marca mais para o site`,
                  u.enabledColors.length > 0 && `${plural(u.enabledColors.length, "cor habilitada", "cores habilitadas")} (${u.enabledColors.join(", ")})`,
                  u.stockChanges > 0 && `estoque em ${plural(u.stockChanges, "numeração", "numerações")}`,
                ].filter(Boolean).join("; ") || "dados do ERP"}
              </li>
            ))}
          </ul>
        </details>
      )}
      {madeList.length > 0 && <p><strong>Cadastros criados automaticamente</strong> ({madeList.join("; ")}). Ajuste os nomes em Marcas e Categorias, se quiser.</p>}
      {r.attention > 0 && (
        <p>
          <strong>{plural(r.attention, "produto precisa", "produtos precisam")} da sua atenção</strong>
          {r.newIssues > 0 && <> ({plural(r.newIssues, "nova nesta atualização", "novas nesta atualização")})</>}.{" "}
          <button type="button" className="link-btn" onClick={onShowIssues}>Ver quais são</button>
        </p>
      )}
      {unread.length > 0 && <ul>{unread.map((n, i) => <li key={i}>{n.brand}: {n.reason}</li>)}</ul>}
    </div>
  );
}

export default function ProductsAdmin() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Product>("products");
  const categoryList = useAdminList<Category>("categories");
  const brandList = useAdminList<Brand>("brands");
  const classes = useAdminList<ProductClass>("classes").items;
  const categories = categoryList.items;
  const [form, setForm] = useState<FormState | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");
  const erp = useErpRefresh();
  const refreshing = erp.status?.running ?? false;
  // resultado já fechado (guardado por navegador, para não reaparecer a cada visita)
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);
  const [issues, setIssues] = useState<ErpIssue[]>([]);
  const [attentionPicked, setAttention] = useState(false);

  const loadIssues = () => api.admin.erpIssues().then(setIssues, () => setIssues([]));
  useEffect(() => {
    void loadIssues();
  }, []);
  // sem pendências, o filtro de atenção não tem o que mostrar
  const attention = attentionPicked && issues.length > 0;

  /** Busca no ERP os itens marcados para o site e confere os já importados; roda na API e a tela acompanha o andamento. */
  async function refreshFromErp() {
    setError("");
    try {
      await erp.start();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ao terminar: recarrega a lista e as pendências; com produtos novos (nascem desativados), leva a lista até eles
  const { onFinish } = erp;
  useEffect(
    () =>
      onFinish((s) => {
        void Promise.all([reload(), loadIssues()]);
        if ((s.report?.created.length ?? 0) > 0) setStatus("inactive");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload/loadIssues mudam a cada render; a inscrição vale a vida da página
    [onFinish],
  );
  const panelKey = erp.status?.finishedAt ?? "";
  const showPanel = !!erp.status && (erp.status.running || ((erp.status.phase === "done" || erp.status.phase === "failed") && panelKey !== dismissed));
  function closePanel() {
    setDismissed(panelKey);
    try {
      window.localStorage.setItem(DISMISSED_KEY, panelKey);
    } catch {
      /* sem armazenamento: fecha só nesta visita */
    }
  }

  const issueOf = useMemo(() => new Map(issues.filter((i) => i.productId).map((i) => [i.productId!, i])), [issues]);
  const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const visible = useMemo(
    () =>
      items.filter(
        (p) =>
          (attention ? issueOf.has(p.id) : status === "all" || (status === "active") === (p.active ?? true)) &&
          matches(`${p.name} ${p.reference ?? ""} ${p.brand?.name ?? ""} ${p.category.name}`),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matches depende só de query
    [items, query, status, attention, issueOf],
  );
  /** Pendências sem produto no site (não importados): entram como linhas próprias quando o filtro de atenção está ligado. */
  const missing = attention ? issues.filter((i) => !(i.productId && items.some((p) => p.id === i.productId)) && matches(`${i.brandName} ${i.ref} ${i.reason}`)) : [];


  /** Liga/desliga o produto na própria tabela: a tela muda na hora e volta atrás se a API recusar. */
  async function setActive(p: Product, active: boolean) {
    setItems((list) => list.map((x) => (x.id === p.id ? { ...x, active } : x)));
    try {
      await api.admin.setActive("products", p.id, active);
      setError("");
    } catch (e) {
      await reload(); // volta ao estado do servidor...
      setError((e as Error).message); // ...e só então mostra o erro (o reload o limparia)
    }
  }

  async function remove(p: Product) {
    try {
      await api.admin.remove("products", p.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function edit(p: Product) {
    try {
      setForm(fromProduct(await api.admin.get<Product>("products", p.id)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (form) {
    return (
      <ProductForm
        initial={form}
        categories={categories}
        brands={brandList.items}
        classes={classes}
        onCatalogChange={() => Promise.all([categoryList.reload(), brandList.reload()]).then(() => undefined)}
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
        title="Produtos"
        hint="Cadastre, edite, desative (some da loja sem perder o histórico) ou exclua produtos."
        action={
          <div className="admin-head-actions">
            <button className="btn btn-outline btn-sm" disabled={refreshing} onClick={refreshFromErp} title="Busca no ERP os itens marcados para o site e atualiza preço, cores e estoque dos já importados">
              {refreshing ? `Atualizando… ${erp.status?.percent ?? 0}%` : "Atualizar do ERP"}
            </button>
            <button className="btn btn-solid btn-sm" onClick={() => setForm({ ...EMPTY, categoryId: categories[0]?.id ?? "" })}>+ Novo produto</button>
          </div>
        }
      />
      <Notice error={error} />
      {showPanel && <ErpRefreshPanel status={erp.status!} onClose={closePanel} onShowIssues={() => setAttention(true)} />}
      {issues.length > 0 && (
        <button type="button" className={`attention-banner${attention ? " is-on" : ""}`} aria-pressed={attention} onClick={() => setAttention((on) => !on)}>
          <IssueGlyph />
          <span>Há <strong>{issues.length}</strong> {issues.length === 1 ? "produto que precisa" : "produtos que precisam"} da sua atenção.</span>
          <span className="attention-banner-action">{attention ? "Mostrar todos os produtos" : "Ver quais são"}</span>
        </button>
      )}
      <div className="toolbar">
        <input type="search" placeholder="Buscar por nome, referência, marca ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
        {!attention && (
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrar por situação">
            <option value="all">Todos</option>
            <option value="active">À venda</option>
            <option value="inactive">Desativados</option>
          </select>
        )}
      </div>
      {loading ? (
        <p>Carregando…</p>
      ) : visible.length === 0 && missing.length === 0 ? (
        <EmptyState>{items.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esse filtro."}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th /><th>Produto</th><th>Classe › categoria</th><th>Preço</th><th>Estoque</th><th>Estoque atualizado em</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {missing.map((i) => (
                <tr key={i.id} className="is-issue">
                  <td />
                  <td><strong>{i.brandName} · {i.ref}</strong> <IssueIcon reason={i.reason} /><br /><small>Ainda não está no painel</small></td>
                  <td colSpan={6}><small>{i.reason.split("\n")[0]}</small></td>
                </tr>
              ))}
              {visible.map((p) => {
                const stock = p.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0;
                return (
                  <tr key={p.id} className={p.active === false ? "is-off" : undefined}>
                    <td><Thumb url={p.images[0] ?? p.colors?.find((c) => c.images.length > 0)?.images[0]} /></td>
                    <td><strong>{p.name}</strong>{issueOf.has(p.id) && <> <IssueIcon reason={issueOf.get(p.id)!.reason} /></>}{p.badge && <> <Badge tone="warn">{BADGE_LABEL[p.badge]}</Badge></>}<br /><small>{[p.brand?.name, p.reference].filter(Boolean).join(" · ") || p.slug}</small></td>
                    <td>{p.category.productClass?.name && <small>{p.category.productClass.name} › </small>}{p.category.name}<br /><small>{segmentLabel(p.ageGroup, p.gender)}</small></td>
                    <td>{formatPrice(p.price)}{p.compareAtPrice && <><br /><small className="strike">{formatPrice(p.compareAtPrice)}</small></>}</td>
                    <td className="stock-cell">
                      {stock === 0 ? <Badge tone="off">Esgotado</Badge> : stock}
                      {(p.variants?.length ?? 0) > 0 && <SizeChips chips={productSizeChips(p)} label={`Estoque por numeração de ${p.name}`} />}
                    </td>
                    <td className="sync-cell">
                      {p.erpSyncedAt ? <time dateTime={p.erpSyncedAt}>{formatDateTime(p.erpSyncedAt)}</time> : <small title="Produto cadastrado à mão: o estoque é editado no painel">—</small>}
                    </td>
                    <td>
                      <span className="active-cell">
                        <RowSwitch checked={p.active !== false} label={`${p.active === false ? "Ativar" : "Desativar"} ${p.name}`} onChange={(v) => setActive(p, v)} />
                        {p.active === false ? <Badge tone="off">Desativado</Badge> : hiddenReason(p) ? <Badge tone="warn">Oculto</Badge> : <Badge tone="ok">À venda</Badge>}
                      </span>
                      {hiddenReason(p) && <><br /><small>{hiddenReason(p)}</small></>}
                    </td>
                    <td className="row-actions">
                      <button type="button" className="link-btn" onClick={() => edit(p)}>Editar</button>
                      <ConfirmButton message="Excluir? (se já foi vendido, só será desativado)" onConfirm={() => remove(p)}>Excluir</ConfirmButton>
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

/** Um ícone por numeração; ao passar o mouse (ou focar com o teclado) mostra o estoque dela. */
function SizeChips({ chips, label }: { chips: { size: string; stock: number; tip: string }[]; label: string }) {
  return (
    <ul className="size-chips" aria-label={label}>
      {chips.map((c) => (
        <li key={c.size} className={`size-chip${c.stock > 0 ? "" : " is-out"}`} tabIndex={0} data-tip={c.tip} aria-label={c.tip}>
          {c.size || "?"}
        </li>
      ))}
    </ul>
  );
}

/** Numerações do produto (somando as cores) com o estoque de cada uma, para a lista de produtos. */
/** "19/10/2026 14:05" no horário do navegador. */
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");

function productSizeChips(p: Product) {
  const bySizeMap = new Map<number, { total: number; parts: string[]; label: string }>();
  for (const v of [...(p.variants ?? [])].sort((a, b) => a.size - b.size || a.color.localeCompare(b.color, "pt-BR"))) {
    const cur = bySizeMap.get(v.size) ?? { total: 0, parts: [], label: v.sizeLabel ?? String(v.size) };
    cur.total += v.stock;
    cur.parts.push(`${v.color} ${v.stock}`);
    bySizeMap.set(v.size, cur);
  }
  return [...bySizeMap.entries()].map(([, { total, parts, label: size }]) => ({
    size,
    stock: total,
    tip: total > 0 ? `Estoque do ${size}: ${total}${parts.length > 1 ? ` (${parts.join(" · ")})` : ""}` : `Sem estoque no ${size}`,
  }));
}

/**
 * Janela "Ver mais" de uma cor: abre sobre a página (fundo escurecido) com todos os detalhes do item, como a posição na
 * loja, as fotos, o estoque de cada numeração e o SKU, e deixa editar tudo. As mudanças valem ao salvar o produto.
 */
function ColorDialog({ item, position, count, slug, productName, productPrice, sizeScheme, sizeInput, onSizeInput, onPatch, onPatchSize, onAddSizes, onClose }: {
  item: ColorItem;
  sizeScheme: "NUMERACAO" | "CONFECCAO";
  position: number;
  count: number;
  slug: string;
  productName: string;
  productPrice: string;
  sizeInput: { sizes: string; stock: string };
  onSizeInput: (value: { sizes: string; stock: string }) => void;
  onPatch: (patch: Partial<ColorItem>) => void;
  onPatchSize: (index: number, patch: Partial<SizeRow>) => void;
  onAddSizes: (text: string, stock: string) => void;
  onClose: () => void;
}) {
  // Esc fecha; a página atrás não rola enquanto a janela está aberta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const color = item.color.trim();
  const total = stockOf(item);
  const out = item.sizes.filter((r) => !(Number(r.stock) > 0)).length;
  const confeccao = sizeScheme === "CONFECCAO";
  const numbers = item.sizes.map((r) => Number(r.size)).filter((n) => n > 0);
  const range = confeccao ? item.sizes.map((r) => r.label).join(", ") || "—" : numbers.length > 0 ? `${Math.min(...numbers)} a ${Math.max(...numbers)}` : "—";
  const add = () => {
    onAddSizes(sizeInput.sizes, sizeInput.stock);
    onSizeInput({ ...sizeInput, sizes: "" });
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal color-modal" role="dialog" aria-modal="true" aria-label={`Detalhes da cor ${color || "sem nome"}`}>
        <div className="crop-head">
          <strong>{color || "Cor sem nome"}{productName.trim() && <small> · {productName.trim()}</small>}</strong>
          <button type="button" className="link-btn" onClick={onClose} aria-label="Fechar">Fechar ✕</button>
        </div>

        <dl className="color-facts">
          <div><dt>Posição na loja</dt><dd>{position}ª de {count}{position === 1 && " · abre a página"}</dd></div>
          <div><dt>Numerações</dt><dd>{item.sizes.length} ({range})</dd></div>
          <div><dt>Estoque total</dt><dd>{total}{total === 0 && " · esgotada"}</dd></div>
          <div><dt>Sem estoque</dt><dd>{out === 0 ? "nenhuma" : `${out} numeraç${out === 1 ? "ão" : "ões"}`}</dd></div>
          <div><dt>Fotos</dt><dd>{item.images.length} de {MAX_COLOR_PHOTOS}</dd></div>
        </dl>

        <label className="color-modal-name">Nome da cor<input value={item.color} onChange={(e) => onPatch({ color: e.target.value })} /></label>
        <div className="color-modal-prices">
          <label>Preço desta cor (R$)
            <input type="number" step="0.01" min="0" value={item.price} placeholder={productPrice ? `Vale o do produto: ${productPrice}` : "Vale o do produto"} onChange={(e) => onPatch({ price: e.target.value })} />
          </label>
          <label>Preço &quot;de&quot; desta cor (riscado)
            <input type="number" step="0.01" min="0" value={item.compareAtPrice} disabled={!item.price} onChange={(e) => onPatch({ compareAtPrice: e.target.value })} />
          </label>
          <small className="admin-hint">Deixe vazio para a cor usar o preço do produto. Itens do ERP podem ter preço diferente do produto: cada cor vende pelo seu.</small>
        </div>
        <ImageGallery value={item.images} max={MAX_COLOR_PHOTOS} label={`Fotos de ${color || "esta cor"}`} onChange={(urls) => onPatch({ images: urls })} />

        <div className="table-wrap">
          <table className="table table-tight">
            <thead><tr><th>{confeccao ? "Tamanho" : "Nº"}</th><th>Estoque</th><th>SKU</th><th /></tr></thead>
            <tbody>
              {item.sizes.map((r, j) => (
                <tr key={j}>
                  <td>
                    {confeccao ? (
                      <select value={r.label} aria-label={`Tamanho ${j + 1}`} onChange={(e) => onPatchSize(j, { label: e.target.value })}>
                        <option value="">Escolha</option>
                        {CLOTHING_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    ) : (
                      <input type="number" min="1" value={r.size} aria-label={`Numeração ${j + 1}`} onChange={(e) => onPatchSize(j, { size: e.target.value })} />
                    )}
                  </td>
                  <td><input type="number" min="0" value={r.stock} aria-label={`Estoque da numeração ${confeccao ? r.label : r.size || j + 1}`} onChange={(e) => onPatchSize(j, { stock: e.target.value })} /></td>
                  <td>
                    <input
                      className={r.sku ? undefined : "sku-auto"}
                      value={skuOf(slug, color, r)}
                      title={r.sku ? "Código próprio. Apague o campo para voltar ao automático." : "Gerado automaticamente"}
                      aria-label="SKU"
                      onChange={(e) => onPatchSize(j, { sku: e.target.value === autoSku(slug, color, confeccao ? r.label : r.size) ? "" : e.target.value })}
                    />
                  </td>
                  <td><button type="button" className="link-btn danger" onClick={() => onPatch({ sizes: item.sizes.filter((_, k) => k !== j) })}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid-gen">
          <input
            placeholder={confeccao ? "Tamanhos: P, M, G, Único" : "Numerações: 34, 35, 36"}
            aria-label={confeccao ? "Novos tamanhos" : "Novas numerações"}
            value={sizeInput.sizes}
            onChange={(e) => onSizeInput({ ...sizeInput, sizes: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          />
          <input type="number" min="0" aria-label="Estoque inicial" title="Estoque inicial de cada numeração nova" value={sizeInput.stock} onChange={(e) => onSizeInput({ ...sizeInput, stock: e.target.value })} />
          <button type="button" className="btn-small" disabled={!sizeInput.sizes.trim()} onClick={add}>Adicionar numerações</button>
        </div>
        <p className="admin-hint">As mudanças feitas aqui só valem depois de salvar o produto.</p>
        <div className="crop-actions">
          <button type="button" className="btn btn-solid btn-sm" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ProductForm({ initial, categories, brands, classes, onCatalogChange, onCancel, onSaved }: {
  initial: FormState;
  categories: Category[];
  brands: Brand[];
  classes: ProductClass[];
  onCatalogChange: () => Promise<void>;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Cor aberta na janela "Ver mais". */
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const [newColors, setNewColors] = useState("");
  const [sizeInputs, setSizeInputs] = useState<Record<string, { sizes: string; stock: string }>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((cur) => ({ ...cur, [key]: value }));
  // Itens cadastrados aqui mesmo entram na lista antes de a tela principal recarregar.
  const [newCategories, setNewCategories] = useState<Category[]>([]);
  const [newBrands, setNewBrands] = useState<Brand[]>([]);
  const [newCategory, setNewCategory] = useState<{ name: string; classId: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const categoryOptions: SearchOption[] = [...categories, ...newCategories].map((c) => ({ id: c.id, label: c.name, hint: [c.productClass?.name ?? classes.find((k) => k.id === c.classId)?.name, c.active === false ? "desativada" : null].filter(Boolean).join(" · ") }));
  const brandOptions: SearchOption[] = [...brands, ...newBrands].map((b) => ({ id: b.id, label: b.name, hint: b.active === false ? "desativada" : undefined }));

  async function createBrand(name: string) {
    setCreating(true);
    try {
      const brand = await api.admin.create<Brand>("brands", { name });
      setNewBrands((cur) => [...cur, brand]);
      set("brandId", brand.id);
      setError("");
      void onCatalogChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function createCategory() {
    if (!newCategory) return;
    if (!newCategory.classId) return setError("Escolha a classe da nova categoria.");
    setCreating(true);
    try {
      const category = await api.admin.create<Category>("categories", { name: newCategory.name.trim(), classId: newCategory.classId, showOnHome: false, sortOrder: categories.length + newCategories.length });
      setNewCategories((cur) => [...cur, { ...category, productClass: classes.find((k) => k.id === newCategory.classId) ?? null }]);
      set("categoryId", category.id);
      setNewCategory(null);
      setError("");
      void onCatalogChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  const patchItem = (uid: string, patch: Partial<ColorItem>) => setF((cur) => ({ ...cur, items: cur.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)) }));
  const patchSize = (uid: string, index: number, patch: Partial<SizeRow>) =>
    setF((cur) => ({ ...cur, items: cur.items.map((it) => (it.uid === uid ? { ...it, sizes: it.sizes.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : it)) }));

  /** Cria uma cor nova; ela já nasce com as numerações da última cor (estoque 0), que costumam ser as mesmas. */
  function addColor(name: string) {
    const last = f.items.at(-1);
    const item: ColorItem = { uid: newUid(), color: name, images: [], price: "", compareAtPrice: "", active: true, erpLocked: false, sizes: (last?.sizes ?? []).map((r) => ({ size: r.size, label: r.label, stock: "0", sku: "" })) };
    setDetailUid(item.uid);
    setF((cur) => ({ ...cur, items: [...cur.items, item] }));
  }

  /** Cores digitadas separadas por vírgula; cor que já existe só ganha as numerações que faltam. */
  function addColorsFromText() {
    const names = newColors.split(",").map((c) => c.trim()).filter(Boolean);
    if (names.length === 0) return;
    for (const name of names) {
      const existing = f.items.find((it) => it.color.trim().toLowerCase() === name.toLowerCase());
      if (!existing) addColor(name);
    }
    setNewColors("");
  }

  /** Numerações digitadas ("34, 35, 36") entram na cor com o estoque informado; as que já existem são ignoradas. */
  function addSizes(uid: string, text: string, stock: string) {
    setF((cur) => {
      const confeccao = cur.sizeScheme === "CONFECCAO";
      const tokens = text.split(",").map((x) => x.trim()).filter(Boolean);
      return {
        ...cur,
        items: cur.items.map((it) => {
          if (it.uid !== uid) return it;
          const have = new Set(it.sizes.map((r) => (confeccao ? r.label : r.size)));
          const added: SizeRow[] = [];
          for (const t of tokens) {
            if (confeccao) {
              const label = clothingLabelOf(t);
              if (label && !have.has(label)) { have.add(label); added.push({ size: "", label, stock: stock || "0", sku: "" }); }
            } else if (Number(t) > 0 && !have.has(t)) {
              have.add(t);
              added.push({ size: t, label: "", stock: stock || "0", sku: "" });
            }
          }
          const all = [...it.sizes, ...added];
          return { ...it, sizes: all.sort((a, b) => (confeccao ? (CLOTHING_ORDER[a.label] ?? 0) - (CLOTHING_ORDER[b.label] ?? 0) : Number(a.size) - Number(b.size))) };
        }),
      };
    });
  }

  /** Sobe ou desce uma cor; a primeira da lista é a que a página do produto abre. */
  function moveColor(uid: string, direction: -1 | 1) {
    setF((cur) => {
      const from = cur.items.findIndex((it) => it.uid === uid);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= cur.items.length) return cur;
      const items = [...cur.items];
      [items[from], items[to]] = [items[to]!, items[from]!];
      return { ...cur, items };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate(f);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      if (f.id) await api.admin.update("products", f.id, toBody(f));
      else await api.admin.create("products", toBody(f));
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <PageHead title={f.id ? "Editar produto" : "Novo produto"} action={<button type="button" className="link-btn" onClick={onCancel}>← Voltar à lista</button>} />

      <fieldset>
        <legend>Informações</legend>
        <label className="span-2">Nome no site
          <input value={f.name} required onChange={(e) => setF((cur) => ({ ...cur, name: e.target.value, slug: cur.slugTouched ? cur.slug : slugify(e.target.value) }))} />
          {f.erpName && <small>Nome no ERP: <strong>{f.erpName}</strong>. Fica guardado à parte e só muda pelo ERP; o nome acima é o que aparece na loja (sem a referência) e pode ser editado.</small>}
        </label>
        <SlugField value={f.slug} name={f.name} prefix="/produtos/" onChange={(slug) => setF((cur) => ({ ...cur, slug, slugTouched: true }))} />
        <SearchSelect
          label="Categoria"
          options={categoryOptions}
          value={f.categoryId}
          required
          placeholder="Pesquisar categoria…"
          createLabel="Cadastrar categoria"
          onChange={(id) => set("categoryId", id)}
          onCreate={(name) => setNewCategory({ name, classId: classes[0]?.id ?? "" })}
        />
        {newCategory && (
          <div className="inline-create">
            <strong>Nova categoria</strong>
            <label>Nome<input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} /></label>
            <label>Classe
              <select value={newCategory.classId} onChange={(e) => setNewCategory({ ...newCategory, classId: e.target.value })}>
                <option value="">Selecione</option>
                {classes.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-solid btn-sm" disabled={creating || !newCategory.name.trim()} onClick={createCategory}>{creating ? "Cadastrando…" : "Cadastrar categoria"}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setNewCategory(null)}>Cancelar</button>
            </div>
          </div>
        )}
        <SearchSelect
          label="Marca"
          options={brandOptions}
          value={f.brandId}
          placeholder="Pesquisar marca…"
          createLabel="Cadastrar marca"
          onChange={(id) => set("brandId", id)}
          onCreate={createBrand}
        />
        <label>Referência / código<input value={f.reference} onChange={(e) => set("reference", e.target.value)} /></label>
        <div className="field">
          <span className="field-label">Gênero <small>(unissex aparece nos dois)</small></span>
          <div className="checks">
            {(Object.keys(GENDER_LABEL) as Gender[]).map((value) => (
              <label key={value} className="check">
                <input type="radio" name="gender" checked={f.gender === value} onChange={() => set("gender", value)} />
                {(f.ageGroup === "INFANTIL" ? KIDS_GENDER_LABEL : GENDER_LABEL)[value]}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Faixa etária</span>
          <div className="checks">
            {(Object.keys(AGE_GROUP_LABEL) as AgeGroup[]).map((value) => (
              <label key={value} className="check">
                <input type="radio" name="ageGroup" checked={f.ageGroup === value} onChange={() => set("ageGroup", value)} />
                {AGE_GROUP_LABEL[value]}
              </label>
            ))}
          </div>
        </div>
        <label className="span-2">Descrição<textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="span-2">Cuidados e conservação<textarea rows={2} value={f.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} /></label>
      </fieldset>

      <fieldset>
        <legend>Preço e destaque</legend>
        <label>Preço (R$)<input type="number" step="0.01" min="0" required value={f.price} onChange={(e) => set("price", e.target.value)} /></label>
        <label>Preço &quot;de&quot; (riscado, opcional)<input type="number" step="0.01" min="0" value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} /></label>
        <label>Custo de compra (R$, opcional)
          <input type="number" step="0.01" min="0" value={f.costPrice} onChange={(e) => set("costPrice", e.target.value)} />
          <small>
            {f.costPrice && Number(f.price) > 0
              ? `Margem de ${(((Number(f.price) - Number(f.costPrice)) / Number(f.price)) * 100).toFixed(1).replace(".", ",")}% — só você vê. Alimenta o lucro nos Indicadores.`
              : "Só você vê. Com o custo, os Indicadores calculam margem e lucro."}
          </small>
        </label>
        <label>Selo
          <select value={f.badge} onChange={(e) => set("badge", e.target.value)}>
            <option value="">Nenhum</option>
            {(Object.keys(BADGE_LABEL) as BadgeKey[]).map((k) => <option key={k} value={k}>{BADGE_LABEL[k]}</option>)}
          </select>
          <small>O selo define em quais vitrines da home o produto aparece.</small>
        </label>
        <div className="field"><Switch checked={f.active} onChange={(v) => set("active", v)} label={f.active ? "À venda na loja" : "Desativado (oculto na loja)"} /></div>
      </fieldset>

      <fieldset>
        <legend>Fotos gerais</legend>
        <div className="span-2"><ImageGallery value={f.images} onChange={(urls) => set("images", urls)} label="Fotos gerais (a primeira é a principal)" /></div>
        <p className="span-2 admin-hint">Usadas quando uma cor ainda não tem fotos próprias. Com as fotos de cada cor cadastradas (logo abaixo das variações), a loja mostra as da cor escolhida.</p>
      </fieldset>

      <fieldset>
        <legend>Cores e estoque (um item por cor)</legend>
        <div className="span-2 grade-type">
          <span className="field-label">Tipo de grade</span>
          <div className="checks">
            <label className="check"><input type="radio" name="sizeScheme" checked={f.sizeScheme === "NUMERACAO"} onChange={() => set("sizeScheme", "NUMERACAO")} /> Numeração (34, 35…)</label>
            <label className="check"><input type="radio" name="sizeScheme" checked={f.sizeScheme === "CONFECCAO"} onChange={() => set("sizeScheme", "CONFECCAO")} /> Grade de confecção (P, M, G, Único…)</label>
          </div>
          <small className="admin-hint">Peça de tamanho único (bolsa, acessório) usa “Único”: a loja não mostra número nenhum.</small>
        </div>
        <p className="span-2 admin-hint">
          Cada cor é um item do produto, com as suas fotos (até {MAX_COLOR_PHOTOS}) e o estoque de cada numeração. Clique na cor para abrir. A primeira da lista é a que a página do produto abre na loja.
        </p>
        <div className="span-2 color-add">
          <input
            placeholder="Cores: Preto, Caramelo"
            value={newColors}
            aria-label="Nomes das novas cores"
            onChange={(e) => setNewColors(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColorsFromText())}
          />
          <button type="button" className="btn-small" disabled={!newColors.trim()} onClick={addColorsFromText}>+ Adicionar cor</button>
        </div>
        {f.items.length === 0 && <p className="span-2 admin-hint">Nenhuma cor ainda: sem cor e numeração o produto não pode ser comprado.</p>}
        <div className="span-2 color-items">
          {f.items.map((it, i) => {
            const total = stockOf(it);
            return (
              <div key={it.uid} className={`color-item${it.active ? "" : " is-off"}`}>
                <div className="color-item-head">
                  <Thumb url={it.images[0]} />
                  <span className="color-item-title">
                    <strong>{it.color.trim() || "Cor sem nome"}</strong>
                    {i === 0 && <em>abre a página</em>}
                  </span>
                  <span className="color-item-summary">
                    {it.price && <>R$ {it.price} · </>}{it.sizes.length} numeraç{it.sizes.length === 1 ? "ão" : "ões"} · estoque {total}
                    {total === 0 && <b> · esgotada</b>}
                  </span>
                  <span className="active-cell" title={it.erpLocked ? "O ERP não marca este item para o site: não dá para habilitar aqui. Volta quando o ERP marcar de novo." : it.active ? "Desabilitar tira a cor da loja (continua marcada no ERP)." : "Habilitar volta a cor para a loja; o estoque dela volta na próxima atualização com o ERP."}>
                    <RowSwitch
                      checked={it.active}
                      disabled={it.erpLocked}
                      label={`${it.active ? "Desabilitar" : "Habilitar"} a cor ${it.color}`}
                      onChange={(v) => set("items", f.items.map((x) => (x.uid === it.uid ? { ...x, active: v } : x)))}
                    />
                    {it.active ? <Badge tone="ok">À venda</Badge> : <Badge tone="off">{it.erpLocked ? "Desabilitada no ERP" : "Desabilitada"}</Badge>}
                  </span>
                  <span className="move">
                    <button type="button" aria-label={`Subir a cor ${it.color}`} disabled={i === 0} onClick={() => moveColor(it.uid, -1)}>↑</button>
                    <button type="button" aria-label={`Descer a cor ${it.color}`} disabled={i === f.items.length - 1} onClick={() => moveColor(it.uid, 1)}>↓</button>
                  </span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailUid(it.uid)}>Ver mais</button>
                  <ConfirmButton message="Remover esta cor e as numerações dela? (se já foi vendida, a venda continua no histórico)" onConfirm={() => set("items", f.items.filter((x) => x.uid !== it.uid))}>Remover</ConfirmButton>
                </div>
                {it.sizes.length > 0 && (
                  <div className="color-item-sizes">
                    <SizeChips
                      label={`Estoque por numeração de ${it.color}`}
                      chips={it.sizes.map((r) => {
                        const n = Number(r.stock) || 0;
                        const name = f.sizeScheme === "CONFECCAO" ? r.label : r.size;
                        return { size: name, stock: n, tip: n > 0 ? `Estoque do ${name}: ${n}` : `Sem estoque no ${name}` };
                      })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {(() => {
          const index = f.items.findIndex((it) => it.uid === detailUid);
          const it = f.items[index];
          if (!it) return null;
          return (
            <ColorDialog
              item={it}
              position={index + 1}
              count={f.items.length}
              slug={f.slug}
              productName={f.name}
              productPrice={f.price}
              sizeScheme={f.sizeScheme}
              sizeInput={sizeInputs[it.uid] ?? { sizes: "", stock: "5" }}
              onSizeInput={(value) => setSizeInputs((cur) => ({ ...cur, [it.uid]: value }))}
              onPatch={(patch) => patchItem(it.uid, patch)}
              onPatchSize={(j, patch) => patchSize(it.uid, j, patch)}
              onAddSizes={(text, stock) => addSizes(it.uid, text, stock)}
              onClose={() => setDetailUid(null)}
            />
          );
        })()}
        <p className="span-2 admin-hint">O SKU é gerado sozinho (produto-cor-número). Só digite um código se a loja já usar um próprio; apague o campo para voltar ao automático. Numerações já vendidas não podem ser removidas; zere o estoque delas.</p>
      </fieldset>

      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : f.id ? "Salvar alterações" : "Cadastrar produto"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
