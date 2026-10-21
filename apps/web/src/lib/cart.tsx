"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/track";

export interface CartLine {
  variantId: string;
  /** products.id (sacolas antigas, de antes da medição, não têm; nelas o retrato usa o slug). */
  productId?: string;
  slug: string;
  name: string;
  image?: string;
  size: number;
  /** Rótulo mostrado no lugar do número (grade de confecção). */
  sizeLabel?: string | null;
  color: string;
  price: string;
  quantity: number;
  stock: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  total: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  /** Carrinho lateral (aparece ao adicionar um produto). */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Última variação adicionada, para destacá-la na gaveta. */
  lastAdded: string | null;
}

const CART_KEY = "ki-sapato:cart";
const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata do localStorage após a montagem (evita mismatch de SSR)
      setLines(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]"));
    } catch {
      // carrinho corrompido: começa vazio
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  // medição: a sacola atual fica numa referência para os eventos saberem o valor depois da mudança
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  // medição: retrato da sacola depois de cada mudança (com espera, para juntar mudanças seguidas). Sacola vazia só é registrada
  // depois de ter tido itens; assim o carrinho abandonado e o carrinho esvaziado são distinguíveis.
  const lastSnapshot = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const key = JSON.stringify(lines.map((l) => [l.variantId, l.quantity, l.price]));
    if (lastSnapshot.current === null) {
      // ao abrir uma página: sacola vazia não vira evento; sacola cheia já registrada nesta aba (mesma composição) também não
      let seen: string | null = null;
      try {
        seen = window.sessionStorage.getItem("ks:cart-snap");
      } catch {
        /* sem armazenamento */
      }
      if (lines.length === 0 || seen === key) {
        lastSnapshot.current = key;
        return;
      }
    }
    if (key === lastSnapshot.current) return;
    const timer = setTimeout(() => {
      lastSnapshot.current = key;
      try {
        window.sessionStorage.setItem("ks:cart-snap", key);
      } catch {
        /* sem armazenamento */
      }
      track("cart_updated", {
        cart_value: lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0),
        items_count: lines.length,
        props: { items: lines.map((l) => ({ item_id: l.productId ?? l.slug, variant_id: l.variantId, item_name: l.name, price: Number(l.price), quantity: l.quantity })) },
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [lines, ready]);

  const add = useCallback<CartValue["add"]>((line, quantity = 1) => {
    {
      const current = linesRef.current;
      const had = current.find((l) => l.variantId === line.variantId)?.quantity ?? 0;
      const qty = Math.min(had + quantity, line.stock) - had;
      const value = current.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0) + Number(line.price) * qty;
      track("add_to_cart", { product_id: line.productId ?? null, variant_id: line.variantId, price: Number(line.price), quantity: qty, cart_value: value, props: { items: [{ item_id: line.productId ?? line.slug, variant_id: line.variantId, item_name: line.name, price: Number(line.price), quantity: qty }] } });
    }
    setLastAdded(line.variantId);
    setDrawerOpen(true);
    setLines((current) => {
      const existing = current.find((l) => l.variantId === line.variantId);
      if (!existing) return [...current, { ...line, quantity: Math.min(quantity, line.stock) }];
      return current.map((l) =>
        l.variantId === line.variantId ? { ...l, stock: line.stock, quantity: Math.min(l.quantity + quantity, line.stock) } : l,
      );
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const line = linesRef.current.find((l) => l.variantId === variantId);
    if (line) {
      const q = Math.max(1, Math.min(quantity, line.stock));
      const value = linesRef.current.reduce((sum, l) => sum + Number(l.price) * (l.variantId === variantId ? q : l.quantity), 0);
      track("cart_qty_change", { product_id: line.productId ?? null, variant_id: variantId, price: Number(line.price), quantity: q, cart_value: value });
    }
    setLines((current) =>
      current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(quantity, l.stock)) } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    const line = linesRef.current.find((l) => l.variantId === variantId);
    if (line) {
      const value = linesRef.current.reduce((sum, l) => sum + (l.variantId === variantId ? 0 : Number(l.price) * l.quantity), 0);
      track("remove_from_cart", { product_id: line.productId ?? null, variant_id: variantId, price: Number(line.price), quantity: line.quantity, cart_value: value, props: { items: [{ item_id: line.productId ?? line.slug, variant_id: variantId, item_name: line.name, price: Number(line.price), quantity: line.quantity }] } });
    }
    setLines((c) => c.filter((l) => l.variantId !== variantId));
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      total: lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      drawerOpen,
      openDrawer: () => {
        setLastAdded(null);
        setDrawerOpen(true);
      },
      closeDrawer: () => setDrawerOpen(false),
      lastAdded,
    }),
    [lines, add, setQuantity, remove, clear, drawerOpen, lastAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
