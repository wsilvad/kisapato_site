"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { thumbUrl } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

/**
 * Sacola lateral: abre sozinha ao adicionar um produto (destacando o item) e também pelo ícone da sacola.
 * Fecha com Esc, clique fora ou no X. `freeAbove` (R$) alimenta a barra de progresso do frete grátis.
 */
export function CartDrawer({ freeAbove }: { freeAbove: number }) {
  const { lines, count, total, setQuantity, remove, drawerOpen, closeDrawer, lastAdded } = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // a página não rola por trás
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;
  const missing = freeAbove > 0 ? Math.max(freeAbove - total, 0) : 0;

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Sua sacola">
      <button type="button" className="drawer-overlay" aria-label="Fechar sacola" onClick={closeDrawer} tabIndex={-1} />
      <aside className="drawer">
        <header className="drawer-head">
          <h2>Sua sacola <small>({count} {count === 1 ? "item" : "itens"})</small></h2>
          <button ref={closeRef} type="button" className="drawer-close" aria-label="Fechar sacola" onClick={closeDrawer}>✕</button>
        </header>

        {lastAdded && lines.some((l) => l.variantId === lastAdded) && <p className="drawer-added" role="status">✓ Produto adicionado à sacola</p>}

        {lines.length === 0 ? (
          <div className="drawer-empty">
            <p>Sua sacola está vazia.</p>
            <Link href="/produtos" className="btn btn-solid" onClick={closeDrawer}>Ver produtos</Link>
          </div>
        ) : (
          <>
            {freeAbove > 0 && (
              <div className="drawer-free">
                <span>{missing > 0 ? <>Faltam <strong>{formatPrice(missing)}</strong> para o frete grátis</> : <strong>Você ganhou frete grátis!</strong>}</span>
                <div className="drawer-meter" role="img" aria-label={missing > 0 ? `Faltam ${formatPrice(missing)} para o frete grátis` : "Frete grátis garantido"}><span style={{ width: `${Math.min(100, (total / freeAbove) * 100)}%` }} /></div>
              </div>
            )}
            <ul className="drawer-lines">
              {lines.map((l) => (
                <li key={l.variantId} className={l.variantId === lastAdded ? "is-new" : undefined}>
                  <Link href={`/produtos/${l.slug}`} onClick={closeDrawer} className="drawer-thumb">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl(l.image)} alt="" />
                    ) : (
                      <span />
                    )}
                  </Link>
                  <div className="drawer-info">
                    <Link href={`/produtos/${l.slug}`} onClick={closeDrawer} className="drawer-name">{l.name}</Link>
                    <small>{l.color} · {l.sizeLabel ? `tam. ${l.sizeLabel}` : `nº ${l.size}`}</small>
                    <div className="drawer-row">
                      <div className="qty" role="group" aria-label={`Quantidade de ${l.name}`}>
                        <button type="button" aria-label="Diminuir" disabled={l.quantity <= 1} onClick={() => setQuantity(l.variantId, l.quantity - 1)}>−</button>
                        <span aria-live="polite">{l.quantity}</span>
                        <button type="button" aria-label="Aumentar" disabled={l.quantity >= l.stock} onClick={() => setQuantity(l.variantId, l.quantity + 1)}>+</button>
                      </div>
                      <strong>{formatPrice(Number(l.price) * l.quantity)}</strong>
                    </div>
                    <button type="button" className="link-btn" onClick={() => remove(l.variantId)}>Remover</button>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="drawer-foot">
              <div className="drawer-total"><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
              <small>Frete e prazo calculados no checkout.</small>
              <Link href="/checkout" className="btn btn-solid" onClick={closeDrawer}>Finalizar compra</Link>
              <Link href="/sacola" className="btn btn-outline" onClick={closeDrawer}>Ver sacola completa</Link>
              <button type="button" className="link-btn" onClick={closeDrawer}>Continuar comprando</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
