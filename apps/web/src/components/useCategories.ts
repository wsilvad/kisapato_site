"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/types/product";

const cache = new Map<string, Category[]>();

/**
 * Categorias que têm produtos na seleção atual (selo, faixa etária e gênero), para nenhum link do menu levar a
 * uma página vazia. Devolve `null` enquanto carrega; cada seleção fica em cache.
 */
export function useCategories(selo: string, faixa: string, genero: string) {
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

  return categories;
}
