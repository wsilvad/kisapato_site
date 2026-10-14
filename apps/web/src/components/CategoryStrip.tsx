"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/types/product";

const cache = new Map<string, Category[]>();

/**
 * Segunda linha do menu: as categorias da seleção escolhida em cima (todos os produtos, lançamentos ou
 * promoções). Só lista categorias que têm produtos naquela seleção, para nenhum link levar a uma página vazia.
 */
export function CategoryStrip({ selo, audience, active }: { selo: string; audience: string; active: string | null }) {
  const key = `${selo}|${audience}`;
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
      .listCategories(selo || undefined, audience || undefined)
      .then((list) => {
        cache.set(key, list);
        if (!cancelled) setCategories(list);
      })
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [key, selo, audience]);

  const href = (slug?: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("categoria", slug);
    if (selo) query.set("selo", selo);
    if (audience) query.set("publico", audience);
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
