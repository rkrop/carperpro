import { logger } from "../logger";
import { getSyncIntervalMs, isAdmintotalConfigured, missingConfigMessage } from "./config";
import { runInboundSync } from "./sync";
import { processOutboundQueue } from "./outbound";

let started = false;
let timer: NodeJS.Timeout | null = null;

async function tick(): Promise<void> {
  try {
    await runInboundSync();
  } catch (err) {
    logger.error({ err }, "Admintotal: error inesperado en sync programado");
  }
  try {
    await processOutboundQueue();
  } catch (err) {
    logger.error({ err }, "Admintotal: error inesperado al procesar cola");
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
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}
