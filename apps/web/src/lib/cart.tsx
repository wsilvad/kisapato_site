"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface CartLine {
  variantId: string;
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

  const add = useCallback<CartValue["add"]>((line, quantity = 1) => {
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
    setLines((current) =>
      current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(quantity, l.stock)) } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => setLines((c) => c.filter((l) => l.variantId !== variantId)), []);
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
