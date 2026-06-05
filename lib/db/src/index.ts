import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idle clients in the pool stay connected to a live Postgres backend. When the
// managed database terminates an idle connection (scale-down, maintenance,
// "terminating connection due to administrator command"), the pool emits an
// 'error' event. Without a listener, Node treats it as an unhandled 'error'
// and crashes the whole process, which previously caused production crash-loops.
// Logging it keeps the server alive; the pool transparently opens new clients.
pool.on("error", (err) => {
  console.error(
    "pg pool: idle client error (non-fatal, connection will be replaced)",
    err instanceof Error ? err.message : err,
  );
});

export const db = drizzle(pool, { schema });

export * from "./schema";
