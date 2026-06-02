import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Sucursales mirror Admintotal "almacenes". Keyed by the Admintotal almacen id.
export const sucursalesTable = pgTable("sucursales", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  hours: text("hours").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSucursalSchema = createInsertSchema(sucursalesTable).omit({
  updatedAt: true,
});
export type InsertSucursal = z.infer<typeof insertSucursalSchema>;
export type Sucursal = typeof sucursalesTable.$inferSelect;
