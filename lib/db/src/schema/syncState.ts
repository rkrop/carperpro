import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SyncStatus = "idle" | "running" | "success" | "error";

// Singleton-ish status of the inbound Admintotal sync, keyed by a fixed key
// (e.g. "catalog"). Surfaces last run, success/failure and counts.
export const syncStateTable = pgTable("sync_state", {
  key: text("key").primaryKey(),
  status: text("status").$type<SyncStatus>().notNull().default("idle"),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  message: text("message"),
  productsSynced: integer("products_synced").notNull().default(0),
  categoriesSynced: integer("categories_synced").notNull().default(0),
  sucursalesSynced: integer("sucursales_synced").notNull().default(0),
  brandsSynced: integer("brands_synced").notNull().default(0),
  // Resumable-pull bookkeeping for the rate-limited Admintotal `productos` pull.
  // The full catalog (~32k rows) rarely fetches in one tick before a 429 stops
  // it, so we persist where to resume next run instead of restarting at page 0.
  // `cursorUrl` is the absolute `next` URL we should continue from; NULL means
  // "start a fresh full pass from the first page". A pass therefore spans
  // multiple ticks, so we also track when it began (`cycleStartedAt`) and how
  // many rows it has fetched so far (`cycleFetchedCount`) to safely prune
  // products that disappeared from the ERP only once a whole pass completes.
  cursorUrl: text("cursor_url"),
  cycleStartedAt: timestamp("cycle_started_at", { withTimezone: true }),
  cycleFetchedCount: integer("cycle_fetched_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSyncStateSchema = createInsertSchema(syncStateTable);
export type InsertSyncState = z.infer<typeof insertSyncStateSchema>;
export type SyncState = typeof syncStateTable.$inferSelect;
