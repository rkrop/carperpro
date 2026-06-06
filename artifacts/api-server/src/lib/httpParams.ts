// Saneamiento de parámetros de query HTTP, extraído de routes/catalog.ts para
// poder probarse de forma aislada. Estos topes protegen contra abuso (DoS):
// limitan rangos numéricos y longitudes de cadenas provenientes del cliente.

export const MAX_PRODUCT_ID_LENGTH = 128;

// Convierte `raw` a entero acotado a [min, max]. Si no es un número finito,
// regresa `fallback`. Trunca decimales hacia abajo.
export function boundedInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.floor(n), max));
}

// Regresa una cadena recortada si es válida y no excede `maxLength`; de lo
// contrario `undefined` (vacío, no-string o demasiado larga).
export function optionalString(
  raw: unknown,
  maxLength = MAX_PRODUCT_ID_LENGTH,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value || value.length > maxLength) return undefined;
  return value;
}
