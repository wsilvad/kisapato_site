"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

/** Nome da lista onde o card aparece, pela página (e pelo atributo data-track-list de um ancestral, quando houver). */
function listNameOf(el: Element): string {
  const tagged = el.closest<HTMLElement>("[data-track-list]")?.dataset.trackList;
  if (tagged) return tagged;
  const { pathname, search } = window.location;
  if (pathname === "/") return "home";
  if (pathname === "/favoritos") return "favoritos";
  if (pathname.startsWith("/produtos/")) return "relacionados";
  if (pathname === "/produtos") return new URLSearchParams(search).has("busca") ? "busca" : "categoria";
  return "outros";
}

/** Posição do card na lista (1 = primeiro), pela ordem dos cards irmãos. */
const positionOf = (el: Element): number => (el.parentElement ? Array.from(el.parentElement.children).indexOf(el) + 1 : 1);

/**
 * Embrulha o card do produto: conta uma exibição quando ele fica ao menos metade visível por 1 segundo (uma vez por card e por
 * página) e um clique quando o cliente abre o produto (links do card; o coração de favoritar não conta).
 */
export function TrackCard({ productId, price, children }: { productId: string; price: number; children: React.ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer ??= setTimeout(() => {
            track("product_impression", { product_id: productId, price, list_name: listNameOf(el), list_position: positionOf(el) });
            io.disconnect();
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [productId, price]);

  return (
    <article
      ref={ref}
      className="card"
      onClickCapture={(e) => {
        if ((e.target as Element).closest("a")) track("product_click", { product_id: productId, price, list_name: listNameOf(e.currentTarget), list_position: positionOf(e.currentTarget) });
      }}
    >
      {children}
    </article>
  );
}
