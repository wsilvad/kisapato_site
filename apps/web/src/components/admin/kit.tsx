"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api, assetUrl, thumbUrl } from "@/lib/api";

export const slugify = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** ISO do banco → valor de <input type="datetime-local"> (horário local). */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

type Resource = Parameters<typeof api.admin.list>[0];

/** Carrega uma coleção do admin e expõe `reload`. */
export function useAdminList<T>(resource: Resource) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setItems(await api.admin.list<T>(resource));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [resource]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);
  return { items, setItems, loading, error, setError, reload };
}

/** Miniatura para tabelas; sem imagem mostra um quadro vazio. */
export function Thumb({ url, wide }: { url: string | null | undefined; wide?: boolean }) {
  const src = thumbUrl(url);
  const className = `thumb${wide ? " thumb-wide" : ""}`;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className={className} src={src} alt="" /> : <span className={`${className} thumb-empty`} />;
}

export function PageHead({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="admin-head">
      <div>
        <h1 className="admin-title">{title}</h1>
        {hint && <p className="admin-hint">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (ok) return <p className="form-ok" role="status">{ok}</p>;
  return null;
}

export function Badge({ tone = "muted", children }: { tone?: "ok" | "warn" | "off" | "muted"; children: React.ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      {label}
    </label>
  );
}

/** Interruptor compacto para tabelas (ex.: ativo/inativo). O rótulo vai para quem usa leitor de tela. */
export function RowSwitch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="switch switch-sm" title={label}>
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

/** Botão que pede confirmação inline antes de executar uma ação destrutiva. */
export function ConfirmButton({ onConfirm, children, message }: { onConfirm: () => void | Promise<void>; children: React.ReactNode; message: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="link-btn danger" onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirm">
      <span>{message}</span>
      <button
        type="button"
        className="link-btn danger"
        onClick={async () => {
          setAsking(false);
          await onConfirm();
        }}
      >
        Sim
      </button>
      <button type="button" className="link-btn" onClick={() => setAsking(false)}>
        Não
      </button>
    </span>
  );
}

function useUpload(onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null): Promise<string[]> {
    if (!files?.length) return [];
    setBusy(true);
    try {
      return (await api.admin.upload(files)).urls;
    } catch (e) {
      onError((e as Error).message);
      return [];
    } finally {
      setBusy(false);
    }
  }
  return { busy, upload };
}

/** Uma imagem (banner, foto de categoria). */
export function ImageField({ label, value, onChange, hint }: { label: string; value: string | null | undefined; onChange: (url: string | null) => void; hint?: string }) {
  const [error, setError] = useState("");
  const { busy, upload } = useUpload(setError);
  const input = useRef<HTMLInputElement>(null);
  const src = assetUrl(value);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="image-field">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" /> : <div className="image-empty">Sem imagem</div>}
        <div className="image-actions">
          <button type="button" className="btn-small" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Enviando…" : src ? "Trocar" : "Escolher imagem"}
          </button>
          {src && (
            <button type="button" className="link-btn danger" onClick={() => onChange(null)}>
              Remover
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={async (e) => {
            const [url] = await upload(e.target.files);
            e.target.value = "";
            if (url) {
              setError("");
              onChange(url);
            }
          }}
        />
      </div>
      {hint && <small className="field-hint">{hint}</small>}
      <Notice error={error} />
    </div>
  );
}

/** Várias fotos; a primeira é a principal e a ordem pode ser alterada. */
export function ImageGallery({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const [error, setError] = useState("");
  const { busy, upload } = useUpload(setError);
  const input = useRef<HTMLInputElement>(null);

  function move(index: number, to: number) {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    onChange(next);
  }

  return (
    <div className="field">
      <span className="field-label">Fotos (a primeira é a principal)</span>
      <div className="gallery">
        {value.map((url, i) => (
          <figure key={url} className="gallery-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl(url)} alt="" />
            {i === 0 && <figcaption>Principal</figcaption>}
            <div className="gallery-actions">
              <button type="button" aria-label="Mover para trás" disabled={i === 0} onClick={() => move(i, i - 1)}>←</button>
              <button type="button" aria-label="Mover para frente" disabled={i === value.length - 1} onClick={() => move(i, i + 1)}>→</button>
              <button type="button" aria-label="Remover foto" onClick={() => onChange(value.filter((u) => u !== url))}>✕</button>
            </div>
          </figure>
        ))}
        <button type="button" className="gallery-add" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Enviando…" : "+ Adicionar fotos"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={async (e) => {
          const urls = await upload(e.target.files);
          e.target.value = "";
          if (urls.length) {
            setError("");
            onChange([...value, ...urls]);
          }
        }}
      />
      <Notice error={error} />
    </div>
  );
}

/**
 * Endereço (slug) do item. Enquanto o item é novo ele acompanha o nome sozinho; o usuário pode
 * digitar outro valor ou clicar em "Gerar do nome" para voltar ao automático.
 */
export function SlugField({ value, name, prefix, onChange }: { value: string; name: string; prefix: string; onChange: (slug: string) => void }) {
  return (
    <label>
      Endereço (slug)
      <span className="slug-row">
        <input value={value} required onChange={(e) => onChange(slugify(e.target.value))} />
        <button type="button" className="btn-small" disabled={!name.trim()} onClick={() => onChange(slugify(name))}>Gerar do nome</button>
      </span>
      <small>Link: {prefix}{value || "…"}. Mudar o endereço de algo que já está no ar quebra os links antigos.</small>
    </label>
  );
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface SearchOption {
  id: string;
  label: string;
  /** Texto auxiliar à direita (ex.: a classe da categoria). */
  hint?: string;
}

/**
 * Lista suspensa com pesquisa (ignora acentos e maiúsculas). Se `onCreate` for informado e o texto
 * digitado não existir, oferece "Cadastrar «texto»" ao final da lista.
 */
export function SearchSelect({ label, options, value, onChange, placeholder, required, onCreate, createLabel = "Cadastrar" }: {
  label: string;
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  onCreate?: (name: string) => void;
  createLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.id === value);

  const matches = useMemo(() => {
    const q = normalize(query);
    return q ? options.filter((o) => normalize(`${o.label} ${o.hint ?? ""}`).includes(q)) : options;
  }, [options, query]);
  const canCreate = !!onCreate && !!query.trim() && !options.some((o) => normalize(o.label) === normalize(query));
  const rows = canCreate ? [...matches.map((o) => ({ kind: "option" as const, option: o })), { kind: "create" as const }] : matches.map((o) => ({ kind: "option" as const, option: o }));

  function pick(index: number) {
    const row = rows[index];
    if (!row) return;
    setOpen(false);
    setQuery("");
    if (row.kind === "create") onCreate?.(query.trim());
    else onChange(row.option.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="field search-select">
      <span className="field-label">{label}</span>
      <div className="search-box">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected ? selected.label : (placeholder ?? "Pesquisar…")}
          required={required && !value}
          autoComplete="off"
          onFocus={(e) => {
            e.target.select(); // digitar logo ao focar substitui a seleção atual em vez de acrescentar a ela
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {value && !required && (
          <button type="button" className="search-clear" aria-label={`Limpar ${label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange("")}>
            ✕
          </button>
        )}
        {open && (
          <ul id={listId} role="listbox" className="search-list">
            {rows.length === 0 && <li className="search-empty">Nada encontrado</li>}
            {rows.map((row, i) => (
              <li
                key={row.kind === "create" ? "__create" : row.option.id}
                role="option"
                aria-selected={i === active}
                className={`${i === active ? "is-active" : ""}${row.kind === "create" ? " search-create" : ""}`}
                // mousedown (e não click) para disparar antes do blur do campo
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {row.kind === "create" ? (
                  <>+ {createLabel} “{query.trim()}”</>
                ) : (
                  <>
                    {row.option.label}
                    {row.option.hint && <small>{row.option.hint}</small>}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Botões ↑/↓ para itens ordenados por `sortOrder`. */
export function MoveButtons({ index, total, onMove }: { index: number; total: number; onMove: (direction: -1 | 1) => void }) {
  return (
    <span className="move">
      <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
      <button type="button" aria-label="Descer" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
    </span>
  );
}

/**
 * Move um item na lista e regrava o `sortOrder` de todos que mudaram de posição.
 * `save` recebe o item já com a nova ordem.
 */
export async function reorder<T extends { id: string; sortOrder?: number }>(items: T[], index: number, direction: -1 | 1, save: (item: T) => Promise<unknown>) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target]!, next[index]!];
  await Promise.all(next.map((item, position) => (item.sortOrder === position ? null : save({ ...item, sortOrder: position }))));
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}
