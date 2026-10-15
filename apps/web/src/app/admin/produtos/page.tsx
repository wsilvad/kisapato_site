"use client";

import { useMemo, useState } from "react";
import { Badge, ConfirmButton, EmptyState, ImageGallery, Notice, PageHead, RowSwitch, SearchSelect, SlugField, Switch, slugify, useAdminList, Thumb, type SearchOption } from "@/components/admin/kit";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { AGE_GROUP_LABEL, GENDER_LABEL, KIDS_GENDER_LABEL, segmentLabel, type AgeGroup, type Gender } from "@/lib/segment";
import { hiddenReason } from "@/lib/visibility";
import { BADGE_LABEL, type BadgeKey, type Brand, type Category, type Product, type ProductClass } from "@/types/product";

interface VariantRow {
  color: string;
  size: string;
  stock: string;
  sku: string;
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
  variants: VariantRow[];
}

const EMPTY: FormState = {
  name: "", slug: "", slugTouched: false, brandId: "", ageGroup: "ADULTO", gender: "UNISSEX", reference: "", categoryId: "", price: "",
  compareAtPrice: "", costPrice: "", badge: "", active: true, description: "", careInstructions: "", images: [], variants: [],
};

/** SKU automático: slug do produto + cor + numeração (ex.: bota-couro-trail-marrom-40). */
const autoSku = (slug: string, color: string, size: string) => [slug, slugify(color), size.trim()].filter(Boolean).join("-");
/** `sku` vazio na linha significa "automático"; qualquer valor digitado é um código próprio. */
const skuOf = (slug: string, v: VariantRow) => v.sku.trim() || autoSku(slug, v.color, v.size);

function fromProduct(p: Product): FormState {
  return {
    id: p.id, name: p.name, slug: p.slug, slugTouched: true, brandId: p.brandId ?? p.brand?.id ?? "", ageGroup: p.ageGroup ?? "ADULTO", gender: p.gender ?? "UNISSEX", reference: p.reference ?? "",
    categoryId: p.categoryId ?? p.category.id, price: p.price, compareAtPrice: p.compareAtPrice ?? "", costPrice: p.costPrice ?? "", badge: p.badge ?? "",
    active: p.active ?? true, description: p.description ?? "", careInstructions: p.careInstructions ?? "", images: p.images,
    variants: (p.variants ?? []).map((v) => ({ color: v.color, size: String(v.size), stock: String(v.stock), sku: v.sku === autoSku(p.slug, v.color, String(v.size)) ? "" : v.sku })),
  };
}

/** Corpo aceito pela API (PUT/POST /admin/products). */
function toBody(f: FormState) {
  return {
    name: f.name.trim(), slug: f.slug, brandId: f.brandId || null, ageGroup: f.ageGroup, gender: f.gender, reference: f.reference.trim() || null,
    description: f.description.trim() || null, careInstructions: f.careInstructions.trim() || null,
    price: f.price, compareAtPrice: f.compareAtPrice || null, costPrice: f.costPrice || null, badge: f.badge || null, images: f.images, active: f.active, categoryId: f.categoryId,
    variants: f.variants.map((v) => ({
      color: v.color.trim(), size: Number(v.size), stock: Number(v.stock) || 0,
      sku: skuOf(f.slug, v),
    })),
  };
}

function validate(f: FormState): string {
  if (!f.name.trim()) return "Informe o nome do produto.";
  if (!f.slug) return "O endereço (slug) não pode ficar vazio.";
  if (!f.categoryId) return "Escolha uma categoria.";
  if (!(Number(f.price) >= 0) || f.price === "") return "Informe o preço.";
  if (f.costPrice && !(Number(f.costPrice) >= 0)) return "O custo não pode ser negativo.";
  if (f.compareAtPrice && Number(f.compareAtPrice) <= Number(f.price)) return 'O preço "de" deve ser maior que o preço atual.';
  const seen = new Set<string>();
  for (const v of f.variants) {
    if (!v.color.trim() || !(Number(v.size) > 0)) return "Toda variação precisa de cor e numeração.";
    const key = `${v.color.trim().toLowerCase()}|${Number(v.size)}`;
    if (seen.has(key)) return `Variação repetida: ${v.color} ${v.size}.`;
    seen.add(key);
  }
  const skus = new Set<string>();
  for (const v of f.variants) {
    const sku = skuOf(f.slug, v).toLowerCase();
    if (skus.has(sku)) return `SKU repetido: ${sku}. Cada variação precisa de um código diferente.`;
    skus.add(sku);
  }
  return "";
}

