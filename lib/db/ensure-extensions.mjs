// Runs BEFORE `drizzle-kit push` (see package.json scripts). drizzle-kit cannot
// create Postgres extensions, but the `products.embedding` column is typed
// `vector(768)` (pgvector) and the full-text path uses `unaccent` — both must
// exist before push tries to create/alter the column, or push fails. This is
// idempotent and safe to run on every push in dev and at deploy time.
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set to ensure extensions.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  await pool.query("CREATE EXTENSION IF NOT EXISTS unaccent");
  console.log("extensions ensured: vector, unaccent");
} catch (err) {
  console.error("ensure-extensions failed:", err?.message ?? err);
  process.exit(1);
} finally {
  await pool.end();
}
