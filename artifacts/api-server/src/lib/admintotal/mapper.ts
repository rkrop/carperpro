import type {
  InsertProduct,
  InsertCategory,
  InsertSubcategory,
  InsertSucursal,
  ProductSpec,
} from "@workspace/db";
import { getSellableWarehouseIds } from "./config";
import { resolvePrice } from "./sku";

// Resolved once: the warehouse ids whose `disponible` counts as sellable stock
// (Matriz + Bodega by default). Anything outside this set — other branches,
// IMSS, MAL ESTADO — is ignored so a product is "available" only when it has
// units in the stores we actually sell from.
let _sellableWarehouseIds: Set<string> | null = null;
function sellableWarehouseIds(): Set<string> {
  if (!_sellableWarehouseIds) _sellableWarehouseIds = getSellableWarehouseIds();
  return _sellableWarehouseIds;
}

// Admintotal's exact field names are not documented to us, so every mapper is
// DEFENSIVE: it tries a list of plausible keys for each field and falls back to
// a safe default. Assumptions are documented inline so they can be corrected
// once the real ERP payload is observed.

type Raw = Record<string, unknown>;

function pick(raw: Raw, keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") return raw[k];
  }
  return undefined;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function asId(v: unknown): string | undefined {
  const s = asString(v);
  return s ? s.trim() : undefined;
}

// linea -> category id (string). Handles either a nested object or a scalar id.
function lineaId(raw: Raw): string | undefined {
  const linea = pick(raw, ["linea", "linea_id", "lineaId", "id_linea"]);
  if (linea && typeof linea === "object") {
    return asId(pick(linea as Raw, ["id", "pk", "clave"]));
  }
  return asId(linea);
}

// sublinea -> subcategory id (string). Handles a nested object or a scalar id.
function sublineaId(raw: Raw): string | undefined {
  const sub = pick(raw, ["sublinea", "sub_linea", "sublinea_id", "id_sublinea"]);
  if (sub && typeof sub === "object") {
    return asId(pick(sub as Raw, ["id", "pk", "clave"]));
  }
  return asId(sub);
}

// Map an Admintotal "sublinea" row into a subcategory. Returns null for rows we
// don't surface: missing id/parent/name, or the ERP's "self/default" sublinea
// whose id equals its parent linea (these carry no meaningful grouping).
export function mapSubcategory(raw: Raw): InsertSubcategory | null {
  const id = asId(pick(raw, ["id", "pk", "clave", "codigo"]));
  const categoryId = lineaId(raw);
  const name = asString(pick(raw, ["nombre", "descripcion", "name"]));
  if (!id || !categoryId || !name) return null;
  if (id === categoryId) return null;
  return { id, categoryId, name, count: 0 };
}

export function mapCategory(raw: Raw): InsertCategory | null {
  const id = asId(pick(raw, ["id", "pk", "clave", "codigo"]));
  const name = asString(
    pick(raw, ["nombre", "descripcion", "name", "linea"]),
  );
  if (!id || !name) return null;
  return { id, name, icon: "cog-outline", count: 0 };
}

export function mapSucursal(raw: Raw): InsertSucursal | null {
  const id = asId(pick(raw, ["id", "pk", "clave", "codigo"]));
  const name = asString(
    pick(raw, ["nombre", "descripcion", "name", "almacen"]),
  );
  if (!id || !name) return null;
  return {
    id,
    name,
    address: asString(pick(raw, ["direccion", "domicilio", "address"])) ?? "",
    city: asString(pick(raw, ["ciudad", "municipio", "city"])) ?? "",
    hours: asString(pick(raw, ["horario", "horarios", "hours"])) ?? "",
  };
}

