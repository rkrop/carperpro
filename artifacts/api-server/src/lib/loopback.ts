// Detección de hosts/conexiones loopback (localhost), extraída de routes/admin.ts
// para poder probarse de forma aislada. Se usa para permitir el bypass de Api-key
// SOLO en desarrollo local; un preview público de Replit NO es loopback y debe
// autenticarse igual que producción.

export function isLoopbackHost(value: string | undefined): boolean {
  const raw = value?.trim();
  if (!raw) return false;
  if (raw === "::1" || raw === "[::1]") return true;
  // Loopback IPv4 mapeado a IPv6 (p. ej. el remoteAddress de un socket local).
  if (raw === "::ffff:127.0.0.1") return true;
  const host = raw.replace(/^\[/, "").replace(/\]$/, "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

// Decide si una petición debe tratarse como "dev local" (puede saltar la Api-key).
// IMPORTANTE para seguridad:
//  - En producción NUNCA hay bypass.
//  - Si la petición llegó por el proxy de Replit (preview PÚBLICO) trae cabeceras
//    X-Forwarded-*; el socket se ve loopback (127.0.0.1) porque el proxy corre
//    dentro del contenedor. Por eso primero descartamos cualquier petición
//    proxiada.
//  - La decisión se basa SOLO en la dirección real del socket. NO se usan
//    `Host`/`hostname` porque son controlables por el cliente y podrían falsear
//    "localhost".
export function isLocalDevConnection(opts: {
  nodeEnv: string | undefined;
  remoteAddress: string | undefined;
  hasForwardedHeaders: boolean;
}): boolean {
  if (opts.nodeEnv === "production") return false;
  if (opts.hasForwardedHeaders) return false;
  return isLoopbackHost(opts.remoteAddress);
}
