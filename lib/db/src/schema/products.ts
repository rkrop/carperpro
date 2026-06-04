import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  customType,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface ProductSpec {
  label: string;
  value: string;
}

// Postgres `tsvector` has no first-class Drizzle type. We declare it as a
// custom type so it lives in the schema source of truth — otherwise
// `drizzle-kit push` / the publish-time schema diff treats the out-of-band
// column as "extra" and DROPS it, which leaves the search trigger assigning to
// a missing field and breaks every write to `products`.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

// Semantic-search embedding dimension. Must match the embedding model used by
// the API server (Google text-embedding-004 → 768 dims). Kept here so the
// pgvector column type and the server-side validation stay in lockstep.
export const EMBEDDING_DIM = 768;

// pgvector `vector(N)` likewise has no first-class Drizzle type. Declared as a
// custom type for the SAME reason as tsvector above: so it lives in the schema
// source of truth and `drizzle-kit push` never drops it. The `vector` extension
// must already exist when push runs — the `push` script in package.json creates
// it first (ensure-extensions.mjs).
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .filter((s) => s.length > 0)
      .map(Number);
  },
});

// Products mirror Admintotal "productos". `id` is the Admintotal producto id
// (stringified) so upserts are idempotent. Catalog is a read-only mirror.
export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  // Full ERP code, WITH supplier suffix if present (e.g. "U52351-UNIFLOW").
  sku: text("sku").notNull().default(""),
  // Normalized code WITHOUT suffix: part before the first "-", uppercased, spaces
  // stripped (e.g. "U52351"). This is the join key the price/stock webhook matches
  // on (it receives the bare "sku" and we normalize it the same way). Maintained
  // automatically by the `products_search_vector_update` BEFORE INSERT/UPDATE
  // trigger (never written by hand), so it's omitted from the insert schema below.
  // Indexed (see table-level index) for fast webhook lookups; NOT unique because
  // two suffixed products can legitimately share a base.
  skuBase: text("sku_base"),
  // Supplier suffix: everything after the first "-" (e.g. "UNIFLOW"), NULL when the
  // code has no suffix. Also trigger-maintained from `sku`, hence omitted from insert.
  proveedorSufijo: text("proveedor_sufijo"),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("SIN MARCA"),
  categoryId: text("category_id"),
  // Admintotal "sublinea" — the second-level grouping under categoryId. NULL
  // when the ERP product has no real (named, non-self) sublinea. Set during
  // sync and only ever points at an existing subcategories row.
  subcategoryId: text("subcategory_id"),
  // Raw sublínea NAME from the master Excel (e.g. "AISLANTES"). Kept verbatim for
  // display/search even before a matching `subcategories` row exists; subcategoryId
  // is the normalized FK, this is the human label.
  subLinea: text("sub_linea"),
  price: doublePrecision("price").notNull().default(0),
  // Where `price` came from: "Matriz"/"Bodega" (master Excel Fuente Precio),
  // "Estimado" (derived costo*1.30 by the never-price-0 rule), "Webhook" (live ERP
  // price/stock push) or "Manual". NULL when status = "sin_precio".
  priceSource: text("price_source"),
  originalPrice: doublePrecision("original_price"),
  // Rich product description: vehicle applications, OEM codes, specs, etc.
  // Used for full-text search (tsvector index maintained via DB trigger).
  descripcion: text("descripcion"),
  // Curated e-commerce description from the master Excel ("Descripción e-commerce").
  // Customer-facing marketing copy; indexed for search (weight C).
  descripcionEcommerce: text("descripcion_ecommerce"),
  // Extra free-form notes from the master Excel ("Descripción Adicional"). Indexed
  // for search (weight C) so its keywords surface the product.
  descripcionAdicional: text("descripcion_adicional"),
  // AI-generated sales description (Task #49). Produced offline in batch by
  // description-backfill.ts from the product's REAL ERP data (name, brand,
  // category, specs, vehicles, OEM) — never invented specs/compatibility. Served
  // ONLY as a fallback when `descripcion` is empty, so it never overrides real
  // ERP copy. NULL until generated, and re-NULLed by the `products_embedding_reset`
  // trigger whenever source content changes so it is regenerated. Written via raw
  // SQL on the server (like `embedding`), never through Drizzle inserts — hence
  // omitted from the insert schema below. Deliberately kept OUT of the full-text
  // `search_vector` so AI prose never skews search relevance.
  descripcionGenerada: text("descripcion_generada"),
  // Cost and supplier info (from Excel / Admintotal)
  costo: doublePrecision("costo"),
  proveedor: text("proveedor"),
  skuProveedor: text("sku_proveedor"),
  // Supplier barcode ("Código Barras") and SAT product/service key
  // ("ClaveProdServ (SAT)") from the master Excel. Reference data for invoicing
  // and scanning; not used for catalog identity.
  codigoBarras: text("codigo_barras"),
  claveSat: text("clave_sat"),
  image: text("image"),
  // On-hand stock, mirrored from Admintotal onto the product row — the proven
  // one-number-per-product model. NULL means stock is UNKNOWN (the ERP hasn't
  // reported it yet): the product stays visible and orderable, but no count is
  // shown. A real number drives the displayed count; 0 means confirmed out of
  // stock (hidden from listings by the catalog query). Checkout still does a
  // live ERP stock check, so this mirror can never let a customer over-buy.
  erpStockQty: integer("erp_stock_qty"),
  // When erpStockQty was last set from Admintotal (sync or webhook).
  stockUpdatedAt: timestamp("stock_updated_at", { withTimezone: true }),
  specs: jsonb("specs").$type<ProductSpec[]>().notNull().default([]),
  // Vehicle-compatibility data is not provided by Admintotal; kept optional.
  compatible: boolean("compatible").notNull().default(false),
  vehicles: text("vehicles").array().notNull().default([]),
  oem: text("oem").array(),
  equivalents: text("equivalents").array(),
  // Catalog sellability flag set at write time by the never-price-0 rule:
  //   "activo"     — has a usable price (real, or estimated from costo*1.30).
  //   "sin_precio" — no price AND no costo: NOT sellable, hidden from the catalog
  //                  (instead of showing $0). The catalog query filters this out.
  status: text("status").notNull().default("activo"),
  // Full-text search vector, populated by the `products_search_trigger` DB
  // trigger on every insert/update. The app never writes this directly (hence
  // omitted from the insert schema below); it exists here only so the schema
  // diff keeps it in sync across dev/prod instead of dropping it.
  searchVector: tsvector("search_vector"),
  // Semantic-search embedding (Google text-embedding-004, 768 dims). NULL until
  // the API server's backfill embeds the row, and re-NULLed by the
  // `products_embedding_reset` trigger whenever searchable content changes so it
  // is automatically re-embedded. The app never writes this through Drizzle
  // (hence omitted from the insert schema below); it is populated/queried via
  // raw pgvector SQL on the server.
  embedding: vector("embedding"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  // Webhook + catalog lookups join on the normalized base code, so index it.
  index("products_sku_base_idx").on(t.skuBase),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({
  updatedAt: true,
  searchVector: true,
  embedding: true,
  descripcionGenerada: true,
  // Trigger-maintained from `sku`; never written by the app.
  skuBase: true,
  proveedorSufijo: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

// ── product_stock_inicial ───────────────────────────────────────────────────
// Per-warehouse stock breakdown captured ONLY at the FASE 1 master-Excel import:
// one row per (product, almacén) — Matriz = "001", Bodega = "005" — recording the
// initial `existencia` (on-hand) and `disponible` (sellable). This is an audit /
// reference snapshot of the import; it is NOT live stock and is NEVER touched by
// the FASE 2 webhooks (those send a single pre-summed total that updates
// products.erpStockQty instead). Do not read this for availability — use
// products.erpStockQty.
export const productStockInicialTable = pgTable(
  "product_stock_inicial",
  {
    productId: text("product_id").notNull(),
    almacenId: text("almacen_id").notNull(),
    existencia: integer("existencia").notNull().default(0),
    disponible: integer("disponible").notNull().default(0),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.almacenId] })],
);

export const insertProductStockInicialSchema = createInsertSchema(
  productStockInicialTable,
).omit({ importedAt: true });
export type InsertProductStockInicial = z.infer<
  typeof insertProductStockInicialSchema
>;
export type ProductStockInicial = typeof productStockInicialTable.$inferSelect;
