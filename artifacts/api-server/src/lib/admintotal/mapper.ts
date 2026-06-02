import type {
  InsertProduct,
  InsertCategory,
  InsertSucursal,
  ProductSpec,
} from "@workspace/db";

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
function parseInventory(
  raw: Raw,
): { inventory: { sucursalId: string; quantity: number }[]; flat?: number } {
  const arr = pick(raw, [
    "info_almacenes",
    "existencias",
    "inventarios",
    "almacenes",
    "stock_almacenes",
  ]);
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
      // Skip damaged-goods warehouses (e.g. "MAL ESTADO") — not sellable.
      if (almacenNombre && /mal\s*estado/i.test(almacenNombre)) continue;
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
  return { inventory, flat: Array.isArray(arr) ? undefined : flat };
}

export function mapProduct(raw: Raw): MappedProduct | null {
  const id = asId(pick(raw, ["id", "pk"]));
  const name = asString(
    pick(raw, ["nombre", "descripcion", "name", "producto"]),
  );
  if (!id || !name) return null;

  const sku =
    asString(pick(raw, ["clave", "codigo", "sku", "codigo_barras"])) ?? "";
  const brand =
    asString(pick(raw, ["marca", "brand", "fabricante"])) ?? "SIN MARCA";
  const categoryId = lineaId(raw) ?? null;
  const price = asNumber(pick(raw, ["precio", "precio_publico", "precio1"])) ?? 0;
  const originalPrice =
    asNumber(pick(raw, ["precio_lista", "precio_anterior", "precio_regular"])) ??
    null;
  const image =
    asString(pick(raw, ["imagen", "foto", "image", "imagen_url"])) ?? null;

  const { inventory, flat } = parseInventory(raw);

  const product: InsertProduct = {
    id,
    sku,
    name,
    brand,
    categoryId,
    price,
    originalPrice:
      originalPrice !== null && originalPrice > price ? originalPrice : null,
    image,
    specs: buildSpecs(raw),
    compatible: false,
    vehicles: [],
    oem: null,
    equivalents: null,
  };

  return { product, inventory, fallbackStock: flat };
}

export type { MappedProduct };
