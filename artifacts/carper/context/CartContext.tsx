import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ImageSourcePropType } from "react-native";

/** A denormalized cart line — carries everything needed to render and total
 * the cart without a live catalog fetch. */
export interface CartItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  /** Consultation-only product (no sellable price). Must never enter the cart;
   * add() rejects it defensively. */
  quoteOnly?: boolean;
  image: ImageSourcePropType | null;
  categoryId: string | null;
  /** Known available units captured when added. null = unknown (no cap),
   * a number caps how many of this part may sit in the cart. */
  stock: number | null;
  qty: number;
}

/** The product fields required to add something to the cart. */
export type CartProduct = Omit<CartItem, "qty">;

/** A line whose quantity was clamped down because stock dropped. */
export interface ClampedLine {
  id: string;
  name: string;
  available: number;
  previousQty: number;
}

/** A line removed because its product is now confirmed out of stock / gone. */
export interface RemovedLine {
  id: string;
  name: string;
}

/** What changed when refreshing the cart against current stock. */
export interface StockRefreshResult {
  clamped: ClampedLine[];
  removed: RemovedLine[];
}

/** Current stock per product id: a number (cap), or null = unknown (no cap). */
export type StockUpdates = Record<string, number | null>;

interface CartState {
  items: CartItem[];
  count: number;
  add: (product: CartProduct, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  /** Re-apply current stock to saved lines: refresh caps, clamp over-limit
   * lines, drop confirmed-0 lines. Returns what changed so the UI can warn. */
  refreshStock: (updates: StockUpdates) => StockRefreshResult;
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
  // Mirror of `items` for reads inside refreshStock, which must compute the diff
  // (clamped/removed) from the latest list without relying on a stale closure.
  const itemsRef = useRef<CartItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            // Clamp restored lines to their known stock: drop confirmed-0 lines,
            // cap over-limit ones. Unknown stock (null) is left untouched.
            const normalized = (data as CartItem[])
              .map((i) =>
                i.stock != null && i.qty > i.stock ? { ...i, qty: Math.max(0, i.stock) } : i,
              )
              .filter((i) => i.qty > 0);
            setItems(normalized);
            save(normalized);
          }
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
      // Ficha "para consulta": producto sin precio publicado, no se vende.
      if (product.quoteOnly) return prev;
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

  const refreshStock = (updates: StockUpdates): StockRefreshResult => {
    const current = itemsRef.current;
    const clamped: ClampedLine[] = [];
    const removed: RemovedLine[] = [];
    const next: CartItem[] = [];

    for (const item of current) {
      // An id we didn't get fresh stock for keeps its existing cap untouched.
      if (!(item.id in updates)) {
        next.push(item);
        continue;
      }
      const stock = updates[item.id];
      // Unknown availability (null) → no cap; clear any stale numeric cap.
      if (stock == null) {
        next.push({ ...item, stock: null });
        continue;
      }
      // Confirmed out of stock (0 or less) → drop the line and report it.
      if (stock <= 0) {
        removed.push({ id: item.id, name: item.name });
        continue;
      }
      // Stock dropped below the saved quantity → clamp and report it.
      if (item.qty > stock) {
        clamped.push({ id: item.id, name: item.name, available: stock, previousQty: item.qty });
        next.push({ ...item, stock, qty: stock });
        continue;
      }
      // Still enough stock; just refresh the cap.
      next.push({ ...item, stock });
    }

    setItems(next);
    save(next);
    itemsRef.current = next;
    return { clamped, removed };
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
    <CartContext.Provider value={{ items, count, add, remove, setQty, clear, refreshStock, subtotal: total, iva, base, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
