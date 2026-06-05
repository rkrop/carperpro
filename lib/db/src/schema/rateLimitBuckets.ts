import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// Cross-process rate-limit counters. Each row is one (prefix + client key)
// bucket, holding a hit count and the timestamp at which the window resets.
// Rows are updated atomically via a single INSERT ... ON CONFLICT DO UPDATE so
// multiple autoscale instances share the same counters without races.
//
// Expired rows are cleaned up lazily (they get reset on next write) and
// periodically by a background sweep in the rate-limit middleware.
export const rateLimitBucketsTable = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_buckets_reset_at_idx").on(t.resetAt)],
);
