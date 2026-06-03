import {
  pgTable,
  serial,
  text,
  jsonb,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import type { ShippingAddress } from "./outboundOrders";

// A central account, provisioned just-in-time the first time a Clerk-authenticated
// user calls the API. `id` is the Clerk user id (the source of identity); the
// profile fields are a convenience mirror kept fresh from the Clerk token claims.
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email"),
  name: text("name"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Per-user favorites. We store a product snapshot (jsonb) so the favorites list
// renders without an extra batch catalog fetch and mirrors the device-local
// behavior the app already had. The snapshot shape matches the API `Product`;
// it is validated at the route boundary, so the column stays intentionally loose.
export const userFavoritesTable = pgTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    product: jsonb("product").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productId] })],
);

// Per-user saved delivery addresses. Reuses the order's structured
// ShippingAddress shape so a saved address can flow straight into checkout/ERP.
export const userAddressesTable = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  label: text("label"),
  address: jsonb("address").$type<ShippingAddress>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type UserFavorite = typeof userFavoritesTable.$inferSelect;
export type UserAddress = typeof userAddressesTable.$inferSelect;
