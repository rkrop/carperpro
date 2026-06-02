import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Distinct brand list, aggregated from Admintotal products during sync.
export const brandsTable = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
