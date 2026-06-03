// Admintotal ERP credentials/config. Read from environment — never hardcoded.
// The sync fails loudly (clear error in logs + sync-status) when these are missing.

export interface AdmintotalConfig {
  clave: string;
  username: string;
  password: string;
  apiKey?: string;
  baseUrl: string;
}

export class AdmintotalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdmintotalConfigError";
  }
}

export function isAdmintotalConfigured(): boolean {
  const clave = process.env.ADMINTOTAL_CLAVE;
  const hasLogin =
    !!process.env.ADMINTOTAL_USERNAME && !!process.env.ADMINTOTAL_PASSWORD;
  const hasApiKey = !!process.env.ADMINTOTAL_API_KEY;
  return !!clave && (hasLogin || hasApiKey);
}

export function missingConfigMessage(): string {
  const missing: string[] = [];
  if (!process.env.ADMINTOTAL_CLAVE) missing.push("ADMINTOTAL_CLAVE");
  const hasApiKey = !!process.env.ADMINTOTAL_API_KEY;
  if (!hasApiKey) {
    if (!process.env.ADMINTOTAL_USERNAME) missing.push("ADMINTOTAL_USERNAME");
    if (!process.env.ADMINTOTAL_PASSWORD) missing.push("ADMINTOTAL_PASSWORD");
  }
  return `Faltan credenciales de Admintotal: ${missing.join(", ")}. Configúralas para habilitar la sincronización.`;
}

/**
 * Normalize ADMINTOTAL_CLAVE to the bare account subdomain.
 * Accepts any of: "carper", "carper.admintotal.com",
 * "https://carper.admintotal.com", "https://carper.admintotal.com/api/v2".
 */
export function normalizeClave(raw: string): string {
  let clave = raw.trim();
  clave = clave.replace(/^https?:\/\//i, ""); // strip protocol
  clave = clave.split("/")[0] ?? clave; // drop any path
  clave = clave.replace(/\.admintotal\.com.*$/i, ""); // drop the domain suffix
  clave = clave.replace(/^\.+|\.+$/g, ""); // trim stray dots
  return clave;
}

export function getAdmintotalConfig(): AdmintotalConfig {
  if (!isAdmintotalConfigured()) {
    throw new AdmintotalConfigError(missingConfigMessage());
  }
  const clave = normalizeClave(process.env.ADMINTOTAL_CLAVE!);
  if (!/^[a-z0-9-]+$/i.test(clave)) {
    throw new AdmintotalConfigError(
      `ADMINTOTAL_CLAVE inválida. Usa solo la clave de la cuenta (p. ej. "carper"), no la URL completa.`,
    );
  }
  return {
    clave,
    username: process.env.ADMINTOTAL_USERNAME ?? "",
    password: process.env.ADMINTOTAL_PASSWORD ?? "",
    apiKey: process.env.ADMINTOTAL_API_KEY,
    baseUrl: `https://${clave}.admintotal.com/api/v2`,
  };
}

// Interval for the automatic inbound sync (~15 minutes by default).
export function getSyncIntervalMs(): number {
  const raw = process.env.ADMINTOTAL_SYNC_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 60_000) return parsed;
  return 15 * 60 * 1000;
}

// Interval for the lightweight TARGETED stock refresh that keeps the most
// important (recently ordered / stalest-known) products fresher than the full
// resumable pass can. Defaults to ~3 minutes; clamped to a 30s floor so it can
// never hammer the ERP. Set ADMINTOTAL_TARGETED_REFRESH_INTERVAL_MS to tune.
export function getTargetedRefreshIntervalMs(): number {
  const raw = process.env.ADMINTOTAL_TARGETED_REFRESH_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 30_000) return parsed;
  return 3 * 60 * 1000;
}

// How many products the targeted refresh touches per tick via the per-product
// detail endpoint. Kept small (default 25) so it coexists with the full pass
// without fighting the same rate-limit budget. Clamped to 1..200.
export function getTargetedRefreshBatchSize(): number {
  const raw = process.env.ADMINTOTAL_TARGETED_REFRESH_BATCH;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 200) {
    return Math.floor(parsed);
  }
  return 25;
}

// Lookback window (days) for "recently ordered" products the targeted refresh
// prioritizes. Defaults to 30 days. Clamped to 1..365.
export function getTargetedRefreshOrderLookbackDays(): number {
  const raw = process.env.ADMINTOTAL_TARGETED_REFRESH_ORDER_DAYS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 365) {
    return Math.floor(parsed);
  }
  return 30;
}

// Global cap on how many Admintotal requests may be in flight at once across the
// WHOLE process (sync, live stock, pedidos all share it). Clamped to 1..100.
export function getAdmintotalMaxConcurrency(): number {
  const raw = process.env.ADMINTOTAL_MAX_CONCURRENCY;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 100) {
    return Math.floor(parsed);
  }
  return 5;
}

// Minimum spacing (ms) between Admintotal request *starts*, applied globally by
// the shared limiter. Default 0 (no extra spacing — concurrency is the only
// throttle). Clamped to >= 0.
export function getAdmintotalMinIntervalMs(): number {
  const raw = process.env.ADMINTOTAL_MIN_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 0) return Math.floor(parsed);
  return 0;
}

// TTL (ms) for the short in-memory live-stock cache in liveStock.ts, so repeated
// product views/checkouts of the same part don't fire a detail request each
// time. The post-payment re-check bypasses it (force). Default 30s. Clamped >= 0
// (0 disables the cache).
export function getAdmintotalStockTtlMs(): number {
  const raw = process.env.ADMINTOTAL_STOCK_TTL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isNaN(parsed) && parsed >= 0) return Math.floor(parsed);
  return 30_000;
}

// Shared secret used to authenticate inbound Admintotal webhook requests.
// Admintotal sends it in the "Api-key" header (or as the HTTP Basic password).
// Optional but strongly recommended — when unset the webhook accepts anonymous
// requests and logs a warning.
export function getWebhookToken(): string | undefined {
  const t = process.env.ADMINTOTAL_WEBHOOK_TOKEN;
  return t && t.trim() ? t.trim() : undefined;
}

// Sucursal (almacen) under which webhook stock is recorded. Admintotal's
// price/stock webhook sends a single aggregate `stock` per SKU (summed across
// the almacenes configured in the webhook), so we store it on one sucursal.
// The app sums stock across all sucursales, so a single row == the aggregate.
// Defaults to "9" (Matriz, the main store).
export function getWebhookSucursalId(): string {
  const raw = process.env.ADMINTOTAL_WEBHOOK_SUCURSAL_ID;
  return raw && raw.trim() ? raw.trim() : "9";
}
