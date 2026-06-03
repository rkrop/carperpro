import { useMemo } from "react";
import { ImageSourcePropType } from "react-native";

import {
  useCreateOrder,
  useGetDeals,
  getGetProductsAvailabilityQueryKey,
  getListSubcategoriesQueryKey,
  useGetProduct,
  useGetProductsAvailability,
  useGetSyncStatus,
  useListBrands,
  useListCategories,
  useListSubcategories,
  useListProducts,
  useListSucursales,
  type Category as ApiCategory,
  type Subcategory as ApiSubcategory,
  type ListProductsParams,
  type Product as ApiProduct,
  type Spec,
  type Sucursal,
} from "@workspace/api-client-react";

export type { Sucursal, Spec, ListProductsParams };

/** Catalog category (Admintotal "línea"). `icon` is resolved locally. */
export interface Category {
  id: string;
  name: string;
  icon: string; // MaterialCommunityIcons name
  count: number;
}

/** Catalog subcategory (Admintotal "sublínea") under a parent category. */
export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  count: number;
}

/** App-side product. Mirrors the API product but with an RN image source. */
export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number | null;
  /** Real on-hand count, or null when the ERP hasn't reported stock yet. */
  stock: number | null;
  categoryId: string | null;
  image: ImageSourcePropType | null;
  compatible: boolean;
  specs: Spec[];
  vehicles: string[];
  oem: string[];
  equivalents: string[];
  /** Rich description: vehicle applications, OEM codes, specs from ERP/Excel. */
  descripcion: string | null;
}

/**
 * Category icons live in the app (not the ERP). Match by keyword on the
 * Admintotal línea name; fall back to a neutral cog.
 */
const ICON_BY_KEYWORD: [string, string][] = [
  ["marcha", "engine-outline"],
  ["alternador", "battery-charging"],
  ["bater", "battery-charging"],
  ["inyec", "fuel"],
  ["gasolina", "fuel"],
  ["bomba", "fuel"],
  ["ilumin", "car-light-high"],
  ["faro", "car-light-high"],
  ["foco", "lightbulb-on-outline"],
  ["bulbo", "lightbulb-on-outline"],
  ["filtro", "air-filter"],
  ["encend", "flash-alert-outline"],
  ["buj", "flash-alert-outline"],
  ["enfriam", "fan"],
  ["ventilad", "fan"],
  ["rodamient", "cog-outline"],
  ["balero", "cog-outline"],
  ["interruptor", "toggle-switch-outline"],
  ["switch", "toggle-switch-outline"],
  ["sensor", "toggle-switch-outline"],
  ["lubric", "oil"],
  ["aceite", "oil"],
  ["electr", "flash-outline"],
  ["cable", "flash-outline"],
];

export function iconForCategory(name: string): string {
  const n = name.toLowerCase();
  for (const [kw, icon] of ICON_BY_KEYWORD) {
    if (n.includes(kw)) return icon;
  }
  return "cog-outline";
}

/** Map an API product into the app's shape (image string → RN source). */
export function mapProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    price: p.price,
    originalPrice: p.originalPrice ?? null,
    stock: p.stock,
    categoryId: p.categoryId ?? null,
    image: p.image ? { uri: p.image } : null,
    compatible: p.compatible,
    specs: p.specs ?? [],
    vehicles: p.vehicles ?? [],
    oem: p.oem ?? [],
    equivalents: p.equivalents ?? [],
    descripcion: p.descripcion ?? null,
  };
}

function mapCategory(c: ApiCategory): Category {
  return { id: c.id, name: c.name, icon: iconForCategory(c.name), count: c.count };
}

function mapSubcategory(s: ApiSubcategory): Subcategory {
  return { id: s.id, categoryId: s.categoryId, name: s.name, count: s.count };
}

// ---------------------------------------------------------------------------
// Data hooks (React Query wrappers around the generated client)
// ---------------------------------------------------------------------------

export function useCategories() {
  const query = useListCategories();
  const data = useMemo(() => query.data?.map(mapCategory), [query.data]);
  return { ...query, data };
}

/**
 * Subcategories for a given category (Admintotal sublíneas with sellable
 * products). Disabled until a categoryId is provided so the categorías screen
 * doesn't fetch the full list before a category is picked.
 */
