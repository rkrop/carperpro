import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { getProduct } from "@/data/catalog";

export interface CartItem {
  id: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  count: number;
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: number; // IVA incluido
  iva: number;
  base: number; // subtotal sin IVA
  total: number;
}

const STORAGE_KEY = "carper.cart.v1";
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

  const add = (id: string, qty: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      const next = existing
        ? prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i))
        : [...prev, { id, qty }];
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
      const next = qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i));
      save(next);
      return next;
    });
  };

  const clear = () => {
    setItems([]);
    save([]);
  };

  const total = items.reduce((sum, item) => {
    const p = getProduct(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

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