interface MappedProduct {
  product: InsertProduct;
  // Per-sucursal stock parsed from the product payload, when present.
  inventory: { sucursalId: string; quantity: number }[];
  // Flat existencia used when no per-sucursal breakdown is available.
  fallbackStock?: number;
  // Single on-hand number for the one-number-per-product model: the sum of the
  // sellable per-sucursal rows, or the flat existencia when there's no
  // breakdown. `undefined` means the payload carried NO stock info at all — the
  // caller must then leave the existing stored stock untouched (never zero it).
  stockQty?: number;
}

function buildSpecs(raw: Raw): ProductSpec[] {
  const specs: ProductSpec[] = [];
  const candidates: [string, string[]][] = [
    ["Modelo", ["modelo", "model"]],
    ["Unidad", ["unidad", "unidad_medida", "um"]],
    ["Peso", ["peso", "weight"]],
  ];
  for (const [label, keys] of candidates) {
    const v = asString(pick(raw, keys));
    if (v) specs.push({ label, value: v });
  }
  return specs;
}

// Parse per-sucursal existencias. Admintotal may expose this as an array of
// { almacen, existencia } objects under various keys.
//
// `hasInventoryArray` tells the caller whether the payload actually CARRIED the
// per-warehouse breakdown (the `info_almacenes` array key was present), even when
// that array is EMPTY. Admintotal returns this key on every `productos` row and
// leaves it `[]` when the product has no available units in any warehouse — i.e.
// an empty array is a definitive "0 available" reading from the ERP via the
// proper channel, NOT "stock unknown". The caller relies on this to persist a
// real 0 (so the product reads "Agotado") instead of leaving it NULL
// ("Consultar"). When the key is absent entirely we leave stock untouched.
function parseInventory(raw: Raw): {
  inventory: { sucursalId: string; quantity: number }[];
  flat?: number;
  hasInventoryArray: boolean;
} {
  const arr = pick(raw, [
    "info_almacenes",
    "existencias",
    "inventarios",
    "almacenes",
    "stock_almacenes",
  ]);
  const hasInventoryArray = Array.isArray(arr);
  const inventory: { sucursalId: string; quantity: number }[] = [];
  if (Array.isArray(arr)) {
    for (const entry of arr) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Raw;
      const almacen = pick(e, ["almacen", "almacen_id", "sucursal", "id_almacen"]);
      let sucursalId: string | undefined;
      let almacenNombre: string | undefined;
      if (almacen && typeof almacen === "object") {
        sucursalId = asId(pick(almacen as Raw, ["id", "pk", "clave"]));
        almacenNombre =
          asString(pick(almacen as Raw, ["nombre", "name"])) ?? undefined;
      } else {
        sucursalId = asId(almacen);
      }
      // Only count warehouses we actually sell from (Matriz + Bodega by
      // default). This excludes other branches (California/Costera/Navojoa/IMSS)
      // and damaged goods (MAL ESTADO), so a product reads as available only
      // when it has units in a sellable store. When the breakdown carries no
      // sellable entry the caller treats it as a confirmed 0 (hidden).
      if (!sucursalId || !sellableWarehouseIds().has(sucursalId)) continue;
      const qty = asNumber(
        pick(e, [
          "disponible",
          "existencia",
          "existencias",
          "cantidad",
          "quantity",
          "stock",
        ]),
      );
      if (sucursalId && qty !== undefined) {
        inventory.push({ sucursalId, quantity: Math.max(0, Math.round(qty)) });
      }
    }
  }
  const flat = asNumber(
    pick(raw, ["existencia", "existencias", "stock", "cantidad", "inventario"]),
  );
  return {
    inventory,
    flat: hasInventoryArray ? undefined : flat,
    hasInventoryArray,
  };
}

