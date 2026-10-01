"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, assetUrl } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/session";
import { BADGE_LABEL, type BadgeKey, type Campaign, type Category, type Order, type Product, type Showcase } from "@/types/product";

type Tab = "products" | "categories" | "campaigns" | "showcases" | "orders";
const TABS: [Tab, string][] = [
  ["products", "Produtos"],
  ["categories", "Categorias"],
  ["campaigns", "Campanhas"],
  ["showcases", "Vitrines"],
  ["orders", "Pedidos"],
];
const ORDER_STATUS: Order["status"][] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"];

const slugify = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [tab, setTab] = useState<Tab>("products");

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") router.replace("/auth");
  }, [user, loading, router]);

  if (user?.role !== "ADMIN") return <div className="page"><p>Carregando…</p></div>;

  return (
    <div className="page">
      <h1 className="page-title">Painel administrativo</h1>
      <div className="options admin-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`option${tab === key ? " is-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === "products" && <ProductsAdmin />}
      {tab === "categories" && <CategoriesAdmin />}
      {tab === "campaigns" && <CampaignsAdmin />}
      {tab === "showcases" && <ShowcasesAdmin />}
      {tab === "orders" && <OrdersAdmin />}
    </div>
  );
}

function useList<T>(resource: Parameters<typeof api.admin.list>[0]) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    api.admin.list<T>(resource).then(setItems).catch((e: Error) => setError(e.message));
  }, [resource]);
  useEffect(reload, [reload]);
  return { items, error, setError, reload };
}

