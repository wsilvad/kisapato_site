"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Sobre o produto": o texto aparece em cerca de 6 linhas, com degradê, e o botão "Ler mais" abre o resto.
 * O botão só existe quando o texto realmente passa de 6 linhas (em qualquer largura de tela).
 */
export function AboutProduct({ description, care, specs }: { description: string | null; care: string | null; specs: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => !open && setOverflows(el.scrollHeight > el.clientHeight + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, description]);

  return (
    <section className="about" aria-labelledby="about-title">
      <h2 id="about-title">Sobre o produto</h2>
      {description ? (
        <>
          <div ref={box} className={`about-text${open ? " is-open" : overflows ? " is-clamped" : ""}`} id="about-text">{description}</div>
          {(overflows || open) && (
            <button type="button" className="about-more" aria-expanded={open} aria-controls="about-text" onClick={() => setOpen((o) => !o)}>
              {open ? "Ler menos" : "Ler mais"}
            </button>
          )}
        </>
      ) : (
        <p className="about-empty">Este produto ainda não tem descrição.</p>
      )}

      {specs.length > 0 && (
        <dl className="about-specs">
          {specs.map((s) => (
            <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
          ))}
        </dl>
      )}

      {care && (
        <details className="about-care">
          <summary>Cuidados e conservação</summary>
          <p>{care}</p>
        </details>
      )}
    </section>
  );
}
