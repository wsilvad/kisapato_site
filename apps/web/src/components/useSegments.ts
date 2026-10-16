"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Facets } from "@/types/product";

type Data = Pick<Facets, "segments" | "total">;
const NONE: Data = { segments: { adulto: { total: 0, feminino: 0, masculino: 0 }, infantil: { total: 0, feminino: 0, masculino: 0 } }, total: 0 };

// Uma busca só para todos os itens do menu, compartilhada e guardada; seleções fora da lista caem no /facets.
let menu: Promise<Record<string, Data>> | null = null;
const known = new Map<string, Data>();
const extra = new Map<string, Promise<Data>>();

function loadMenu() {
  menu ??= api
    .menuSegments()
    .then((all) => {
      for (const [selo, data] of Object.entries(all)) known.set(selo, data);
      return all;
    })
    .catch(() => {
      menu = null;
      return {};
    });
  return menu;
}

function loadSelo(selo: string): Promise<Data> {
  return loadMenu().then((all) => {
    if (all[selo]) return all[selo];
    if (!extra.has(selo)) {
      extra.set(
        selo,
        api.productFacets({ selo }).then(
          (f) => {
            const data = { segments: f.segments, total: f.total };
            known.set(selo, data);
            return data;
          },
          () => NONE,
        ),
      );
    }
    return extra.get(selo)!;
  });
}

/** Começa a buscar as contagens do menu já ao carregar a página, para o submenu abrir pronto. */
export function prefetchSegments() {
  void loadMenu();
}

export interface SegmentEntry {
  key: string;
  label: string;
  href: string;
  count: number;
}

/**
 * Opções de público de um item do menu (Feminino, Masculino e Infantil), com a quantidade de produtos de cada uma
 * na seleção do item (`url`, ex.: /produtos?selo=lancamento). Unissex conta nos dois gêneros e o que não tem
 * produto some. Menina e Menino não entram aqui: a escolha aparece dentro da página de Infantil. As contagens vêm
 * de uma única chamada para o menu inteiro, feita ao carregar a página (`prefetchSegments`).
 */
export function useSegments(url: string, enabled: boolean) {
  const target = new URL(url, "http://loja");
  const selo = target.searchParams.get("selo") ?? "";
  const [data, setData] = useState<Data | null>(known.get(selo) ?? null);

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    void loadSelo(selo).then((value) => !cancelled && setData(value));
    return () => {
      cancelled = true;
    };
  }, [enabled, selo, data]);

  const href = (faixa: string, genero?: string) => {
    const params = new URLSearchParams(target.search);
    params.set("faixa", faixa);
    if (genero) params.set("genero", genero);
    return `/produtos?${params}`;
  };
  const current = data ?? known.get(selo) ?? null;
  const { adulto, infantil } = (current ?? NONE).segments;
  const entries: SegmentEntry[] = [
    { key: "f", label: "Feminino", href: href("adulto", "feminino"), count: adulto.feminino },
    { key: "m", label: "Masculino", href: href("adulto", "masculino"), count: adulto.masculino },
    { key: "i", label: "Infantil", href: href("infantil"), count: infantil.total },
  ].filter((e) => e.count > 0);

  return { entries, total: current?.total ?? 0, ready: current !== null };
}
