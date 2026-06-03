import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";

/** A denormalized cart line — carries everything needed to render and total
 * the cart without a live catalog fetch. */
export interface CartItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  image: ImageSourcePropType | null;
  categoryId: string | null;
  /** Known available units captured when added. null = unknown (no cap),
   * a number caps how many of this part may sit in the cart. */
  stock: number | null;
  qty: number;
}

/** The product fields required to add something to the cart. */
export type CartProduct = Omit<CartItem, "qty">;

interface CartState {
  items: CartItem[];
  count: number;
  add: (product: CartProduct, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: number; // IVA incluido
  iva: number;
  base: number; // subtotal sin IVA
  total: number;
}

const STORAGE_KEY = "carper.cart.v2";
const IVA_RATE = 0.16;

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) setItems(data);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const save = (next: CartItem[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const add = (product: CartProduct, qty: number = 1) => {
    setItems((prev) => {
      // null stock = unknown availability, so no cap; a number caps the line.
      const cap = product.stock == null ? Infinity : Math.max(0, product.stock);
      if (cap <= 0) return prev; // confirmed out of stock — nothing to add
      const existing = prev.find((i) => i.id === product.id);
      const next = existing
        ? prev.map((i) =>
            i.id === product.id ? { ...i, ...product, qty: Math.min(i.qty + qty, cap) } : i,
          )
        : [...prev, { ...product, qty: Math.min(qty, cap) }];
      save(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      save(next);
      return next;
    });
  };

  const setQty = (id: string, qty: number) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      // Cap to the line's known availability (null = unknown = no cap). This
      // also clamps a stale/restored line down to the current count.
      const cap = item && item.stock != null ? Math.max(0, item.stock) : Infinity;
      const clamped = Math.min(qty, cap);
      const next =
        clamped <= 0
          ? prev.filter((i) => i.id !== id)
          : prev.map((i) => (i.id === id ? { ...i, qty: clamped } : i));
      save(next);
      return next;
    });
  };

  const clear = () => {
    setItems([]);
    save([]);
  };

  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const base = total / (1 + IVA_RATE);
  const iva = total - base;

  return (
    <CartContext.Provider value={{ items, count, add, remove, setQty, clear, subtotal: total, iva, base, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
