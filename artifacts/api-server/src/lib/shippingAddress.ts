import type { ShippingAddress } from "@workspace/db";

/**
 * Coerce arbitrary request input into a clean ShippingAddress, or null when the
 * required fields (calle, número exterior, colonia, CP) aren't present. Optional
 * fields are normalized to `undefined` (never null/empty) so the value matches
 * the DB column type and never persists noise.
 */
export function normalizeShippingAddress(raw: unknown): ShippingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const optStr = (v: unknown): string | undefined => {
    const s = str(v);
    return s.length > 0 ? s : undefined;
  };
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const calle = str(r.calle);
  const numExterior = str(r.numExterior);
  const colonia = str(r.colonia);
  const cp = str(r.cp);
  // CP must be a 5-digit Mexican postal code — reject anything else so a
  // malformed address never reaches persistence/ERP.
  if (!calle || !numExterior || !colonia || !/^\d{5}$/.test(cp)) return null;

  return {
    calle,
    numExterior,
    colonia,
    cp,
    numInterior: optStr(r.numInterior),
    municipio: optStr(r.municipio),
    estado: optStr(r.estado),
    referencias: optStr(r.referencias),
    lat: num(r.lat),
    lng: num(r.lng),
    mapsUrl: optStr(r.mapsUrl),
  };
}

/** One-line, human-readable address string (no map link). */
export function formatAddressLine(a: ShippingAddress): string {
  const parts = [
    `${a.calle} ${a.numExterior}${a.numInterior ? ` int ${a.numInterior}` : ""}`,
    `Col. ${a.colonia}`,
    `CP ${a.cp}`,
    a.municipio,
    a.estado,
  ].filter((p): p is string => Boolean(p));
  return parts.join(", ");
}

/** ERP "observaciones" text so the store sees the delivery address + map link. */
export function buildAddressObservaciones(a: ShippingAddress): string {
  let out = `Entrega a domicilio: ${formatAddressLine(a)}`;
  if (a.referencias) out += `. Referencias: ${a.referencias}`;
  if (a.mapsUrl) out += `. Mapa: ${a.mapsUrl}`;
  return out;
}
