// Lógica de allowlist de CORS, extraída de app.ts para poder probarse de forma
// aislada (sin levantar el servidor ni la base de datos).
//
// Una petición se considera "first-party" cuando su Origin pertenece a uno de
// nuestros dominios conocidos (deploy de Replit, dominio de desarrollo, dominio
// de Expo o el sitio público canónico). En desarrollo también se permite
// localhost para poder probar desde la máquina local.

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
  for (const domain of process.env.REPLIT_DOMAINS?.split(",") ?? []) {
    addHost(hosts, domain);
  }
  addHost(hosts, process.env.REPLIT_DEV_DOMAIN);
  addHost(hosts, process.env.EXPO_PUBLIC_DOMAIN);
  // Dominio público canónico (p. ej. autopartescarper.com). En producción con
  // dominio propio, REPLIT_DOMAINS puede no incluirlo, así que lo agregamos
  // explícitamente para que la tienda/app puedan llamar al API.
  addHost(hosts, process.env.PUBLIC_SITE_URL);
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
