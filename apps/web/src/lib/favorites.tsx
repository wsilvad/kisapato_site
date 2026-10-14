"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface FavoritesValue {
  slugs: string[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

const KEY = "ki-sapato:favorites";
const FavoritesContext = createContext<FavoritesValue | null>(null);

/** Favoritos ficam neste aparelho (sem login), como a sacola. */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata do localStorage após a montagem (evita mismatch de SSR)
      if (Array.isArray(saved)) setSlugs(saved.filter((x): x is string => typeof x === "string"));
    } catch {
      /* lista corrompida: começa vazia */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(slugs));
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  }, [slugs, ready]);

  const toggle = useCallback((slug: string) => setSlugs((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur])), []);
  const value = useMemo<FavoritesValue>(() => ({ slugs, has: (slug) => slugs.includes(slug), toggle }), [slugs, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites fora do FavoritesProvider");
  return ctx;
}
