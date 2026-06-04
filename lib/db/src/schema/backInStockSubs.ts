import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// "Avísame cuando vuelva a haber": a shopper subscribes (by Expo push token) to
// an out-of-stock product. When the product's stock transitions from 0/unknown
// to a positive count (webhook or ERP sync), we push every active subscriber
// and stamp `notifiedAt` so each subscription fires at most once. Guests are
// supported — `userId` is null when the device owner isn't signed in.
export const backInStockSubsTable = pgTable(
  "back_in_stock_subs",
  {
    id: serial("id").primaryKey(),
    productId: text("product_id").notNull(),
    token: text("token").notNull(),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Null while pending; set when the back-in-stock push was sent so the same
    // device is never notified twice for the same restock.
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    // One active subscription per (product, device). Re-subscribing upserts.
    uniqueIndex("back_in_stock_subs_product_token_idx").on(t.productId, t.token),
    index("back_in_stock_subs_product_id_idx").on(t.productId),
  ],
);

export const insertBackInStockSubSchema = createInsertSchema(
  backInStockSubsTable,
).omit({ id: true, createdAt: true, notifiedAt: true });
export type InsertBackInStockSub = z.infer<typeof insertBackInStockSubSchema>;
export type BackInStockSub = typeof backInStockSubsTable.$inferSelect;
