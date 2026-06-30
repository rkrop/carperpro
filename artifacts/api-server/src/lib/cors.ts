// Lógica de allowlist de CORS, extraída de app.ts para poder probarse de forma
// aislada (sin levantar el servidor ni la base de datos).
//
// Una petición se considera "first-party" cuando su Origin pertenece a uno de
// nuestros dominios configurados. En desarrollo también se permite localhost
// para poder probar desde la máquina local.

const FIRST_PARTY_ENV_KEYS = [
  "PUBLIC_SITE_URL",
  "PUBLIC_API_URL",
  "APP_PUBLIC_URL",
  "EXPO_PUBLIC_API_URL",
] as const;

export function addHost(hosts: Set<string>, value: string | undefined): void {
  const raw = value?.trim();
  if (!raw) return;
  try {
    const parsed =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw).hostname
        : raw.split(":")[0];
    if (parsed) hosts.add(parsed);
  } catch {
    const parsed = raw.split(":")[0];
    if (parsed) hosts.add(parsed);
  }
}

export function firstPartyHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const key of FIRST_PARTY_ENV_KEYS) {
    addHost(hosts, process.env[key]);
  }
  for (const origin of process.env.ALLOWED_ORIGINS?.split(",") ?? []) {
    addHost(hosts, origin);
  }
  return hosts;
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  // Sin header Origin: peticiones same-origin del navegador, clientes
  // nativos/móviles, curl, webhooks de Stripe/Admintotal y llamadas
  // servidor-a-servidor.
  if (!origin) return true;
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const url = new URL(origin);
    if (
      !isProduction &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1")
    ) {
      return true;
    }
    return firstPartyHosts().has(url.hostname);
  } catch {
    return false;
  }
}
