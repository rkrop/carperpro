import { Router, type IRouter, type Request, type Response } from "express";
import { GetPostalCodeResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Free, keyless source for Mexican postal codes. Returns the colonias (as
// "places"), the state and a centroid lat/lng. We proxy it server-side so the
// app has a stable contract (and no CORS), and cache results in memory because
// postal data is effectively static.
const ZIPPO_BASE = "https://api.zippopotam.us/mx";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const NEGATIVE_TTL_MS = 60 * 60 * 1000; // remember "not found" for 1 hour

type PostalCodeData = ReturnType<typeof emptyHit>;
interface CacheEntry {
  expires: number;
  data: PostalCodeData | null; // null = confirmed not found
}
const cache = new Map<string, CacheEntry>();

function emptyHit(cp: string) {
  return {
    cp,
    estado: "",
    municipio: "",
    colonias: [] as string[],
    lat: null as number | null,
    lng: null as number | null,
  };
}

interface ZippoPlace {
  "place name"?: string;
  state?: string;
  latitude?: string;
  longitude?: string;
}
interface ZippoResponse {
  "post code"?: string;
  places?: ZippoPlace[];
}

function normalize(cp: string, raw: ZippoResponse): PostalCodeData {
  const places = Array.isArray(raw.places) ? raw.places : [];
  const colonias = Array.from(
    new Set(
      places
        .map((p) => (p["place name"] ?? "").trim())
        .filter((name) => name.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const estado = (places.find((p) => p.state)?.state ?? "").trim();

  // Centroid: average the place coordinates so the map link lands near the CP
  // even when the buyer doesn't share GPS.
  const coords = places
    .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  const lat =
    coords.length > 0
      ? coords.reduce((s, c) => s + c.lat, 0) / coords.length
      : null;
  const lng =
    coords.length > 0
      ? coords.reduce((s, c) => s + c.lng, 0) / coords.length
      : null;

  return {
    cp,
    estado,
    // zippopotam doesn't expose the municipio cleanly for MX; the colonia list
    // is the actionable part. Leave municipio blank for the client to fill.
    municipio: "",
    colonias,
    lat,
    lng,
  };
}

router.get("/postal-codes/:cp", async (req: Request, res: Response): Promise<void> => {
  const cp = String(req.params.cp ?? "").trim();
  if (!/^\d{5}$/.test(cp)) {
    res.status(400).json({ error: "Código postal inválido (5 dígitos)" });
    return;
  }

  const cached = cache.get(cp);
  if (cached && cached.expires > Date.now()) {
    if (cached.data === null) {
      res.status(404).json({ error: "Código postal no encontrado" });
      return;
    }
    res.json(GetPostalCodeResponse.parse(cached.data));
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const upstream = await fetch(`${ZIPPO_BASE}/${cp}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (upstream.status === 404) {
      cache.set(cp, { expires: Date.now() + NEGATIVE_TTL_MS, data: null });
      res.status(404).json({ error: "Código postal no encontrado" });
      return;
    }
    if (!upstream.ok) {
      throw new Error(`zippopotam respondió ${upstream.status}`);
    }

    const raw = (await upstream.json()) as ZippoResponse;
    const data = normalize(cp, raw);
    cache.set(cp, { expires: Date.now() + CACHE_TTL_MS, data });
    res.json(GetPostalCodeResponse.parse(data));
  } catch (err) {
    logger.warn({ cp, err }, "Postal codes: lookup falló");
    // Soft-fail: return an empty-but-valid payload so the app keeps working with
    // free-text colonia entry instead of blocking checkout.
    res.json(GetPostalCodeResponse.parse(emptyHit(cp)));
  }
});

export default router;
