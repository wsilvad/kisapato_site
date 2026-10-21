"use client";

import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface FavoritesValue {
  slugs: string[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
}

const KEY = "ki-sapato:favorites";
const FavoritesContext = createContext<FavoritesValue | null>(null);

/**
 * Sem login, os favoritos ficam neste aparelho. Com o cliente logado, ficam salvos na conta: ao entrar, os do aparelho
 * são somados aos da conta e, a partir daí, cada favoritar/desfavoritar também é gravado na API (o aparelho serve de cópia).
 */
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const { user, loading } = useSession();
  const userId = user?.id ?? null;
  const synced = useRef<string | null>(null);

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

  // Logou: junta os do aparelho com os da conta. Deslogou: libera para a próxima conta.
  useEffect(() => {
    if (!ready || loading) return;
    if (!userId) {
      // saiu da conta: os favoritos dela não ficam no aparelho (pode ser compartilhado)
      if (synced.current) setSlugs([]);
      synced.current = null;
      return;
    }
    if (synced.current === userId) return;
    synced.current = userId;
    api.account
      .mergeFavorites(slugs)
      .then((r) => setSlugs(r.slugs))
      .catch(() => {
        synced.current = null; // API fora do ar: segue com a lista do aparelho e tenta de novo no próximo login
      });
    // só reage a login/logout: a lista em si é lida uma vez, no momento da junção
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loading, userId]);

  const toggle = useCallback(
    (slug: string) => {
      const adding = !slugs.includes(slug);
      setSlugs((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur]));
      if (synced.current) (adding ? api.account.addFavorite(slug) : api.account.removeFavorite(slug)).catch(() => undefined);
    },
    [slugs],
  );
  const value = useMemo<FavoritesValue>(() => ({ slugs, has: (slug) => slugs.includes(slug), toggle }), [slugs, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites fora do FavoritesProvider");
  return ctx;
}
