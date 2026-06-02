import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { SUCURSALES, Sucursal } from "@/data/catalog";

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
  sucursalId: string;
  pago: string;
}

interface AppState {
  sucursal: Sucursal;
  setSucursal: (s: Sucursal) => void;

  vehicle: SavedVehicle | null;
  setVehicle: (v: SavedVehicle | null) => void;

  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  recent: string[];
  addRecent: (id: string) => void;

  orders: Order[];
  addOrder: (o: Order) => void;

  hydrated: boolean;
}

const STORAGE_KEY = "carper.app.v1";

const AppContext = createContext<AppState | undefined>(undefined);

const DEFAULT_VEHICLE: SavedVehicle = {
  marca: "NISSAN",
  modelo: "TSURU",
  anio: "1992",
  motor: "1.6L",
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sucursal, setSucursalState] = useState<Sucursal>(SUCURSALES[0]);
  const [vehicle, setVehicleState] = useState<SavedVehicle | null>(DEFAULT_VEHICLE);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(["2740", "990"]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.sucursalId) {
            const found = SUCURSALES.find((s) => s.id === data.sucursalId);
            if (found) setSucursalState(found);
          }
          if (data.vehicle !== undefined) setVehicleState(data.vehicle);
          if (Array.isArray(data.favorites)) setFavorites(data.favorites);
          if (Array.isArray(data.recent)) setRecent(data.recent);
          if (Array.isArray(data.orders)) setOrders(data.orders);
        }
      } catch {
        // ignore corrupt storage
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const persist = (next: Partial<{ sucursalId: string; vehicle: SavedVehicle | null; favorites: string[]; recent: string[]; orders: Order[] }>) => {
    const snapshot = {
      sucursalId: next.sucursalId ?? sucursal.id,
      vehicle: next.vehicle !== undefined ? next.vehicle : vehicle,
      favorites: next.favorites ?? favorites,
      recent: next.recent ?? recent,
      orders: next.orders ?? orders,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  };

  const setSucursal = (s: Sucursal) => {
    setSucursalState(s);
    persist({ sucursalId: s.id });
  };

  const setVehicle = (v: SavedVehicle | null) => {
    setVehicleState(v);
    persist({ vehicle: v });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      persist({ favorites: next });
      return next;
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  const addRecent = (id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 10);
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

  return (
    <AppContext.Provider
      value={{
        sucursal,
        setSucursal,
        vehicle,
        setVehicle,
        favorites,
        toggleFavorite,
        isFavorite,
        recent,
        addRecent,
        orders,
        addOrder,
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
  if (!v) return "Para ver compatibilidad";
  return `${v.motor} • ${v.anio}`;
}
