"use client";

import { useState } from "react";
import { useAdminList } from "@/components/admin/kit";
import { audienceHref } from "@/lib/segment";
import type { Audience, Brand, Category, Product, ProductClass } from "@/types/product";

const OTHER = "__outro__";

const PAGES = [
  ["/institucional/quem-somos", "Sobre a Ki Sapato"],
  ["/institucional/trocas-e-devolucoes", "Trocas e devoluções"],
  ["/institucional/politicas-de-entrega", "Políticas de entrega"],
] as const;

/**
 * Escolha de para onde um botão leva: uma seleção da loja, um público, uma categoria, uma classe, uma marca, um
 * produto ou uma página do site; "Outro endereço…" abre um campo livre (ex.: busca, link externo).
 */
export function LinkPicker({ value, onChange, label = "Para onde o botão leva" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const products = useAdminList<Product>("products").items;
  const categories = useAdminList<Category>("categories").items;
  const classes = useAdminList<ProductClass>("classes").items;
  const audiences = useAdminList<Audience>("audiences").items;
  const brands = useAdminList<Brand>("brands").items;

  const groups: [string, [string, string][]][] = [
    [
      "Seleções da loja",
      [
        ["/produtos", "Todos os produtos"],
        ["/produtos?selo=lancamento", "Lançamentos"],
        ["/produtos?selo=promocao", "Promoções"],
        ["/produtos?selo=destaque", "Destaques"],
      ],
    ],
    ["Públicos", audiences.map((a) => [audienceHref(a), a.name])],
    ["Categorias", categories.map((c) => [`/produtos?categoria=${c.slug}`, c.name])],
    ["Classes", classes.map((c) => [`/produtos?classe=${c.slug}`, c.name])],
    ["Marcas", brands.map((b) => [`/produtos?marca=${b.slug}`, b.name])],
    ["Produtos", products.map((p) => [`/produtos/${p.slug}`, p.name])],
    ["Páginas", PAGES.map(([url, name]) => [url, name])],
  ];
  const known = groups.some(([, options]) => options.some(([url]) => url === value));
  const [custom, setCustom] = useState(false);
  const other = custom || (!!value && !known);

  return (
    <div className="field link-picker">
      <label>
        {label}
        <select
          value={other ? OTHER : value}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setCustom(true);
              return;
            }
            setCustom(false);
            onChange(e.target.value);
          }}
        >
          <option value="">Escolha…</option>
          {groups.map(([name, options]) =>
            options.length > 0 ? (
              <optgroup key={name} label={name}>
                {options.map(([url, text]) => (
                  <option key={url} value={url}>
                    {text}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
          <option value={OTHER}>Outro endereço…</option>
        </select>
      </label>
      {other && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/produtos?busca=bota ou https://…" aria-label="Endereço do link" />}
    </div>
  );
}
