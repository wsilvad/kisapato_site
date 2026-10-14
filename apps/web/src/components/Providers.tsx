"use client";

import { CartDrawer } from "@/components/CartDrawer";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { SessionProvider } from "@/lib/session";

export function Providers({ children, freeShippingAbove = 0 }: { children: React.ReactNode; freeShippingAbove?: number }) {
  return (
    <SessionProvider>
      <FavoritesProvider>
        <CartProvider>
          {children}
          <CartDrawer freeAbove={freeShippingAbove} />
        </CartProvider>
      </FavoritesProvider>
    </SessionProvider>
  );
}
