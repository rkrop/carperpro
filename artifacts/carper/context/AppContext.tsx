import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListFavoritesQueryKey,
  getListMyOrdersQueryKey,
  useAddFavorite,
  useListFavorites,
  useListMyOrders,
  useRemoveFavorite,
  useSyncFavorites,
  type OrderHistoryItem,
  type Product as ApiProduct,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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

/** Map a server order-history row into the app's local `Order` shape. */
function historyToOrder(o: OrderHistoryItem): Order {
  return {
    id: o.id,
    folio: o.folio,
    date: new Date(o.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
    total: o.total,
    lines: o.lines.map((l) => ({ id: l.productId, name: l.name, sku: l.sku, qty: l.qty, price: l.price })),
    entrega: o.entrega === "envio" ? "envio" : "tienda",
    pago: o.pago,
  };
}

/** Reverse mapping for optimistic seeding of the order-history cache. */
function orderToHistory(o: Order): OrderHistoryItem {
  return {
    id: o.id,
    folio: o.folio,
    date: new Date().toISOString(),
    total: o.total,
    entrega: o.entrega,
    pago: o.pago,
    status: "",
    paymentStatus: "",
    lines: o.lines.map((l) => ({ productId: l.id, sku: l.sku, name: l.name, qty: l.qty, price: l.price })),
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  // Local-first storage (always the source of truth for guests; also the
  // migration source the first time a user signs in).
  const [vehicle, setVehicleState] = useState<SavedVehicle | null>(DEFAULT_VEHICLE);
  const [localFavorites, setLocalFavorites] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Server-backed data — only fetched while signed in.
  const favoritesQuery = useListFavorites({
    query: { queryKey: getListFavoritesQueryKey(), enabled: !!isSignedIn },
  });
  const ordersQuery = useListMyOrders({
    query: { queryKey: getListMyOrdersQueryKey(), enabled: !!isSignedIn },
  });
  const addFavMut = useAddFavorite();
  const removeFavMut = useRemoveFavorite();
  const syncFavMut = useSyncFavorites();

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.vehicle !== undefined) setVehicleState(data.vehicle);
          if (Array.isArray(data.favorites)) setLocalFavorites(data.favorites);
          if (Array.isArray(data.recent)) setRecent(data.recent);
          if (Array.isArray(data.orders)) setLocalOrders(data.orders);
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
      favorites: next.favorites ?? localFavorites,
      recent: next.recent ?? recent,
      orders: next.orders ?? localOrders,
      notifPrefs: next.notifPrefs ?? notifPrefs,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  };

  // When signed in, favorites/orders come from the server; otherwise local.
  const serverFavorites = useMemo(
    () => (favoritesQuery.data ?? []) as unknown as Product[],
    [favoritesQuery.data],
  );
  const favorites = isSignedIn ? serverFavorites : localFavorites;

  const serverOrders = useMemo(
    () => (ordersQuery.data ?? []).map(historyToOrder),
    [ordersQuery.data],
  );
  const orders = isSignedIn ? serverOrders : localOrders;

  // First sign-in: upload local favorites to the account once (server dedups),
  // so a guest's saved items follow them onto their account. Flag per user so
  // it never re-runs; on failure we don't set the flag and retry next time.
  useEffect(() => {
    if (!isSignedIn || !userId || !hydrated) return;
    const flagKey = `carper.fav.synced.${userId}`;
    (async () => {
      try {
        if (await AsyncStorage.getItem(flagKey)) return;
        if (localFavorites.length > 0) {
          await syncFavMut.mutateAsync({
            data: { products: localFavorites as unknown as ApiProduct[] },
          });
          queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
        }
        await AsyncStorage.setItem(flagKey, "1");
      } catch {
        // leave the flag unset so the migration is retried on next launch
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userId, hydrated, localFavorites.length]);

  const setVehicle = (v: SavedVehicle | null) => {
    setVehicleState(v);
    persist({ vehicle: v });
  };

  const invalidateFavorites = () =>
    queryClient.invalidateQueries({ queryKey: getListFavoritesQueryKey() });

  const toggleFavorite = (p: Product) => {
    if (isSignedIn) {
      const exists = serverFavorites.some((x) => x.id === p.id);
      if (exists) {
        removeFavMut.mutate({ productId: p.id }, { onSuccess: invalidateFavorites });
      } else {
        addFavMut.mutate(
          { productId: p.id, data: p as unknown as ApiProduct },
          { onSuccess: invalidateFavorites },
        );
      }
      return;
    }
    setLocalFavorites((prev) => {
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
    if (isSignedIn) {
      // The order was already created on the server (tied to the user via the
      // bearer token). Seed the cache synchronously so the confirmation screen
      // finds it immediately, then refetch to reconcile with the authoritative
      // record (dedup by folio so the optimistic entry can't linger as a dupe).
      queryClient.setQueryData<OrderHistoryItem[]>(getListMyOrdersQueryKey(), (prev) => {
        const rest = (prev ?? []).filter((x) => x.folio !== o.folio);
        return [orderToHistory(o), ...rest];
      });
      queryClient.invalidateQueries({ queryKey: getListMyOrdersQueryKey() });
      return;
    }
    setLocalOrders((prev) => {
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
    setLocalFavorites([]);
    setRecent([]);
    setLocalOrders([]);
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
