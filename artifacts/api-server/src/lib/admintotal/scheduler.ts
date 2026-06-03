import { logger } from "../logger";
import {
  getSyncIntervalMs,
  getTargetedRefreshIntervalMs,
  isAdmintotalConfigured,
  missingConfigMessage,
} from "./config";
import { runInboundSync } from "./sync";
import { runTargetedStockRefresh } from "./targetedRefresh";
import { processOutboundQueue } from "./outbound";
import { reconcilePendingStripeOrders } from "../stripe/service";
import { backfillEmbeddings } from "../embedding-backfill";

let started = false;
let timer: NodeJS.Timeout | null = null;
let targetedTimer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    await runInboundSync();
  } catch (err) {
    logger.error({ err }, "Admintotal: error inesperado en sync programado");
  }
  // Re-embed anything the sync (or webhooks) created or content-changed since the
  // last pass: the reset trigger NULLs `embedding` on content change, and new
  // rows arrive NULL, so this keeps the semantic index current without a restart.
  // backfillEmbeddings() no-ops when no key is set or a run is already in flight.
  try {
    await backfillEmbeddings();
  } catch (err) {
    logger.error({ err }, "embeddings: error inesperado en catch-up programado");
  }
  try {
    await processOutboundQueue();
  } catch (err) {
    logger.error({ err }, "Admintotal: error inesperado al procesar cola");
  }
  try {
    await reconcilePendingStripeOrders();
  } catch (err) {
    logger.error({ err }, "Stripe: error inesperado al reconciliar pedidos");
  }
}

// Independent, higher-frequency tick: keep the most important quantities fresh
// between full passes. It yields to the full sync internally (skips while a bulk
// pull is running) so the two never fight the same ERP rate-limit budget.
async function targetedTick(): Promise<void> {
  try {
    await runTargetedStockRefresh();
  } catch (err) {
    logger.error({ err }, "Admintotal: error inesperado en refresh dirigido");
  }
}

// Kick off a boot sync and schedule recurring syncs (~15 min). No manual button.
export function startScheduler(): void {
  if (started) return;
  started = true;

  if (!isAdmintotalConfigured()) {
    // Fail loudly in logs, but keep the server up so the missing-creds error is
    // visible via /api/sync-status instead of crashing the process.
    logger.error(missingConfigMessage());
  }

  const intervalMs = getSyncIntervalMs();
  logger.info({ intervalMs }, "Admintotal: programador de sincronización iniciado");

  // Boot sync (don't block server startup).
  void tick();

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive solely for the timer.
  timer.unref?.();

  // Separate, higher-frequency targeted stock refresh (~3 min). No boot run:
  // the first targeted tick fires after one interval, by which point the boot
  // full sync is underway and the targeted pass simply yields to it.
  const targetedIntervalMs = getTargetedRefreshIntervalMs();
  logger.info(
    { targetedIntervalMs },
    "Admintotal: refresh dirigido de stock programado",
  );
  targetedTimer = setInterval(() => {
    void targetedTick();
  }, targetedIntervalMs);
  targetedTimer.unref?.();
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (targetedTimer) {
    clearInterval(targetedTimer);
    targetedTimer = null;
  }
  started = false;
}
