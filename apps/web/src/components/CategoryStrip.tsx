"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/types/product";

const cache = new Map<string, Category[]>();

/**
 * Segunda linha do menu: as categorias da seleção escolhida em cima (todos os produtos, lançamentos ou
 * promoções), mantendo a faixa e o gênero escolhidos. Só lista categorias que têm produtos naquela seleção, para
 * nenhum link levar a uma página vazia.
 */
export function CategoryStrip({ selo, faixa, genero, active }: { selo: string; faixa: string; genero: string; active: string | null }) {
  const key = `${selo}|${faixa}|${genero}`;
  const [categories, setCategories] = useState<Category[] | null>(cache.get(key) ?? null);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(key);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de seleção já em cache
      setCategories(cached);
      return;
    }
    api
      .listCategories({ selo, ageGroup: faixa, gender: genero })
      .then((list) => {
        cache.set(key, list);
        if (!cancelled) setCategories(list);
      })
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [key, selo, faixa, genero]);

  const href = (slug?: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("categoria", slug);
    if (selo) query.set("selo", selo);
    if (faixa) query.set("faixa", faixa);
    if (genero) query.set("genero", genero);
    return query.size ? `/produtos?${query}` : "/produtos";
  };

  return (
    <nav className="catbar" aria-label="Categorias">
      <div className="catbar-inner">
        <Link href={href()} className={active === "" ? "is-active" : undefined} aria-current={active === "" ? "page" : undefined}>Ver tudo</Link>
        {(categories ?? []).map((c) => (
          <Link key={c.id} href={href(c.slug)} className={active === c.slug ? "is-active" : undefined} aria-current={active === c.slug ? "page" : undefined}>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
