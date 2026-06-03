import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  customType,
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

// Products mirror Admintotal "productos". `id` is the Admintotal producto id
// (stringified) so upserts are idempotent. Catalog is a read-only mirror.
export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().default(""),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("SIN MARCA"),
  categoryId: text("category_id"),
  // Admintotal "sublinea" — the second-level grouping under categoryId. NULL
  // when the ERP product has no real (named, non-self) sublinea. Set during
  // sync and only ever points at an existing subcategories row.
  subcategoryId: text("subcategory_id"),
  price: doublePrecision("price").notNull().default(0),
  originalPrice: doublePrecision("original_price"),
  // Rich product description: vehicle applications, OEM codes, specs, etc.
  // Used for full-text search (tsvector index maintained via DB trigger).
  descripcion: text("descripcion"),
  // Cost and supplier info (from Excel / Admintotal)
  costo: doublePrecision("costo"),
  proveedor: text("proveedor"),
  skuProveedor: text("sku_proveedor"),
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
  // Full-text search vector, populated by the `products_search_trigger` DB
  // trigger on every insert/update. The app never writes this directly (hence
  // omitted from the insert schema below); it exists here only so the schema
  // diff keeps it in sync across dev/prod instead of dropping it.
  searchVector: tsvector("search_vector"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  updatedAt: true,
  searchVector: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
