import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-sucursal (almacen) stock for each product.
export const inventoryTable = pgTable(
  "inventory",
  {
    productId: text("product_id").notNull(),
    sucursalId: text("sucursal_id").notNull(),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.productId, t.sucursalId] })],
);

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({
  updatedAt: true,
});
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
