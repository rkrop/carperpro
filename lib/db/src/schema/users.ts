import {
  pgTable,
  serial,
  text,
  jsonb,
  boolean,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import type { ShippingAddress } from "./outboundOrders";

// A central account, provisioned just-in-time the first time an authenticated
// user calls the API. `id` is the identity source: a Clerk user id for
// email/Google logins, or `phone_<uuid>` for SMS-OTP logins. The profile fields
// are a convenience mirror (kept fresh from Clerk claims, or set at phone signup).
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id, or "phone_<uuid>" for SMS logins
  email: text("email"),
  name: text("name"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Opaque server-issued sessions for phone (SMS-OTP) users. Clerk users keep
// using Clerk JWTs; phone users get a random token (we store only its sha256
// hash) sent as `Authorization: Bearer <token>` and validated here. The token
// is prefixed `cps_` so the Clerk middleware ignores it (it isn't a JWT) and
// our phone-auth middleware picks it up instead.
export const phoneSessionsTable = pgTable(
  "phone_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("phone_sessions_user_id_idx").on(t.userId)],
);

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
export type PhoneSession = typeof phoneSessionsTable.$inferSelect;
