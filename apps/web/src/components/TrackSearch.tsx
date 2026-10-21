"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/** Registra uma busca (termo e quantos resultados voltaram) quando a lista de produtos é aberta com `?busca=`. */
export function TrackSearch({ term, results, filters }: { term: string; results: number; filters: string }) {
  useEffect(() => {
    track("search", { search_term: term, results_count: results, props: filters ? { filters } : {} });
  }, [term, results, filters]);
  return null;
}
