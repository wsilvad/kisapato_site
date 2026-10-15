"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { genderName } from "@/lib/segment";
import type { Facets } from "@/types/product";

export interface FilterState {
  categoria: string[];
  faixa: string[];
  genero: string[];
  marca: string[];
  cor: string[];
  numeracao: string[];
  min?: number;
  max?: number;
}

const SORTS = [
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
];

const SWATCH: Record<string, string> = {
  preto: "#111111", branco: "#ffffff", "off white": "#f4efe6", bege: "#d8c3a5", nude: "#e0b99b", caramelo: "#b8793e", marrom: "#6b4226", taupe: "#8b7765",
  cinza: "#9a9a9a", grafite: "#4a4d52", azul: "#2f5d9e", verde: "#3f7d4e", vermelho: "#b3261e", vinho: "#6d1f2f", rosa: "#e7a1b0", coral: "#f08a74",
  amarelo: "#e8c547", laranja: "#e8892f", roxo: "#6b4fa0", dourado: "#c9a54c", prata: "#c0c0c0",
};

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

/** Monta a URL da lista: seleção fixa (selo/busca) + filtros + ordem; mudar filtro sempre volta à primeira página. */
function buildUrl(fixed: Record<string, string>, state: FilterState, ordem: string) {
  const query = new URLSearchParams(fixed);
  for (const key of ["categoria", "faixa", "genero", "marca", "cor", "numeracao"] as const) {
    if (state[key].length > 0) query.set(key, state[key].join(","));
  }
  if (state.min !== undefined) query.set("min", String(state.min));
  if (state.max !== undefined) query.set("max", String(state.max));
  if (ordem !== "novidades") query.set("ordem", ordem);
  return query.size ? `/produtos?${query}` : "/produtos";
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
const EMPTY: FilterState = { categoria: [], faixa: [], genero: [], marca: [], cor: [], numeracao: [] };
const countActive = (s: FilterState) => s.categoria.length + s.faixa.length + s.genero.length + s.marca.length + s.cor.length + s.numeracao.length + (s.min !== undefined || s.max !== undefined ? 1 : 0);

interface Props {
  facets: Facets | null;
  state: FilterState;
  fixed: Record<string, string>;
  ordem: string;
  total: number;
}

/** Só o infantil escolhido: gêneros aparecem como menina/menino. */
const onlyKids = (s: FilterState) => s.faixa.length === 1 && s.faixa[0] === "infantil";

/**
 * Barra de filtros da vitrine: gênero rápido (com uma faixa escolhida), numeração rápida, ordenação, botão "Filtrar" (painel lateral com seções
 * recolhíveis) e etiquetas dos filtros ativos. Os filtros do painel só valem ao clicar em "Aplicar filtros".
 */
export function ProductFilters({ facets, state, fixed, ordem, total }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const go = (next: FilterState, nextOrdem = ordem) => router.push(buildUrl(fixed, next, nextOrdem));
  const active = countActive(state);

  const chips = useMemo(() => {
    if (!facets) return [];
    const name = (list: { name: string; slug: string }[], slug: string) => list.find((x) => x.slug === slug)?.name ?? slug;
    return [
      ...state.faixa.map((v) => ({ key: `a-${v}`, label: name(facets.ageGroups, v), next: { ...state, faixa: toggle(state.faixa, v) } })),
      ...state.genero.map((v) => ({ key: `g-${v}`, label: genderName(v, onlyKids(state)), next: { ...state, genero: toggle(state.genero, v) } })),
      ...state.categoria.map((v) => ({ key: `c-${v}`, label: name(facets.categories, v), next: { ...state, categoria: toggle(state.categoria, v) } })),
      ...state.marca.map((v) => ({ key: `m-${v}`, label: name(facets.brands, v), next: { ...state, marca: toggle(state.marca, v) } })),
      ...state.cor.map((v) => ({ key: `k-${v}`, label: v, next: { ...state, cor: toggle(state.cor, v) } })),
      ...state.numeracao.map((v) => ({ key: `n-${v}`, label: `Nº ${v}`, next: { ...state, numeracao: toggle(state.numeracao, v) } })),
      ...(state.min !== undefined || state.max !== undefined
        ? [{ key: "price", label: `${brl(state.min ?? facets.price?.min ?? 0)} – ${brl(state.max ?? facets.price?.max ?? 0)}`, next: { ...state, min: undefined, max: undefined } }]
        : []),
    ];
  }, [facets, state]);

  return (
    <>
      <div className="shop-bar">
        <p className="shop-count"><strong>{total}</strong> {total === 1 ? "item encontrado" : "itens encontrados"}</p>
        <div className="shop-tools">
          <label className="shop-sort">
            Ordenar
            <select value={ordem} onChange={(e) => go(state, e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-sm shop-filter-btn" onClick={() => setOpen(true)} disabled={!facets}>
            Filtrar{active > 0 && <span className="shop-filter-count">{active}</span>}
          </button>
        </div>
      </div>

      {facets && ((state.faixa.length === 1 && facets.genders.length > 1) || facets.sizes.length > 0) && (
        <div className="quick-row">
          {state.faixa.length === 1 && facets.genders.length > 1 && (
            <div className="gender-quick" role="group" aria-label="Gênero">
              {[{ slug: "", label: "Todos" }, ...facets.genders.map((g) => ({ slug: g.slug, label: genderName(g.slug, onlyKids(state)) }))].map((g) => {
                const current = g.slug ? state.genero.length === 1 && state.genero[0] === g.slug : state.genero.length === 0;
                return (
                  <button key={g.slug || "todos"} type="button" className={current ? "is-active" : undefined} aria-pressed={current} onClick={() => go({ ...state, genero: g.slug ? [g.slug] : [] })}>
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
          {facets.sizes.length > 0 && (
            <SizeQuick sizes={facets.sizes} selected={state.numeracao} onToggle={(size) => go({ ...state, numeracao: toggle(state.numeracao, size) })} />
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="filter-chips">
          {chips.map((chip) => (
            <button key={chip.key} type="button" onClick={() => go(chip.next)} aria-label={`Remover filtro ${chip.label}`}>
              {chip.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button type="button" className="chips-clear" onClick={() => go(EMPTY)}>Limpar tudo</button>
        </div>
      )}

      {open && facets && <FilterDrawer facets={facets} initial={state} onClose={() => setOpen(false)} onApply={(next) => { setOpen(false); go(next); }} />}
    </>
  );
}

const SIZES_PER_PAGE = 6;

/**
 * Numeração rápida: mostra 6 por vez; "+" rola para as 6 seguintes e "‹" volta (no celular também rola com o
 * dedo). Abre já na página da primeira numeração escolhida.
 */
function SizeQuick({ sizes, selected, onToggle }: { sizes: number[]; selected: string[]; onToggle: (size: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const paged = sizes.length > SIZES_PER_PAGE;
  const [edge, setEdge] = useState({ start: true, end: !paged });
  // Uma página = a largura visível (6 botões) + o espaço até o próximo botão.
  const step = (el: HTMLElement) => el.clientWidth + (Number.parseFloat(getComputedStyle(el).columnGap) || 0);
  const onScroll = () => {
    const el = list.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };

  useEffect(() => {
    const el = list.current;
    const first = sizes.findIndex((size) => selected.includes(String(size)));
    // Mudar o scroll dispara `onScroll`, que acerta os botões.
    if (el && first >= SIZES_PER_PAGE) el.scrollLeft = step(el) * Math.floor(first / SIZES_PER_PAGE);
  }, [sizes, selected]);

  const page = (direction: 1 | -1) => list.current?.scrollBy({ left: direction * step(list.current), behavior: "smooth" });

  return (
    <div className="size-quick">
      <span>Navegue pela sua numeração:</span>
      <div className="size-quick-pager">
        {paged && <button type="button" className="size-quick-nav" aria-label="Numerações anteriores" disabled={edge.start} onClick={() => page(-1)}>‹</button>}
        <div className="size-quick-list" ref={list} onScroll={onScroll}>
          {sizes.map((size) => {
            const active = selected.includes(String(size));
            return (
              <button key={size} type="button" className={active ? "is-active" : undefined} aria-pressed={active} onClick={() => onToggle(String(size))}>
                {size}
              </button>
            );
          })}
          {/* Completa a última página para cada "+" mostrar exatamente as 6 seguintes. */}
          {paged && Array.from({ length: (SIZES_PER_PAGE - (sizes.length % SIZES_PER_PAGE)) % SIZES_PER_PAGE }, (_, i) => <span key={i} className="size-quick-pad" aria-hidden="true" />)}
        </div>
        {paged && <button type="button" className="size-quick-nav" aria-label="Mais numerações" disabled={edge.end} onClick={() => page(1)}>+</button>}
      </div>
    </div>
  );
}

type SectionKey = "faixa" | "genero" | "categoria" | "marca" | "preco" | "cor" | "numeracao";

function FilterDrawer({ facets, initial, onClose, onApply }: { facets: Facets; initial: FilterState; onClose: () => void; onApply: (state: FilterState) => void }) {
  const [draft, setDraft] = useState(initial);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(() => {
    const set = new Set<SectionKey>(["faixa", "genero"]);
    if (initial.categoria.length) set.add("categoria");
    if (initial.marca.length) set.add("marca");
    if (initial.cor.length) set.add("cor");
    if (initial.numeracao.length) set.add("numeracao");
    if (initial.min !== undefined || initial.max !== undefined) set.add("preco");
    return set;
  });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const section = (key: SectionKey, title: string, selected: number, body: React.ReactNode) => (
    <section className="fsec">
      <button
        type="button"
        className="fsec-head"
        aria-expanded={openSections.has(key)}
        onClick={() => setOpenSections((cur) => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; })}
      >
        <span>{title}{selected > 0 && <em>{selected}</em>}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d={openSections.has(key) ? "M1 7l5-5 5 5" : "M1 1l5 5 5-5"} /></svg>
      </button>
      {openSections.has(key) && <div className="fsec-body">{body}</div>}
    </section>
  );

  const checks = (list: { name: string; slug: string; count: number }[], key: "faixa" | "genero" | "categoria" | "marca") =>
    list.length === 0 ? <p className="fsec-empty">Sem opções.</p> : (
      <ul className="fchecks">
        {list.map((item) => (
          <li key={item.slug}>
            <label>
              <input type="checkbox" checked={draft[key].includes(item.slug)} onChange={() => setDraft({ ...draft, [key]: toggle(draft[key], item.slug) })} />
              <span>{item.name}</span>
              <small>{item.count}</small>
            </label>
          </li>
        ))}
      </ul>
    );

  const price = facets.price;
  const lo = Math.max(draft.min ?? price?.min ?? 0, price?.min ?? 0);
  const hi = Math.min(draft.max ?? price?.max ?? 0, price?.max ?? 0);
  const setPrice = (nextLo: number, nextHi: number) => {
    if (!price) return;
    setDraft({ ...draft, min: nextLo <= price.min ? undefined : nextLo, max: nextHi >= price.max ? undefined : nextHi });
  };

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Filtrar por">
      <button type="button" className="drawer-overlay" aria-label="Fechar filtros" onClick={onClose} tabIndex={-1} />
      <aside className="drawer">
        <header className="drawer-head">
          <h2>Filtrar por</h2>
          <button ref={closeRef} type="button" className="drawer-close" aria-label="Fechar filtros" onClick={onClose}>✕</button>
        </header>
        <div className="fbody">
          {facets.ageGroups.length > 1 && section("faixa", "Faixa etária", draft.faixa.length, checks(facets.ageGroups, "faixa"))}
          {section("genero", "Gênero", draft.genero.length, checks(facets.genders.map((g) => ({ ...g, name: genderName(g.slug, onlyKids(draft)) })), "genero"))}
          {section("categoria", "Categoria", draft.categoria.length, checks(facets.categories, "categoria"))}
          {facets.brands.length > 1 && section("marca", "Marca", draft.marca.length, checks(facets.brands, "marca"))}
          {price && price.max > price.min && section("preco", "Preço", draft.min !== undefined || draft.max !== undefined ? 1 : 0, (
            <div className="frange">
              <div className="frange-track">
                <span className="frange-fill" style={{ left: `${((lo - price.min) / (price.max - price.min)) * 100}%`, right: `${100 - ((hi - price.min) / (price.max - price.min)) * 100}%` }} />
                <input type="range" aria-label="Preço mínimo" min={price.min} max={price.max} value={lo} onChange={(e) => setPrice(Math.min(Number(e.target.value), hi), hi)} />
                <input type="range" aria-label="Preço máximo" min={price.min} max={price.max} value={hi} onChange={(e) => setPrice(lo, Math.max(Number(e.target.value), lo))} />
              </div>
              <div className="frange-values"><span>{brl(lo)}</span><span>{brl(hi)}</span></div>
            </div>
          ))}
          {facets.colors.length > 0 && section("cor", "Cor", draft.cor.length, (
            <ul className="fchecks">
              {facets.colors.map((color) => (
                <li key={color}>
                  <label>
                    <input type="checkbox" checked={draft.cor.includes(color)} onChange={() => setDraft({ ...draft, cor: toggle(draft.cor, color) })} />
                    <i className="fswatch" style={{ background: SWATCH[color.toLowerCase()] ?? "#cfcfcf" }} aria-hidden="true" />
                    <span>{color}</span>
                  </label>
                </li>
              ))}
            </ul>
          ))}
          {facets.sizes.length > 0 && section("numeracao", "Numeração", draft.numeracao.length, (
            <div className="fsizes">
              {facets.sizes.map((size) => (
                <button key={size} type="button" className={draft.numeracao.includes(String(size)) ? "is-active" : undefined} aria-pressed={draft.numeracao.includes(String(size))} onClick={() => setDraft({ ...draft, numeracao: toggle(draft.numeracao, String(size)) })}>
                  {size}
                </button>
              ))}
            </div>
          ))}
        </div>
        <footer className="ffoot">
          <button type="button" className="btn btn-outline" onClick={() => onApply(EMPTY)}>Limpar filtros</button>
          <button type="button" className="btn btn-solid" onClick={() => onApply(draft)}>Aplicar filtros</button>
        </footer>
      </aside>
    </div>
  );
}
