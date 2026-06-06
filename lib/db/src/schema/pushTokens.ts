import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { usersTable } from "./users";

// Expo push tokens registered by the mobile app. The token (ExponentPushToken)
// is the natural primary key: one row per device, re-registered (upserted) on
// every launch so it stays fresh and re-linked to the signed-in account. Push
// is OPTIONAL and works for guests too — `userId` is null until the device's
// owner signs in.
export const pushTokensTable = pgTable(
  "push_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    platform: text("platform"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("push_tokens_user_id_idx").on(t.userId)],
);

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;
