import {
  pgTable,
  text,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface ProductSpec {
  label: string;
  value: string;
}

// Products mirror Admintotal "productos". `id` is the Admintotal producto id
// (stringified) so upserts are idempotent. Catalog is a read-only mirror.
export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().default(""),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("SIN MARCA"),
  categoryId: text("category_id"),
  price: doublePrecision("price").notNull().default(0),
  originalPrice: doublePrecision("original_price"),
  image: text("image"),
  specs: jsonb("specs").$type<ProductSpec[]>().notNull().default([]),
  // Vehicle-compatibility data is not provided by Admintotal; kept optional.
  compatible: boolean("compatible").notNull().default(false),
  vehicles: text("vehicles").array().notNull().default([]),
  oem: text("oem").array(),
  equivalents: text("equivalents").array(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
