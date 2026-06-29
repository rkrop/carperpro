import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface CartItem {
  sku: string;
  id: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
  quoteOnly?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  removeItem: (sku: string) => void;
  updateQty: (sku: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback((item: Omit<CartItem, "qty"> & { qty?: number }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === item.sku);
      if (existing) {
        return prev.map((i) =>
          i.sku === item.sku ? { ...i, qty: i.qty + (item.qty ?? 1) } : i,
        );
      }
      return [...prev, { ...item, qty: item.qty ?? 1 }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const updateQty = useCallback((sku: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.sku !== sku));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.sku === sku ? { ...i, qty } : i)),
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, itemCount, total, isOpen, openCart, closeCart, addItem, removeItem, updateQty, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
