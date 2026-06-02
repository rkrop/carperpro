import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { Product } from "@/data/catalog";
import { STORE, Store } from "@/lib/store";

export interface SavedVehicle {
  marca: string;
  modelo: string;
  anio: string;
  motor: string;
}

export interface OrderLine {
  id: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  folio: string;
  date: string;
  total: number;
  lines: OrderLine[];
  entrega: "tienda" | "envio";
  pago: string;
}

/** Local notification preferences (no backend yet — stored on the device). */
export interface NotifPrefs {
  ofertas: boolean;
  pedidos: boolean;
  reabasto: boolean;
  novedades: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  ofertas: true,
  pedidos: true,
  reabasto: true,
  novedades: false,
};

interface AppState {
  /** The single Carper store. Named `sucursal` for app-wide consistency. */
  sucursal: Store;

  vehicle: SavedVehicle | null;
  setVehicle: (v: SavedVehicle | null) => void;

  favorites: Product[];
  toggleFavorite: (p: Product) => void;
  isFavorite: (id: string) => boolean;

  recent: Product[];
  addRecent: (p: Product) => void;

  orders: Order[];
  addOrder: (o: Order) => void;

  notifPrefs: NotifPrefs;
  setNotifPref: (key: keyof NotifPrefs, value: boolean) => void;

  /** Wipes local profile data (vehicle, favorites, recent, orders). */
  clearData: () => void;

  hydrated: boolean;
}

const STORAGE_KEY = "carper.app.v2";

const AppContext = createContext<AppState | undefined>(undefined);

const DEFAULT_VEHICLE: SavedVehicle = {
  marca: "NISSAN",
  modelo: "TSURU",
  anio: "1992",
  motor: "1.6L",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [vehicle, setVehicleState] = useState<SavedVehicle | null>(DEFAULT_VEHICLE);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.vehicle !== undefined) setVehicleState(data.vehicle);
          if (Array.isArray(data.favorites)) setFavorites(data.favorites);
          if (Array.isArray(data.recent)) setRecent(data.recent);
          if (Array.isArray(data.orders)) setOrders(data.orders);
          if (data.notifPrefs && typeof data.notifPrefs === "object") {
            setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...data.notifPrefs });
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const persist = (
    next: Partial<{
      vehicle: SavedVehicle | null;
      favorites: Product[];
      recent: Product[];
      orders: Order[];
      notifPrefs: NotifPrefs;
    }>,
  ) => {
    const snapshot = {
      vehicle: next.vehicle !== undefined ? next.vehicle : vehicle,
      favorites: next.favorites ?? favorites,
      recent: next.recent ?? recent,
      orders: next.orders ?? orders,
      notifPrefs: next.notifPrefs ?? notifPrefs,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  };

  const setVehicle = (v: SavedVehicle | null) => {
    setVehicleState(v);
    persist({ vehicle: v });
  };

  const toggleFavorite = (p: Product) => {
    setFavorites((prev) => {
      const next = prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [p, ...prev];
      persist({ favorites: next });
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  const addRecent = (p: Product) => {
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x.id !== p.id)].slice(0, 10);
      persist({ recent: next });
      return next;
    });
  };

  const addOrder = (o: Order) => {
    setOrders((prev) => {
      const next = [o, ...prev];
      persist({ orders: next });
      return next;
    });
  };

  const setNotifPref = (key: keyof NotifPrefs, value: boolean) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: value };
      persist({ notifPrefs: next });
      return next;
    });
  };

  const clearData = () => {
    setVehicleState(null);
    setFavorites([]);
    setRecent([]);
    setOrders([]);
    persist({ vehicle: null, favorites: [], recent: [], orders: [] });
  };

  return (
    <AppContext.Provider
      value={{
        sucursal: STORE,
        vehicle,
        setVehicle,
        favorites,
        toggleFavorite,
        isFavorite,
        recent,
        addRecent,
        orders,
        addOrder,
        notifPrefs,
        setNotifPref,
        clearData,
        hydrated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function vehicleLabel(v: SavedVehicle | null): string {
  if (!v) return "Selecciona tu vehículo";
  return `${v.marca} ${v.modelo}`;
}

export function vehicleSub(v: SavedVehicle | null): string {
  if (!v) return "Para buscar más rápido";
  return `${v.motor} • ${v.anio}`;
}
