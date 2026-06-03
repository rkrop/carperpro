import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Subcategories mirror Admintotal "sublineas". Keyed by the Admintotal sublinea
// id, with `categoryId` pointing at the parent linea (categories.id). The ERP's
// "self/default" sublinea (whose id equals its linea) and unnamed sublineas are
// dropped at sync time, so every row here is a real, named second-level grouping.
export const subcategoriesTable = pgTable("subcategories", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSubcategorySchema = createInsertSchema(subcategoriesTable).omit({
  updatedAt: true,
});
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Subcategory = typeof subcategoriesTable.$inferSelect;