export default function ProductsAdmin() {
  const { items, setItems, loading, error, setError, reload } = useAdminList<Product>("products");
  const categoryList = useAdminList<Category>("categories");
  const brandList = useAdminList<Brand>("brands");
  const classes = useAdminList<ProductClass>("classes").items;
  const categories = categoryList.items;
  const [form, setForm] = useState<FormState | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const visible = useMemo(
    () =>
      items.filter(
        (p) =>
          (status === "all" || (status === "active") === (p.active ?? true)) &&
          `${p.name} ${p.reference ?? ""} ${p.brand?.name ?? ""} ${p.category.name}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [items, query, status],
  );

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
        action={<button className="btn btn-solid btn-sm" onClick={() => setForm({ ...EMPTY, categoryId: categories[0]?.id ?? "" })}>+ Novo produto</button>}
      />
      <Notice error={error} />
      <div className="toolbar">
        <input type="search" placeholder="Buscar por nome, referência, marca ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrar por situação">
          <option value="all">Todos</option>
          <option value="active">À venda</option>
          <option value="inactive">Desativados</option>
        </select>
      </div>
      {loading ? (
        <p>Carregando…</p>
      ) : visible.length === 0 ? (
        <EmptyState>{items.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado com esse filtro."}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th /><th>Produto</th><th>Classe › categoria</th><th>Preço</th><th>Estoque</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const stock = p.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0;
                return (
                  <tr key={p.id} className={p.active === false ? "is-off" : undefined}>
                    <td><Thumb url={p.images[0]} /></td>
                    <td><strong>{p.name}</strong>{p.badge && <> <Badge tone="warn">{BADGE_LABEL[p.badge]}</Badge></>}<br /><small>{[p.brand?.name, p.reference].filter(Boolean).join(" · ") || p.slug}</small></td>
                    <td>{p.category.productClass?.name && <small>{p.category.productClass.name} › </small>}{p.category.name}<br /><small>{segmentLabel(p.ageGroup, p.gender)}</small></td>
                    <td>{formatPrice(p.price)}{p.compareAtPrice && <><br /><small className="strike">{formatPrice(p.compareAtPrice)}</small></>}</td>
                    <td>{stock === 0 ? <Badge tone="off">Esgotado</Badge> : stock}</td>
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
  const [grid, setGrid] = useState({ colors: "", sizes: "", stock: "5" });
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

  function setVariant(index: number, patch: Partial<VariantRow>) {
    set("variants", f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  /** Cruza cores × numerações e acrescenta só as combinações que ainda não existem. */
  function generateGrid() {
    const colors = grid.colors.split(",").map((c) => c.trim()).filter(Boolean);
    const sizes = grid.sizes.split(",").map((s) => s.trim()).filter((s) => Number(s) > 0);
    const existing = new Set(f.variants.map((v) => `${v.color.trim().toLowerCase()}|${Number(v.size)}`));
    const added = colors.flatMap((color) => sizes.map((size) => ({ color, size, stock: grid.stock || "0", sku: "" })))
      .filter((v) => !existing.has(`${v.color.toLowerCase()}|${Number(v.size)}`));
    set("variants", [...f.variants, ...added]);
    setGrid({ ...grid, colors: "", sizes: "" });
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
        <label className="span-2">Nome
          <input value={f.name} required onChange={(e) => setF((cur) => ({ ...cur, name: e.target.value, slug: cur.slugTouched ? cur.slug : slugify(e.target.value) }))} />
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
        <SearchSelect
          label="Marca"
          options={brandOptions}
          value={f.brandId}
          placeholder="Pesquisar marca…"
          createLabel="Cadastrar marca"
          onChange={(id) => set("brandId", id)}
          onCreate={createBrand}
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
        <label>Referência / código<input value={f.reference} onChange={(e) => set("reference", e.target.value)} /></label>
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
        <legend>Fotos</legend>
        <div className="span-2"><ImageGallery value={f.images} onChange={(urls) => set("images", urls)} /></div>
      </fieldset>

      <fieldset>
        <legend>Variações (cor, numeração e estoque)</legend>
        <div className="span-2 grid-gen">
          <input placeholder="Cores: Preto, Caramelo" value={grid.colors} onChange={(e) => setGrid({ ...grid, colors: e.target.value })} />
          <input placeholder="Numerações: 34, 35, 36" value={grid.sizes} onChange={(e) => setGrid({ ...grid, sizes: e.target.value })} />
          <input type="number" min="0" aria-label="Estoque inicial" title="Estoque inicial de cada variação" value={grid.stock} onChange={(e) => setGrid({ ...grid, stock: e.target.value })} />
          <button type="button" className="btn-small" onClick={generateGrid}>Gerar grade</button>
        </div>
        {f.variants.length > 0 && (
          <div className="span-2 table-wrap">
            <table className="table table-tight">
              <thead><tr><th>Cor</th><th>Nº</th><th>Estoque</th><th>SKU</th><th /></tr></thead>
              <tbody>
                {f.variants.map((v, i) => (
                  <tr key={i}>
                    <td><input value={v.color} aria-label="Cor" onChange={(e) => setVariant(i, { color: e.target.value })} /></td>
                    <td><input type="number" min="1" value={v.size} aria-label="Numeração" onChange={(e) => setVariant(i, { size: e.target.value })} /></td>
                    <td><input type="number" min="0" value={v.stock} aria-label="Estoque" onChange={(e) => setVariant(i, { stock: e.target.value })} /></td>
                    <td>
                      <input
                        className={v.sku ? undefined : "sku-auto"}
                        value={skuOf(f.slug, v)}
                        title={v.sku ? "Código próprio. Apague o campo para voltar ao automático." : "Gerado automaticamente"}
                        aria-label="SKU"
                        onChange={(e) => setVariant(i, { sku: e.target.value === autoSku(f.slug, v.color, v.size) ? "" : e.target.value })}
                      />
                    </td>
                    <td><button type="button" className="link-btn danger" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))}>Remover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="link-btn" onClick={() => set("variants", [...f.variants, { color: "", size: "", stock: "0", sku: "" }])}>+ Adicionar variação</button>
          </div>
        )}
        <p className="span-2 admin-hint">O SKU é gerado sozinho (produto-cor-número) e acompanha o nome, a cor e a numeração. Só digite um código se a loja já usar um próprio; apague o campo para voltar ao automático. Variações já vendidas não podem ser removidas; zere o estoque delas.</p>
      </fieldset>

      <Notice error={error} />
      <div className="form-actions">
        <button className="btn btn-solid btn-sm" disabled={saving}>{saving ? "Salvando…" : f.id ? "Salvar alterações" : "Cadastrar produto"}</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
