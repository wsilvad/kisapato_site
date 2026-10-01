import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/lib/catalog";

export type CartItem = { product: Product; size: number; color: string; quantity: number };
type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: Product, size?: number, color?: string) => void;
  removeItem: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "ki-sapato-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved) as CartItem[]);
    } catch { /* empty cart is safe */ }
  }, []);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);
  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.quantity * item.product.price, 0),
    addItem(product, size = 36, color = "Preto") {
      setItems((current) => {
        const match = current.find((item) => item.product.slug === product.slug && item.size === size && item.color === color);
        return match
          ? current.map((item) => item === match ? { ...item, quantity: item.quantity + 1 } : item)
          : [...current, { product, size, color, quantity: 1 }];
      });
    },
    removeItem(slug) { setItems((current) => current.filter((item) => item.product.slug !== slug)); },
    updateQuantity(slug, quantity) { setItems((current) => current.map((item) => item.product.slug === slug ? { ...item, quantity: Math.max(1, quantity) } : item)); },
    clear() { setItems([]); },
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}