export function mapProduct(raw: Raw): MappedProduct | null {
  const name = asString(
    pick(raw, ["nombre", "descripcion", "name", "producto"]),
  );
  // Identity is the ERP CODE (sku), not Admintotal's numeric producto id, so the
  // FASE 1 master import and the FASE 2 live webhooks converge on the SAME row.
  // Fall back to the numeric id only when no code is present.
  const sku =
    asString(pick(raw, ["clave", "codigo", "sku", "codigo_barras"])) ?? "";
  const id = sku || asId(pick(raw, ["id", "pk"]));
  if (!id || !name) return null;

  const brand =
    asString(pick(raw, ["marca", "brand", "fabricante"])) ?? "SIN MARCA";
  const categoryId = lineaId(raw) ?? null;
  // Second-level grouping. Null when the ERP product has no sublinea or its
  // sublinea is the "self/default" one (same id as its linea). The sync further
  // narrows this to ids that actually exist in the subcategories table.
  const subRaw = sublineaId(raw) ?? null;
  const subcategoryId = subRaw && subRaw !== categoryId ? subRaw : null;
  const subLinea =
    asString(pick(raw, ["sublinea_nombre", "sub_linea", "sublinea_descripcion"])) ??
    null;
  // Never-price-0 rule: a usable sale price wins; otherwise estimate from costo;
  // otherwise the product is "sin_precio" (hidden by the catalog). A live ERP push
  // is recorded as source "Webhook".
  const precio = asNumber(pick(raw, ["precio", "precio_publico", "precio1"]));
  const costo =
    asNumber(pick(raw, ["costo", "precio_costo", "costo_promedio"])) ?? null;
  const { price, priceSource, status } = resolvePrice(precio, costo, "Webhook");
  const originalPrice =
    asNumber(pick(raw, ["precio_lista", "precio_anterior", "precio_regular"])) ??
    null;
  const image =
    asString(pick(raw, ["imagen", "foto", "image", "imagen_url"])) ?? null;

  const { inventory, flat, hasInventoryArray } = parseInventory(raw);

  // Collapse to a single on-hand number. Prefer the per-sucursal breakdown (sum
  // of sellable warehouses only — Matriz + Bodega; parseInventory drops every
  // other warehouse). When the breakdown key was present but yielded no sellable
  // units (empty array, or stock only in non-sellable warehouses) treat it as a
  // definitive 0 — the ERP reported the breakdown and nothing is available in a
  // store we sell from. Fall back to a flat existencia when
  // there's no breakdown at all. `undefined` ONLY when the payload carried NO
  // stock signal whatsoever, so the caller leaves the stored value untouched.
  const stockQty =
    inventory.length > 0
      ? inventory.reduce((sum, r) => sum + Math.max(0, r.quantity), 0)
      : hasInventoryArray
        ? 0
        : flat !== undefined
          ? Math.max(0, Math.round(flat))
          : undefined;

  const product: InsertProduct = {
    id,
    sku,
    name,
    brand,
    categoryId,
    subcategoryId,
    subLinea,
    price,
    priceSource,
    status,
    costo,
    originalPrice:
      originalPrice !== null && originalPrice > price ? originalPrice : null,
    descripcionEcommerce:
      asString(pick(raw, ["descripcion_ecommerce", "descripcion_web"])) ?? null,
    descripcionAdicional:
      asString(pick(raw, ["descripcion_adicional", "notas", "observaciones"])) ??
      null,
    codigoBarras:
      asString(pick(raw, ["codigo_barras", "codigobarras", "barcode", "ean"])) ??
      null,
    claveSat:
      asString(
        pick(raw, ["clave_sat", "claveprodserv", "clave_prod_serv", "clave_sat_producto"]),
      ) ?? null,
    proveedor: asString(pick(raw, ["proveedor", "proveedor_nombre"])) ?? null,
    skuProveedor:
      asString(
        pick(raw, ["codigo_proveedor", "sku_proveedor", "clave_proveedor"]),
      ) ?? null,
    image,
    specs: buildSpecs(raw),
    compatible: false,
    vehicles: [],
    oem: null,
    equivalents: null,
  };

  return { product, inventory, fallbackStock: flat, stockQty };
}

export type { MappedProduct };
