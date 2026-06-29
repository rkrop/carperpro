import { logger } from "../logger";
import {
  getSyncIntervalMs,
  getTargetedRefreshIntervalMs,
  isAdmintotalConfigured,
  isAutoSyncEnabled,
  missingConfigMessage,
} from "./config";
import { runInboundSync } from "./sync";
import { runTargetedStockRefresh } from "./targetedRefresh";
import { processOutboundQueue } from "./outbound";
import { reconcilePendingStripeOrders } from "../stripe/service";
import { backfillEmbeddings } from "../embedding-backfill";
import { backfillDescriptions } from "../description-backfill";
import { withAdvisoryLock, JOB_LOCK } from "../advisory-lock";
import { syncDeltaToShopify } from "../shopify/catalog-sync";
import { ingestShopifyOrders } from "../shopify/order-ingestion";

let started = false;
let timer: NodeJS.Timeout | null = null;
let targetedTimer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  // The automatic API-driven inventory pull is disabled by default: the catalog
  // is built from a master export and kept fresh only by inbound webhooks. The
  // rest of the tick (outbound order queue, Stripe reconcile, enrichment) still
  // runs. Re-enable with ADMINTOTAL_AUTO_SYNC=1.
  if (isAutoSyncEnabled()) {
    try {
      const ran = await withAdvisoryLock(JOB_LOCK.inboundSync, async () => {
        await runInboundSync();
      });
      if (!ran) {
        logger.info(
          "Admintotal: otra instancia ejecuta el sync programado, se omite en esta",
        );
      }
    } catch (err) {
      logger.error({ err }, "Admintotal: error inesperado en sync programado");
    }
  }
  // Re-embed anything the sync (or webhooks) created or content-changed since the
  // last pass: the reset trigger NULLs `embedding` on content change, and new
  // rows arrive NULL, so this keeps the semantic index current without a restart.
  // backfillEmbeddings() no-ops when no key is set or a run is already in flight.
  try {
    await backfillEmbeddings();
  } catch (err) {
    logger.error(
      { err },
      "embeddings: error inesperado en catch-up programado",
    );
  }
  // Generate AI descriptions for anything new/content-changed since the last pass
  // (the reset trigger NULLs descripcion_generada on content change; new rows
  // arrive NULL). No-ops when unconfigured or already running.
  try {
    await backfillDescriptions();
  } catch (err) {
    logger.error(
      { err },
      "descripciones: error inesperado en generación programada",
    );
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
  // Push products whose price/stock changed in the last 30 minutes to Shopify.
  // This keeps the Shopify storefront current without a full re-sync.
  // Advisory lock: only one instance runs this across Autoscale replicas.
  try {
    const ran = await withAdvisoryLock(JOB_LOCK.shopifyDeltaSync, async () => {
      await syncDeltaToShopify(30 * 60 * 1_000);
    });
    if (!ran) {
      logger.debug(
        "Shopify delta sync: otra instancia ejecutando, se omite en esta",
      );
    }
  } catch (err) {
    logger.error({ err }, "Shopify: error inesperado en delta sync programado");
  }
  // Ingest paid Shopify orders into the Admintotal outbound queue.
  // No-ops gracefully when read_orders scope is not available (v1 connector).
  try {
    const ran = await withAdvisoryLock(JOB_LOCK.shopifyOrderIngestion, async () => {
      await ingestShopifyOrders();
    });
    if (!ran) {
      logger.debug(
        "Shopify order ingestion: otra instancia ejecutando, se omite en esta",
      );
    }
  } catch (err) {
    logger.error({ err }, "Shopify: error inesperado en ingesta de órdenes");
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

  const autoSync = isAutoSyncEnabled();
  const intervalMs = getSyncIntervalMs();
  logger.info(
    { intervalMs, autoSync },
    autoSync
      ? "Admintotal: programador de sincronización iniciado"
      : "Admintotal: auto-sync DESACTIVADO (catálogo por carga maestra + webhooks); el programador solo procesa cola saliente y conciliación Stripe",
  );

  // Boot tick (don't block server startup). The inbound pull inside tick() is
  // gated by isAutoSyncEnabled(); the rest (outbound queue, Stripe) always runs.
  void tick();

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // Don't keep the event loop alive solely for the timer.
  timer.unref?.();

  // Separate, higher-frequency targeted stock refresh (~3 min). Only scheduled
  // when the automatic API pull is enabled — with auto-sync off the catalog's
  // stock is maintained exclusively by inbound webhooks.
  if (autoSync) {
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
