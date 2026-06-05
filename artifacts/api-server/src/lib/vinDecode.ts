// VIN decoding via the free NHTSA vPIC API (Task #62). When a shopper pastes a
// 17-character VIN, we resolve it to make/model/year/engine so the assistant can
// identify the vehicle instead of looping or promising a decode it can't do.
//
// Fully OPTIONAL and time-bounded: any failure (malformed VIN, network/timeout,
// or a vehicle vPIC doesn't cover — common for some Mexican-market models)
// returns null, and the assistant simply continues by asking for make/model/year.
// No API key/secret is required. Results are cached (including short-lived
// negatives) so repeated turns in the same conversation don't re-hit the API.

const VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h for a successful decode
const NEG_CACHE_TTL_MS = 10 * 60 * 1000; // 10min for a miss (vehicle may be added)
const CACHE_MAX = 300;

export interface DecodedVin {
  vin: string;
  make: string | null;
  model: string | null;
  year: string | null;
  /** e.g. "4.0L 6 cil." when available, else null. */
  engine: string | null;
  /** Human-readable es-MX summary, e.g. "Jeep Cherokee 1998, motor 4.0L 6 cil." */
  summary: string;
}

// A VIN is exactly 17 chars: uppercase letters (excluding I, O, Q) and digits.
// The lookaheads require at least one letter AND one digit so we don't match a
// bare 17-digit number or a 17-letter word.
const VIN_RE =
  /\b(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])(?=[A-HJ-NPR-Z0-9]*[0-9])[A-HJ-NPR-Z0-9]{17}\b/;

/** Find a VIN anywhere in free text (case-insensitive). Returns it uppercased. */
export function extractVin(text: string): string | null {
  if (!text) return null;
  const match = text.toUpperCase().match(VIN_RE);
  return match ? match[0] : null;
}

interface CacheEntry {
  value: DecodedVin | null;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

function setCache(key: string, value: DecodedVin | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const ttl = value ? CACHE_TTL_MS : NEG_CACHE_TTL_MS;
  cache.set(key, { value, expires: Date.now() + ttl });
}

// vPIC returns "" / "Not Applicable" / "0" for fields it can't determine.
function clean(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || /^not applicable$/i.test(v) || v === "0") return null;
  return v;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
}

function formatEngine(displacementL: string | null, cylinders: string | null): string | null {
  const parts: string[] = [];
  if (displacementL) {
    const n = Number(displacementL);
    parts.push(Number.isFinite(n) ? `${n.toFixed(1)}L` : `${displacementL}L`);
  }
  if (cylinders) parts.push(`${cylinders} cil.`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function buildSummary(
  make: string | null,
  model: string | null,
  year: string | null,
  engine: string | null,
): string {
  const vehicle = [make, model].filter(Boolean).join(" ");
  let summary = vehicle;
  if (year) summary += ` ${year}`;
  if (engine) summary += `, motor ${engine}`;
  return summary;
}

/**
 * Decode a 17-char VIN to make/model/year/engine via vPIC. Returns null when the
 * lookup fails or vPIC can't identify at least the make or model. Never throws.
 */
export async function decodeVin(vin: string): Promise<DecodedVin | null> {
  const key = vin.toUpperCase();
  if (!VIN_RE.test(key)) return null;

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let result: DecodedVin | null = null;
  try {
    const res = await fetch(`${VPIC_URL}/${encodeURIComponent(key)}?format=json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        Results?: Array<Record<string, string>>;
      };
      const r = data.Results?.[0];
      if (r) {
        const make = clean(r.Make);
        const model = clean(r.Model);
        const year = clean(r.ModelYear);
        const engine = formatEngine(clean(r.DisplacementL), clean(r.EngineCylinders));
        // Treat as a real decode only when vPIC identified at least make or model.
        if (make || model) {
          const niceMake = make ? titleCase(make) : null;
          const niceModel = model ? titleCase(model) : null;
          result = {
            vin: key,
            make: niceMake,
            model: niceModel,
            year,
            engine,
            summary: buildSummary(niceMake, niceModel, year, engine),
          };
        }
      }
    }
  } catch {
    // Timeout / network / parse error → treat as a miss; assistant asks for the
    // vehicle manually. Do not cache transient failures as long-lived negatives.
    return null;
  }

  setCache(key, result);
  return result;
}
