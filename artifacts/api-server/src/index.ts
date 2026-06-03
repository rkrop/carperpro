import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/admintotal/scheduler";
import { initStripe } from "./lib/stripe/init";
import { backfillSearchVectors } from "./lib/search-backfill";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Backfill any rows missing a search_vector (idempotent, self-healing). Runs
  // here so a publish indexes the live catalog for relevance-ranked search.
  void backfillSearchVectors();
  // Kick off the Admintotal inbound sync + outbound queue scheduler.
  startScheduler();
  // Best-effort Stripe setup (schema, managed webhook, backfill). Never fatal.
  void initStripe();
});
