"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Carrossel por rolagem com encaixe (CSS scroll-snap): no celular o dedo já desliza as fotos, e no computador as
 * setas e os botões rolam até a foto. Devolve a foto atual (calculada pela posição da rolagem) e os controles.
 */
export function useCarousel(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el && el.clientWidth > 0) setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }, [count]);

  const goTo = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: Math.min(count - 1, Math.max(0, i)) * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [count],
  );

  return { ref, index, onScroll, goTo, prev: () => goTo(index - 1), next: () => goTo(index + 1) };
}