function ProductsAdmin() {
  const { items, error, setError, reload } = useList<Product>("products");
  const categories = useList<Category>("categories").items;
  const [images, setImages] = useState<string[]>([]);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    try {
      const { urls } = await api.admin.upload(files);
      setImages((cur) => [...cur, ...urls]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const sizes = f.sizes!.split(",").map((s) => Number(s.trim())).filter(Boolean);
    const colors = f.colors!.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api.admin.create("products", {
        name: f.name, slug: slugify(f.name!), brand: f.brand || null, description: f.description || null,
        price: f.price, compareAtPrice: f.compareAtPrice || null, badge: f.badge || null,
        categoryId: f.categoryId, images,
        variants: colors.flatMap((color) => sizes.map((size) => ({ color, size, stock: Number(f.stock) || 0, sku: `${slugify(f.name!)}-${slugify(color)}-${size}` }))),
      });
      form.reset();
      setImages([]);
      setError("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Novo produto</h2>
      <form className="form" onSubmit={onSubmit}>
        <label>Nome<input name="name" required /></label>
        <label>Marca<input name="brand" /></label>
        <label>Categoria
          <select name="categoryId" required>
            <option value="">Selecione</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Preço<input name="price" type="number" step="0.01" min="0" required /></label>
        <label>Preço &quot;de&quot; (promoção)<input name="compareAtPrice" type="number" step="0.01" min="0" /></label>
        <label>Selo
          <select name="badge"><option value="">Nenhum</option>
            {(Object.keys(BADGE_LABEL) as BadgeKey[]).map((k) => <option key={k} value={k}>{BADGE_LABEL[k]}</option>)}
          </select>
        </label>
        <label>Cores (separadas por vírgula)<input name="colors" required placeholder="Preto, Branco" /></label>
        <label>Numerações (separadas por vírgula)<input name="sizes" required placeholder="38, 39, 40" /></label>
        <label>Estoque por variação<input name="stock" type="number" min="0" defaultValue={10} /></label>
        <label>Descrição<textarea name="description" rows={3} /></label>
        <label>Fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onUpload(e.target.files)} /></label>
        <div className="thumbs">{images.map((u) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={assetUrl(u)} alt="" />)}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid">Cadastrar produto</button>
      </form>
      <h2>Produtos ({items.length})</h2>
      <ul className="admin-list">
        {items.map((p) => (
          <li key={p.id}>
            <span>{p.name} · {formatPrice(p.price)} · {p.variants?.reduce((s, v) => s + v.stock, 0) ?? 0} un.{p.active ? "" : " · inativo"}</span>
            <button type="button" className="link-btn" onClick={() => api.admin.remove("products", p.id).then(reload).catch((e: Error) => setError(e.message))}>Excluir</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoriesAdmin() {
  const { items, error, setError, reload } = useList<Category>("categories");
  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name"));
    try {
      await api.admin.create("categories", { name, slug: slugify(name) });
      form.reset();
      setError("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <section>
      <form className="form" onSubmit={onSubmit}>
        <label>Nova categoria<input name="name" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid">Adicionar</button>
      </form>
      <ul className="admin-list">
        {items.map((c) => (
          <li key={c.id}><span>{c.name} ({c.slug})</span>
            <button type="button" className="link-btn" onClick={() => api.admin.remove("categories", c.id).then(reload).catch((e: Error) => setError(e.message))}>Excluir</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CampaignsAdmin() {
  const { items, error, setError, reload } = useList<Campaign>("campaigns");
  const [image, setImage] = useState("");
  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api.admin.create("campaigns", {
        title: f.title, eyebrow: f.eyebrow || null, body: f.body || null,
        buttonLabel: f.buttonLabel || null, buttonUrl: f.buttonUrl || null,
        desktopImageUrl: image || null, sortOrder: Number(f.sortOrder) || 0,
        startsAt: f.startsAt || null, endsAt: f.endsAt || null,
      });
      form.reset();
      setImage("");
      setError("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <section>
      <form className="form" onSubmit={onSubmit}>
        <label>Título<input name="title" required /></label>
        <label>Chamada superior<input name="eyebrow" /></label>
        <label>Texto<textarea name="body" rows={2} /></label>
        <label>Rótulo do botão<input name="buttonLabel" /></label>
        <label>Link do botão<input name="buttonUrl" placeholder="/produtos" /></label>
        <label>Início<input name="startsAt" type="datetime-local" /></label>
        <label>Fim<input name="endsAt" type="datetime-local" /></label>
        <label>Ordem<input name="sortOrder" type="number" defaultValue={0} /></label>
        <label>Imagem<input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => e.target.files && api.admin.upload(e.target.files).then((r) => setImage(r.urls[0] ?? "")).catch((err: Error) => setError(err.message))} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid">Criar campanha</button>
      </form>
      <ul className="admin-list">
        {items.map((c) => (
          <li key={c.id}><span>{c.title}{c.active ? "" : " · inativa"}</span>
            <button type="button" className="link-btn" onClick={() => api.admin.remove("campaigns", c.id).then(reload).catch((e: Error) => setError(e.message))}>Excluir</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ShowcasesAdmin() {
  const { items, error, setError, reload } = useList<Showcase>("showcases");
  async function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api.admin.create("showcases", { title: f.title, selectionRule: f.selectionRule, itemLimit: Number(f.itemLimit), sortOrder: Number(f.sortOrder) || 0 });
      form.reset();
      setError("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <section>
      <form className="form" onSubmit={onSubmit}>
        <label>Título<input name="title" required /></label>
        <label>Mostrar produtos com selo
          <select name="selectionRule">
            {(Object.keys(BADGE_LABEL) as BadgeKey[]).map((k) => <option key={k} value={k}>{BADGE_LABEL[k]}</option>)}
          </select>
        </label>
        <label>Quantidade (1 a 24)<input name="itemLimit" type="number" min={1} max={24} defaultValue={4} /></label>
        <label>Ordem<input name="sortOrder" type="number" defaultValue={0} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-solid">Criar vitrine</button>
      </form>
      <ul className="admin-list">
        {items.map((s) => (
          <li key={s.id}><span>{s.title} · {BADGE_LABEL[s.selectionRule]} · {s.itemLimit} itens</span>
            <button type="button" className="link-btn" onClick={() => api.admin.remove("showcases", s.id).then(reload).catch((e: Error) => setError(e.message))}>Excluir</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OrdersAdmin() {
  const { items, error, setError, reload } = useList<Order>("orders");
  return (
    <section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <ul className="admin-list">
        {items.map((o) => (
          <li key={o.id}>
            <span>#{o.id.slice(0, 8)} · {o.profile?.name ?? o.profile?.email} · {formatPrice(o.total)}</span>
            <select value={o.status} onChange={(e) => api.admin.setOrderStatus(o.id, e.target.value as Order["status"]).then(reload).catch((err: Error) => setError(err.message))}>
              {ORDER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
