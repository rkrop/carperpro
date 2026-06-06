import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Fase A — structured, SEARCHABLE attributes mined from our own catalog text.
//
// Our ERP leaves marca/OEM/aplicaciones trapped as unstructured text inside the
// product name/description. These tables hold the STRUCTURED, INDEXED form so a
// shopper can find a part by an OEM code ("23100-4JA0B", with or without
// separators) or by vehicle + year ("NP300 2019"). Enrichment is ADDITIVE: it
// only fills empty fields and never touches price or stock.
//
// `product_id` mirrors the repo convention for catalog child tables
// (product_stock_inicial, back_in_stock_subs): a plain `text` id indexed for
// lookups, WITHOUT a hard FK constraint, so an idempotent ERP re-import can
// never fail or cascade against these rows.

// One row per OEM / cross-reference code attached to a product. `code_norm` is
// the search key: uppercased with every non-alphanumeric stripped, so a user
// query is matched the same way regardless of dashes/spaces.
export const productOemCodesTable = pgTable(
  "product_oem_codes",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").notNull(),
    // Manufacturer of the code, when known (e.g. "NISSAN", "BOSCH"). Nullable.
    brand: text("brand"),
    // The code exactly as it appears in the source text (e.g. "23100-4JA0B").
    codeRaw: text("code_raw").notNull(),
    // Normalized for search: upper-case, only [A-Z0-9] (e.g. "231004JA0B").
    codeNorm: text("code_norm").notNull(),
    // Where this code came from (e.g. "name", "ai", "apymsa").
    source: text("source"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("product_oem_codes_code_norm_idx").on(t.codeNorm),
    index("product_oem_codes_product_id_idx").on(t.productId),
    // One code per product: makes enrichment writes idempotent and safe against
    // concurrent re-runs (paired with ON CONFLICT DO NOTHING on insert).
    uniqueIndex("product_oem_codes_dedupe_idx").on(t.productId, t.codeNorm),
  ],
);

export const insertProductOemCodeSchema = createInsertSchema(
  productOemCodesTable,
).omit({ id: true, createdAt: true });
export type InsertProductOemCode = z.infer<typeof insertProductOemCodeSchema>;
export type ProductOemCode = typeof productOemCodesTable.$inferSelect;

// One row per vehicle application a product fits. `year_from`/`year_to` bound an
// inclusive range so a "model + year" query filters with year BETWEEN them.
export const productApplicationsTable = pgTable(
  "product_applications",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").notNull(),
    // Vehicle make/model (e.g. make "NISSAN", model "NP300"). Stored upper-case.
    make: text("make").notNull(),
    model: text("model").notNull(),
    // Inclusive year range; NULL when the source text gives no years.
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    // Engine/motor when present in the source text (e.g. "2.5L"). Nullable.
    motor: text("motor"),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("product_applications_make_model_idx").on(t.make, t.model),
    index("product_applications_product_id_idx").on(t.productId),
    // One application per product, treating NULL year/motor as a value (coalesce)
    // so the dedupe key is stable. Drizzle 0.45 has no nullsNotDistinct(), hence
    // the expression index. Paired with ON CONFLICT DO NOTHING on insert.
    //
    // Every part is written as a `sql` expression on purpose: when an index mixes
    // plain column refs with sql expressions, drizzle-kit push misaligns the
    // per-column operator classes and emits `product_id int4_ops` (text column,
    // int4 opclass) → "operator class int4_ops does not accept data type text".
    // Making all parts expressions stops drizzle from attaching typed opclasses,
    // so Postgres picks the correct default for each column.
    uniqueIndex("product_applications_dedupe_idx").on(
      sql`${t.productId}`,
      sql`${t.make}`,
      sql`${t.model}`,
      sql`coalesce(${t.yearFrom}, -1)`,
      sql`coalesce(${t.yearTo}, -1)`,
      sql`coalesce(${t.motor}, '')`,
    ),
  ],
);

export const insertProductApplicationSchema = createInsertSchema(
  productApplicationsTable,
).omit({ id: true, createdAt: true });
export type InsertProductApplication = z.infer<
  typeof insertProductApplicationSchema
>;
export type ProductApplication = typeof productApplicationsTable.$inferSelect;

// Review queue for proposed enrichment. The dry-run runner writes ONE row per
// proposed field here (never to products / the final tables), so a human can
// inspect quality before anything is committed. `proposed_value` is jsonb so it
// holds any shape (a string for marca, an array for oem/aplicaciones, etc.).
export const enrichmentStagingTable = pgTable(
  "enrichment_staging",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").notNull(),
    // Which target field this proposal is for (e.g. "marca", "oem", "aplicaciones").
    field: text("field").notNull(),
    proposedValue: jsonb("proposed_value"),
    confidence: numeric("confidence"),
    source: text("source"),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("enrichment_staging_product_id_idx").on(t.productId)],
);

export const insertEnrichmentStagingSchema = createInsertSchema(
  enrichmentStagingTable,
).omit({ id: true, createdAt: true, reviewedBy: true, reviewedAt: true });
export type InsertEnrichmentStaging = z.infer<
  typeof insertEnrichmentStagingSchema
>;
export type EnrichmentStaging = typeof enrichmentStagingTable.$inferSelect;
