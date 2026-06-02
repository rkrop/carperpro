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

export function getAdmintotalConfig(): AdmintotalConfig {
  if (!isAdmintotalConfigured()) {
    throw new AdmintotalConfigError(missingConfigMessage());
  }
  const clave = process.env.ADMINTOTAL_CLAVE!;
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