export function useSubcategories(categoryId: string | undefined) {
  const query = useListSubcategories(
    categoryId ? { categoryId } : undefined,
    {
      query: {
        queryKey: getListSubcategoriesQueryKey(categoryId ? { categoryId } : undefined),
        enabled: !!categoryId,
      },
    },
  );
  const data = useMemo(() => query.data?.map(mapSubcategory), [query.data]);
  return { ...query, data };
}

export function useBrands() {
  return useListBrands();
}

export function useSucursales() {
  return useListSucursales();
}

export function useProducts(params?: ListProductsParams) {
  const query = useListProducts(params);
  const data = useMemo(
    () => (query.data ? { items: query.data.items.map(mapProduct), total: query.data.total } : undefined),
    [query.data],
  );
  return { ...query, data };
}

export function useProduct(id: string | undefined, sucursalId?: string) {
  const query = useGetProduct(id ?? "", sucursalId ? { sucursalId } : undefined);
  const data = useMemo(() => (query.data ? mapProduct(query.data) : undefined), [query.data]);
  return { ...query, data };
}

/** Availability state for a single product id, as reported live by the API. */
export type AvailabilityState = "in_stock" | "out_of_stock" | "unknown";

export interface ProductAvailability {
  id: string;
  /** Current on-hand count, or null when availability is unknown. */
  stock: number | null;
  stockState: AvailabilityState;
}

/**
 * Refresh current stock for a fixed set of product ids (used by the cart to
 * detect when availability dropped after items were saved). The id list should
 * be stable — pass a snapshot, not a live-changing array — so the query key and
 * one-shot apply behave predictably. Disabled when there are no ids.
 */
export function useProductsAvailability(ids: string[]) {
  const idsParam = ids.join(",");
  const query = useGetProductsAvailability(
    { ids: idsParam },
    {
      query: {
        queryKey: getGetProductsAvailabilityQueryKey({ ids: idsParam }),
        enabled: ids.length > 0,
        staleTime: 0,
        gcTime: 0,
      },
    },
  );
  const data = useMemo<ProductAvailability[] | undefined>(
    () => query.data?.items.map((i) => ({ id: i.id, stock: i.stock, stockState: i.stockState })),
    [query.data],
  );
  return { ...query, data };
}

export function useDeals(sucursalId?: string) {
  const query = useGetDeals(sucursalId ? { sucursalId } : undefined);
  const data = useMemo(
    () =>
      query.data
        ? {
            dealOfDay: query.data.dealOfDay ? mapProduct(query.data.dealOfDay) : null,
            ofertas: query.data.ofertas.map(mapProduct),
          }
        : undefined,
    [query.data],
  );
  return { ...query, data };
}

export function useSyncStatus() {
  return useGetSyncStatus();
}

export { useCreateOrder };

/** Resolve a local category icon from a category id, using the cached list. */
export function useCategoryIcon(categoryId: string | null | undefined): string {
  const { data } = useCategories();
  if (!categoryId || !data) return "cog-outline";
  return data.find((c) => c.id === categoryId)?.icon ?? "cog-outline";
}

// ---------------------------------------------------------------------------
// Local-only data (kept in the app, never synced from the ERP)
// ---------------------------------------------------------------------------

export const RECENT_SEARCHES = [
  "marcha tsuru",
  "alternador 70a",
  "bujia denso",
  "filtro afinacion sentra",
  "bomba gasolina sonic",
];

export const VEHICLE_DATA = {
  marcas: ["NISSAN", "CHEVROLET", "VOLKSWAGEN", "FORD", "TOYOTA", "HONDA"],
  modelos: {
    NISSAN: ["TSURU", "SENTRA", "VERSA", "MARCH", "NP300", "TIIDA"],
    CHEVROLET: ["AVEO", "SONIC", "SPARK", "BEAT", "CHEYENNE"],
    VOLKSWAGEN: ["JETTA", "GOLF", "POINTER", "VENTO"],
    FORD: ["FIESTA", "FOCUS", "RANGER", "IKON"],
    TOYOTA: ["COROLLA", "YARIS", "HILUX"],
    HONDA: ["CIVIC", "CITY", "FIT"],
  } as Record<string, string[]>,
  motores: ["1.6L", "1.8L", "2.0L", "2.4L", "Diesel"],
};
