import { and, asc, eq, gt, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  subcategoriesTable,
  type ProductSpec,
} from "@workspace/db";
import {
  getOpenAI,
  isOpenAIConfigured,
  getOpenAIDirect,
  isOpenAIDirectConfigured,
} from "@workspace/integrations-openai-ai-server";
import { normalizeCode } from "./codes";
import { logger } from "./logger";
import { notTestProduct, sellableProduct } from "./catalogSearch";

// PILOTO — extracción de atributos desde NUESTROS PROPIOS nombres de producto.
//
// El ERP nos deja el catálogo casi vacío de atributos estructurados: oem y
// equivalents están en 0, y >90% de las piezas quedan como "SIN MARCA", aunque
// el NOMBRE muchas veces ya trae el fabricante (BOSCH, DELCO, NIPPONDENSO,
// TECNOFUEL), códigos de cruce (=AC270, ARCHY01=A4, C09694) y la aplicación de
// vehículo (CHEVROLET AVEO 08-18, TSURU III). En vez de raspar sitios de
// proveedores (frágil y sin llave de cruce), aquí la IA SOLO ESTRUCTURA lo que
// ya está escrito literalmente en el nombre.
//
// FILOSOFÍA (igual que el resto de la app — "nunca inventar"):
//  - El modelo NO aporta conocimiento externo; solo separa tokens del texto.
//  - Cada valor extraído se valida en el servidor: debe ser SUBCADENA del nombre
//    (normalizado) o se descarta. Una "marca" o un "OEM" que el modelo invente
//    no sobrevive a esta verificación.
//  - Escritura ADITIVA: solo se llenan campos VACÍOS (brand=='SIN MARCA', oem
//    nulo/vacío, vehicles vacío). NUNCA se toca precio ni existencias.
//
// El piloto corre en modo dry-run por defecto (no escribe): produce un reporte
// antes/después para revisar la calidad ANTES de habilitar escrituras.

const MODEL = "gpt-5-nano";
const AI_TIMEOUT_MS = 15000;
// Las listas (oem, aplicaciones) hacen la salida un poco más larga que una
// descripción; gpt-5-nano gasta parte del presupuesto en razonamiento, así que
// dejamos holgura para que el JSON no se trunque.
const MAX_OUTPUT_TOKENS = 700;

const PAGE = 40;
const CONCURRENCY = 5;
const MAX_ITER = 2000;

// Marcas de VEHÍCULO: aparecen en los nombres como aplicación, NO como
// fabricante de la pieza. Si el modelo devuelve una de estas como "marca" de la
// refacción, se descarta (un foco "para CHEVROLET" no es marca CHEVROLET).
const VEHICLE_MAKES = new Set([
  "CHEVROLET",
  "CHEVY",
  "FORD",
  "NISSAN",
  "VOLKSWAGEN",
  "VW",
  "DODGE",
  "CHRYSLER",
  "RAM",
  "TOYOTA",
  "HONDA",
  "MAZDA",
  "MITSUBISHI",
  "HYUNDAI",
  "KIA",
  "SUZUKI",
  "RENAULT",
  "PEUGEOT",
  "FIAT",
  "JEEP",
  "GMC",
  "BUICK",
  "PONTIAC",
  "SEAT",
  "AUDI",
  "BMW",
  "MERCEDES",
  "VOLVO",
  "SUBARU",
  "ISUZU",
  "ACURA",
  "INFINITI",
  "LINCOLN",
  "CADILLAC",
  "MINI",
  "DATSUN",
]);

export interface ExtractRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  oem: string[] | null;
  vehicles: string[];
  categoryName: string | null;
  subcategoryName: string | null;
}

interface VehicleApp {
  marca: string;
  modelo: string;
  anios: string;
}

export interface ExtractedAttributes {
  marca: string | null;
  oem: string[];
  aplicaciones: string[];
  confidence: "alta" | "media" | "baja";
}

export interface PilotReportRow {
  id: string;
  sku: string;
  name: string;
  before: { brand: string; oem: string[]; vehicles: string[] };
  extracted: ExtractedAttributes;
  wouldWrite: { brand?: string; oem?: string[]; vehicles?: string[] };
  written?: { brand?: boolean; oem?: boolean; vehicles?: boolean };
}

// --- Normalización / grounding -------------------------------------------------

// Quita acentos y pasa a mayúsculas para comparar de forma robusta.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

// Reduce a solo alfanuméricos: para comparar códigos sin importar separadores
// (=, -, espacios). "=AC-270" -> "AC270".
function alnum(s: string): string {
  return norm(s).replace(/[^A-Z0-9]/g, "");
}

// ¿`value` aparece como PALABRA (límite de token) en el texto ya plegado
// (norm = sin acentos, MAYÚSCULAS)? Los separadores internos del valor
// (espacios, -, /, .) se vuelven flexibles para tolerar variaciones de escritura.
function tokenInSource(value: string, sourceFolded: string): boolean {
  const v = norm(value).trim();
  if (!v) return false;
  const flexible = v
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[\s\-/.]+/g, "[\\s\\-/.]*");
  return new RegExp(`(^|[^A-Z0-9])${flexible}($|[^A-Z0-9])`).test(sourceFolded);
}

// ¿El año aparece en la fuente, en forma de 4 dígitos (2008) o de 2 (08)?
// Sin año (undefined) = no hay nada que anclar → válido.
function yearInSource(year: number | undefined, sourceFolded: string): boolean {
  if (year === undefined) return true;
  const y4 = String(year);
  const y2 = y4.slice(2);
  return (
    sourceFolded.includes(y4) ||
    new RegExp(`(^|[^0-9])${y2}([^0-9]|$)`).test(sourceFolded)
  );
}

// Palabras DESCRIPTIVAS que el modelo a veces confunde con marca (no son
// fabricantes). Aparecen en los nombres como adjetivos/categoría, así que el
// grounding por subcadena no basta: se rechazan explícitamente.
const NON_BRAND_WORDS = new Set([
  "AUTOMOTIVE",
  "AUTOMOTRIZ",
  "AUTOMOTRICES",
  "ORIGINAL",
  "UNIVERSAL",
  "GENERICO",
  "GENERICA",
  "STD",
  "PREMIUM",
  "NACIONAL",
  "IMPORTADO",
  "IMPORTADA",
  "REFACCION",
  "REFACCIONES",
  "AUTOPARTES",
  "MARCA",
  "PIEZA",
  "PARTE",
  "NUEVO",
  "NUEVA",
]);

// La marca está fundamentada si aparece, literal, en el nombre y no es ni una
// marca de vehículo ni una palabra descriptiva genérica.
function brandGrounded(marca: string, name: string): boolean {
  const m = norm(marca).trim();
  if (m.length < 2) return false;
  if (VEHICLE_MAKES.has(m)) return false;
  if (NON_BRAND_WORDS.has(m)) return false;
  return norm(name).includes(m);
}

// Un código está fundamentado si su núcleo alfanumérico (>=3) aparece en el
// flujo alfanumérico del nombre. Evita aceptar fragmentos triviales.
function codeGrounded(code: string, name: string): boolean {
  const c = alnum(code);
  if (c.length < 3) return false;
  return alnum(name).includes(c);
}

// Un año de 4 dígitos en la salida solo se acepta si él (o su forma de 2
// dígitos) está en el nombre. Permite la expansión legítima "08-18" ->
// "2008-2018" y rechaza años inventados.
function yearsGrounded(anios: string, name: string): boolean {
  if (!anios.trim()) return true;
  const n = norm(name);
  const years = anios.match(/\b(?:19|20)\d{2}\b/g);
  if (!years) {
    // formas cortas tipo "08-18": exige que ambos extremos estén en el nombre.
    const shorts = anios.match(/\d{2}/g) ?? [];
    return shorts.every((s) => new RegExp(`\\b${s}\\b`).test(n));
  }
  return years.every((y) => n.includes(y) || new RegExp(`\\b${y.slice(2)}\\b`).test(n));
}

// La aplicación está fundamentada si marca Y modelo aparecen en el nombre y los
// años (si los hay) están fundamentados.
function appGrounded(app: VehicleApp, name: string): boolean {
  const n = norm(name);
  const marca = norm(app.marca).trim();
  const modelo = norm(app.modelo).trim();
  if (!marca || !modelo) return false;
  if (!n.includes(marca)) return false;
  if (!n.includes(modelo)) return false;
  return yearsGrounded(app.anios ?? "", name);
}

function formatApp(app: VehicleApp): string {
  return [app.marca, app.modelo, app.anios]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

// --- Prompt --------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un analista de catálogo de autopartes en México. Te doy el NOMBRE de una refacción tal como aparece en nuestro catálogo (a veces con su línea/sublínea). Tu única tarea es EXTRAER datos que YA ESTÁN ESCRITOS LITERALMENTE en ese texto. NUNCA infieras, completes ni agregues conocimiento externo.

Extrae estos campos:
1. "marca": el FABRICANTE de la pieza si aparece escrito (ej. BOSCH, DELCO, HELLA, NIPPONDENSO, GONHER, TECNOFUEL, MORESA, LTH). MUY IMPORTANTE: NO uses la marca del VEHÍCULO (CHEVROLET, FORD, NISSAN, VOLKSWAGEN, DODGE, TOYOTA, HONDA, etc.) como marca de la pieza. Si no hay fabricante escrito, devuelve null.
2. "oem": lista de NÚMEROS DE PARTE o CÓDIGOS DE EQUIVALENCIA/CRUCE escritos en el texto (ej. lo que va después de un '=', o códigos alfanuméricos tipo AC270, A4, C09694). NO incluyas: tipos de foco/bulbo (3157, 9004, H4, 194, 1157), medidas, voltajes/watts (12V, 27W), cantidades, ni años. Si no hay, lista vacía.
3. "aplicaciones": lista de vehículos a los que aplica, SOLO si el texto los menciona. Cada uno como objeto {"marca","modelo","anios"} con lo que esté escrito (ej. {"marca":"CHEVROLET","modelo":"AVEO","anios":"08-18"}). NO inventes marcas, modelos ni años que no estén en el texto. Si no hay, lista vacía.

Reglas: usa SOLO texto presente en el nombre. Si dudas, omítelo. No expliques nada.

Responde SIEMPRE en JSON con este formato exacto:
{"marca": string|null, "oem": string[], "aplicaciones": [{"marca": string, "modelo": string, "anios": string}]}`;

function buildUserBlock(row: ExtractRow): string {
  const lines = [`Nombre: ${row.name}`];
  if (row.categoryName) lines.push(`Línea: ${row.categoryName}`);
  if (row.subcategoryName) lines.push(`Sublínea: ${row.subcategoryName}`);
  return lines.join("\n");
}

type RawResult =
  | { ok: true; marca: string | null; oem: string[]; aplicaciones: VehicleApp[] }
  | { ok: false; retryable: boolean };

async function callModel(row: ExtractRow): Promise<RawResult> {
  let content: string | null | undefined;
  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        reasoning_effort: "minimal",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserBlock(row) },
        ],
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    );
    content = completion.choices[0]?.message?.content;
  } catch {
    return { ok: false, retryable: true };
  }
  if (!content) return { ok: false, retryable: false };

  try {
    const parsed = JSON.parse(content) as {
      marca?: unknown;
      oem?: unknown;
      aplicaciones?: unknown;
    };
    const marca =
      typeof parsed.marca === "string" && parsed.marca.trim()
        ? parsed.marca.trim()
        : null;
    const oem = Array.isArray(parsed.oem)
      ? parsed.oem.filter((x): x is string => typeof x === "string")
      : [];
    const aplicaciones = Array.isArray(parsed.aplicaciones)
      ? parsed.aplicaciones
          .map((a) => {
            if (!a || typeof a !== "object") return null;
            const o = a as Record<string, unknown>;
            return {
              marca: typeof o["marca"] === "string" ? o["marca"] : "",
              modelo: typeof o["modelo"] === "string" ? o["modelo"] : "",
              anios: typeof o["anios"] === "string" ? o["anios"] : "",
            } satisfies VehicleApp;
          })
          .filter((a): a is VehicleApp => a !== null)
      : [];
    return { ok: true, marca, oem, aplicaciones };
  } catch {
    return { ok: false, retryable: false };
  }
}

// Extrae y VALIDA (grounding) los atributos de una fila. Cualquier valor que no
// aparezca literalmente en el nombre se descarta. Lanza {retryable} para que el
// lote distinga una falla de API (abortar y reintentar) de una salida vacía.
export async function extractFromName(
  row: ExtractRow,
): Promise<
  | { ok: true; attrs: ExtractedAttributes }
  | { ok: false; retryable: boolean }
> {
  const raw = await callModel(row);
  if (!raw.ok) return { ok: false, retryable: raw.retryable };

  const marca =
    raw.marca && brandGrounded(raw.marca, row.name)
      ? norm(raw.marca).trim()
      : null;

  const oemSet = new Set<string>();
  for (const c of raw.oem) {
    if (codeGrounded(c, row.name)) oemSet.add(norm(c).trim());
  }
  const oem = [...oemSet].slice(0, 8);

  const appSet = new Set<string>();
  for (const a of raw.aplicaciones) {
    if (appGrounded(a, row.name)) appSet.add(formatApp(a));
  }
  const aplicaciones = [...appSet].slice(0, 12);

  const grounded =
    (marca ? 1 : 0) + (oem.length ? 1 : 0) + (aplicaciones.length ? 1 : 0);
  const confidence: ExtractedAttributes["confidence"] =
    marca && (oem.length || aplicaciones.length)
      ? "alta"
      : grounded >= 1
        ? "media"
        : "baja";

  return { ok: true, attrs: { marca, oem, aplicaciones, confidence } };
}

// Qué se escribiría: SOLO campos vacíos (aditivo).
function computeWouldWrite(
  before: { brand: string; oem: string[]; vehicles: string[] },
  attrs: ExtractedAttributes,
): PilotReportRow["wouldWrite"] {
  const w: PilotReportRow["wouldWrite"] = {};
  if (before.brand === "SIN MARCA" && attrs.marca) w.brand = attrs.marca;
  if (before.oem.length === 0 && attrs.oem.length) w.oem = attrs.oem;
  if (before.vehicles.length === 0 && attrs.aplicaciones.length)
    w.vehicles = attrs.aplicaciones;
  return w;
}

// Escritura ADITIVA y guardada: cada UPDATE solo aplica si el campo SIGUE vacío
// (otra sincronización pudo haberlo llenado entre la lectura y la escritura).
// Nunca toca precio ni existencias.
async function applyWrites(
  id: string,
  w: PilotReportRow["wouldWrite"],
): Promise<{ brand?: boolean; oem?: boolean; vehicles?: boolean }> {
  const written: { brand?: boolean; oem?: boolean; vehicles?: boolean } = {};
  if (w.brand) {
    const r = await db
      .update(productsTable)
      .set({ brand: w.brand })
      .where(
        and(eq(productsTable.id, id), eq(productsTable.brand, "SIN MARCA")),
      );
    written.brand = (r.rowCount ?? 0) > 0;
  }
  if (w.oem) {
    const r = await db
      .update(productsTable)
      .set({ oem: w.oem })
      .where(
        and(
          eq(productsTable.id, id),
          sql`(${productsTable.oem} is null or cardinality(${productsTable.oem}) = 0)`,
        ),
      );
    written.oem = (r.rowCount ?? 0) > 0;
  }
  if (w.vehicles) {
    const r = await db
      .update(productsTable)
      .set({ vehicles: w.vehicles })
      .where(
        and(
          eq(productsTable.id, id),
          sql`cardinality(${productsTable.vehicles}) = 0`,
        ),
      );
    written.vehicles = (r.rowCount ?? 0) > 0;
  }
  return written;
}

export interface PilotResult {
  scanned: number;
  withAny: number;
  withBrand: number;
  withOem: number;
  withVehicles: number;
  written: number;
  aborted: boolean;
  sample: PilotReportRow[];
}

// Corre el piloto sobre una muestra de productos con campos objetivo vacíos.
// dry-run por defecto (write=false): NO escribe nada, solo arma el reporte.
export async function runAttributeExtractionPilot(opts: {
  limit: number;
  write: boolean;
  sampleSize?: number;
}): Promise<PilotResult> {
  const limit = Math.max(1, Math.min(opts.limit, 1000));
  const sampleSize = opts.sampleSize ?? Math.min(limit, 60);

  if (!isOpenAIConfigured()) {
    logger.info("atributos: integración OpenAI ausente; piloto omitido");
    return {
      scanned: 0,
      withAny: 0,
      withBrand: 0,
      withOem: 0,
      withVehicles: 0,
      written: 0,
      aborted: false,
      sample: [],
    };
  }

  // Selecciona filas vendibles/no-test que aún carecen de al menos uno de los
  // campos objetivo. Orden aleatorio para una muestra representativa del piloto.
  const rows: ExtractRow[] = await db
    .select({
      id: productsTable.id,
      sku: productsTable.sku,
      name: productsTable.name,
      brand: productsTable.brand,
      oem: productsTable.oem,
      vehicles: productsTable.vehicles,
      categoryName: categoriesTable.name,
      subcategoryName: subcategoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(
      subcategoriesTable,
      eq(productsTable.subcategoryId, subcategoriesTable.id),
    )
    .where(
      and(
        notTestProduct(),
        sellableProduct(),
        sql`(${productsTable.brand} = 'SIN MARCA'
              or ${productsTable.oem} is null or cardinality(${productsTable.oem}) = 0
              or cardinality(${productsTable.vehicles}) = 0)`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);

  const result: PilotResult = {
    scanned: 0,
    withAny: 0,
    withBrand: 0,
    withOem: 0,
    withVehicles: 0,
    written: 0,
    aborted: false,
    sample: [],
  };

  let next = 0;
  let aborted = false;
  const reports: PilotReportRow[] = [];

  const worker = async (): Promise<void> => {
    for (;;) {
      if (aborted) return;
      const i = next++;
      if (i >= rows.length) return;
      const row = rows[i]!;
      const ext = await extractFromName(row);
      result.scanned++;
      if (!ext.ok) {
        if (ext.retryable) {
          aborted = true;
          return;
        }
        continue;
      }
      const before = {
        brand: row.brand,
        oem: row.oem ?? [],
        vehicles: row.vehicles ?? [],
      };
      const wouldWrite = computeWouldWrite(before, ext.attrs);
      const hasWrite =
        wouldWrite.brand !== undefined ||
        wouldWrite.oem !== undefined ||
        wouldWrite.vehicles !== undefined;
      if (hasWrite) {
        result.withAny++;
        if (wouldWrite.brand) result.withBrand++;
        if (wouldWrite.oem) result.withOem++;
        if (wouldWrite.vehicles) result.withVehicles++;
      }

      const report: PilotReportRow = {
        id: row.id,
        sku: row.sku,
        name: row.name,
        before,
        extracted: ext.attrs,
        wouldWrite,
      };

      if (opts.write && hasWrite) {
        const written = await applyWrites(row.id, wouldWrite);
        report.written = written;
        if (written.brand || written.oem || written.vehicles) {
          result.written++;
        }
      }

      reports.push(report);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()),
  );

  result.aborted = aborted;
  // Muestra: prioriza filas con algo que escribir para revisar calidad.
  const withHits = reports.filter(
    (r) =>
      r.wouldWrite.brand || r.wouldWrite.oem || r.wouldWrite.vehicles,
  );
  const withoutHits = reports.filter(
    (r) =>
      !r.wouldWrite.brand && !r.wouldWrite.oem && !r.wouldWrite.vehicles,
  );
  result.sample = [...withHits, ...withoutHits].slice(0, sampleSize);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase A — structured attribute extraction for the enrichment pipeline.
//
// Richer than the name-only pilot above: from a product's codigo/nombre/
// descripcion it extracts marca + ficha técnica + OEM codes (each with its
// manufacturer) + vehicle applications (make/model/year range/motor), using the
// CREDITED direct OpenAI key (getOpenAIDirect, gpt-5-nano, json_object,
// AbortSignal). The output feeds runEnrichmentBatch (A3): in dry-run it stages
// every proposed field for human review; on write it fills ONLY empty fields and
// the structured product_oem_codes / product_applications tables. brand/specs
// stay the canonical marca/ficha técnica. NEVER touches price or stock.
//
// Grounding note: per the plan, validateGrounding and normalizeCodes are
// REPLACEABLE hooks the user implements later (word-boundary anchoring + real
// code normalization). For now validateGrounding is a passthrough and
// normalizeCodes a simple uppercase/strip stub — so until the real grounding
// lands, run dry-run and review enrichment_staging before enabling writes.

export interface ExtractInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

export interface ExtractedOemCode {
  brand?: string;
  code: string; // raw, exactly as written in the source text
  code_norm: string; // search-normalized (see normalizeCodes)
}

export interface ExtractedApplication {
  make: string;
  model: string;
  year_from?: number;
  year_to?: number;
  motor?: string;
}

export interface EnrichmentAttributes {
  marca: string | null;
  // Canonical storage is products.specs (ProductSpec[] = {label,value}); the
  // model's {etiqueta:valor} object is converted to this shape here.
  ficha_tecnica: ProductSpec[];
  oem: ExtractedOemCode[];
  aplicaciones: ExtractedApplication[];
  confidence: number; // 0..1
}

// ── Replaceable hooks (the user implements the real versions) ────────────────

// Grounding real: deja SOLO lo que aparece LITERALMENTE en el texto de origen
// (nombre + descripción). Lo que la IA invente no sobrevive. Recalcula la
// confianza penalizando según cuánto se descartó. Es el candado anti-alucinación
// que faltaba — por eso podemos habilitar write=true.
export function validateGrounding(
  values: EnrichmentAttributes,
  sourceText: string,
): EnrichmentAttributes {
  const folded = norm(sourceText);
  const sourceAlnum = alnum(sourceText);

  // marca: palabra presente, y no marca de vehículo ni palabra genérica.
  let marca: string | null = null;
  if (values.marca) {
    const m = norm(values.marca).trim();
    if (
      m.length >= 2 &&
      !VEHICLE_MAKES.has(m) &&
      !NON_BRAND_WORDS.has(m) &&
      tokenInSource(values.marca, folded)
    ) {
      marca = values.marca;
    }
  }

  // ficha técnica: conserva el spec si su VALOR (núcleo alfanumérico) está en
  // la fuente. Tolerante: "12V" -> "12V" ⊂ "12VOLTIOS".
  const ficha_tecnica = values.ficha_tecnica.filter((s) => {
    const core = alnum(String(s.value));
    return core.length >= 1 && sourceAlnum.includes(core);
  });

  // oem: conserva si el código normalizado (≥3) está en el flujo alfanumérico.
  const oem = values.oem.filter((o) => {
    const core = alnum(o.code);
    return core.length >= 3 && sourceAlnum.includes(core);
  });

  // aplicaciones: el MODELO debe aparecer como palabra (≥2) y los años (si los
  // hay) deben estar en la fuente.
  const aplicaciones = values.aplicaciones.filter((a) => {
    const model = norm(a.model).trim();
    if (model.length < 2 || !tokenInSource(a.model, folded)) return false;
    return yearInSource(a.year_from, folded) && yearInSource(a.year_to, folded);
  });

  // confianza recalculada: la base por la fracción que sobrevivió al anclaje.
  const proposed =
    (values.marca ? 1 : 0) +
    values.ficha_tecnica.length +
    values.oem.length +
    values.aplicaciones.length;
  const kept =
    (marca ? 1 : 0) + ficha_tecnica.length + oem.length + aplicaciones.length;
  const ratio = proposed > 0 ? kept / proposed : 1;
  const confidence = Math.round(clamp01(values.confidence * ratio) * 100) / 100;

  return { marca, ficha_tecnica, oem, aplicaciones, confidence };
}

// TODO(user): richer code normalization (brand-specific rules, O/0 confusions,
// separators, …). For now the SHARED `normalizeCode` (codes.ts): code_norm =
// uppercase with every non-[A-Z0-9] character stripped. De-duplicates and drops
// entries whose normalized form is empty. The SAME helper normalizes the search
// query (productSearch) so what's written here is findable by code.
export function normalizeCodes(
  oem: Array<{ brand?: string | null; code: string }>,
): ExtractedOemCode[] {
  const out: ExtractedOemCode[] = [];
  const seen = new Set<string>();
  for (const o of oem) {
    const code = (o.code ?? "").trim();
    if (!code) continue;
    const code_norm = normalizeCode(code);
    if (!code_norm || seen.has(code_norm)) continue;
    seen.add(code_norm);
    const brand = o.brand?.trim();
    out.push(brand ? { brand, code, code_norm } : { code, code_norm });
  }
  return out;
}

// ── Model call ───────────────────────────────────────────────────────────────

const ENRICH_MODEL = "gpt-5-nano";
const ENRICH_TIMEOUT_MS = 25000;
const ENRICH_MAX_TOKENS = 1200;
// "low" beats "minimal" here: smoke tests showed "minimal" both UNDER-extracted
// (missed obvious vehicle applications and ficha técnica) and OVER-reached
// (invented a part brand not present in the text). "low" extracts the real data
// without hallucinating, at a still-cheap cost.
const ENRICH_REASONING_EFFORT = "low" as const;

const ENRICH_SYSTEM_PROMPT = `Eres un analista de catálogo de autopartes en México. Recibes el CÓDIGO, el NOMBRE y (si existe) la DESCRIPCIÓN de una refacción. Extrae SOLO lo que esté escrito literalmente en ese texto. NUNCA inventes ni agregues conocimiento externo.

Devuelve estos campos:
- "marca": el FABRICANTE de la pieza (Bosch, Valeo, Gonher, Moresa, TF Victor, LTH, Mitsubishi...). Distíngelo de la marca del VEHÍCULO: las marcas y modelos de vehículos (Nissan, Cadillac, Toyota, Geo, Chevrolet, Ford, VW, Dodge, Honda...) NO van aquí, van en "aplicaciones". Si no hay fabricante de la pieza escrito, null.
- "ficha_tecnica": objeto con pares dato:valor presentes en el texto (medidas, material, color, voltaje, watts, dientes, pulgadas, LEDs, posición...), ej. {"Voltaje":"12V","Dientes":"10"}. Si no hay, {}.
- "oem": NÚMEROS DE PARTE o CÓDIGOS DE EQUIVALENCIA/CRUCE escritos (ej. UF103, 90919-02135, 23100-4JA0B), cada uno con su fabricante si se indica: [{"brand": string|null, "code": string}]. NO incluyas tipos de foco/bulbo (3157, 9004, H4, 194), medidas, voltajes/watts ni años. Si no hay, [].
- "aplicaciones": TODOS los vehículos compatibles mencionados, uno por modelo: [{"make": string, "model": string, "year_from": number|null, "year_to": number|null, "motor": string|null}]. Expande rangos de 2 dígitos a 4 (82-89 -> 1982 y 1989). Si solo hay un año, year_from=year_to. Solo incluye un vehículo si tiene make Y model; si solo hay marca de vehículo sin modelo, omítelo. Si no hay, [].
- "confidence": número de 0 a 1 según qué tan claro está todo en el texto.

Reglas: usa SOLO texto presente en los datos. Si dudas, omítelo. No expliques nada.

EJEMPLO
Entrada: "SENSOR TPS CADILLAC DEVILLE, ELDORADO 82-89"
Salida: {"marca": null, "ficha_tecnica": {}, "oem": [], "aplicaciones": [{"make":"CADILLAC","model":"DEVILLE","year_from":1982,"year_to":1989,"motor":null},{"make":"CADILLAC","model":"ELDORADO","year_from":1982,"year_to":1989,"motor":null}], "confidence": 0.9}

Responde SIEMPRE en JSON con este formato exacto:
{"marca": string|null, "ficha_tecnica": {}, "oem": [{"brand": string|null, "code": string}], "aplicaciones": [{"make": string, "model": string, "year_from": number|null, "year_to": number|null, "motor": string|null}], "confidence": number}`;

function buildEnrichUserBlock(input: ExtractInput): string {
  const lines = [`Código: ${input.codigo}`, `Nombre: ${input.nombre}`];
  const desc = (input.descripcion ?? "").trim();
  if (desc) lines.push(`Descripción: ${desc}`);
  return lines.join("\n");
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function toInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseFicha(v: unknown): ProductSpec[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const out: ProductSpec[] = [];
  for (const [label, value] of Object.entries(v as Record<string, unknown>)) {
    const l = label.trim();
    const val = value == null ? "" : String(value).trim();
    if (l && val) out.push({ label: l, value: val });
  }
  return out.slice(0, 30);
}

function parseApps(v: unknown): ExtractedApplication[] {
  if (!Array.isArray(v)) return [];
  const out: ExtractedApplication[] = [];
  for (const a of v) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const make =
      typeof o["make"] === "string" ? o["make"].trim().toUpperCase() : "";
    const model =
      typeof o["model"] === "string" ? o["model"].trim().toUpperCase() : "";
    if (!make || !model) continue;
    const app: ExtractedApplication = { make, model };
    const yf = toInt(o["year_from"]);
    const yt = toInt(o["year_to"]);
    if (yf !== undefined) app.year_from = yf;
    if (yt !== undefined) app.year_to = yt;
    const motor = typeof o["motor"] === "string" ? o["motor"].trim() : "";
    if (motor) app.motor = motor;
    out.push(app);
  }
  return out.slice(0, 20);
}

// Extract structured attributes from one product's codigo/nombre/descripcion.
// Distinguishes a transient API failure (retryable → caller aborts the run) from
// an empty/invalid output (skip the row). The result is passed through the
// replaceable validateGrounding hook before returning.
export async function extractAttributes(
  input: ExtractInput,
): Promise<
  | { ok: true; attrs: EnrichmentAttributes }
  | { ok: false; retryable: boolean }
> {
  if (!isOpenAIDirectConfigured()) return { ok: false, retryable: false };

  const sourceText = buildEnrichUserBlock(input);
  let content: string | null | undefined;
  try {
    const completion = await getOpenAIDirect().chat.completions.create(
      {
        model: ENRICH_MODEL,
        max_completion_tokens: ENRICH_MAX_TOKENS,
        reasoning_effort: ENRICH_REASONING_EFFORT,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ENRICH_SYSTEM_PROMPT },
          { role: "user", content: sourceText },
        ],
      },
      { signal: AbortSignal.timeout(ENRICH_TIMEOUT_MS) },
    );
    content = completion.choices[0]?.message?.content;
  } catch {
    return { ok: false, retryable: true };
  }
  if (!content) return { ok: false, retryable: false };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { ok: false, retryable: false };
  }

  const marca =
    typeof parsed["marca"] === "string" && parsed["marca"].trim()
      ? (parsed["marca"] as string).trim()
      : null;
  const ficha_tecnica = parseFicha(parsed["ficha_tecnica"]);
  const rawOem = Array.isArray(parsed["oem"])
    ? (parsed["oem"] as unknown[])
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const o = x as Record<string, unknown>;
          const code = typeof o["code"] === "string" ? o["code"] : "";
          if (!code) return null;
          const brand = typeof o["brand"] === "string" ? o["brand"] : null;
          return { brand, code };
        })
        .filter((x): x is { brand: string | null; code: string } => x !== null)
    : [];
  const oem = normalizeCodes(rawOem);
  const aplicaciones = parseApps(parsed["aplicaciones"]);
  const confidence =
    typeof parsed["confidence"] === "number"
      ? clamp01(parsed["confidence"] as number)
      : 0;

  const attrs = validateGrounding(
    { marca, ficha_tecnica, oem, aplicaciones, confidence },
    sourceText,
  );
  return { ok: true, attrs };
}

// What enrichment WOULD write, comparing against the product's currently-empty
// target fields (ADDITIVE — only empties are fillable). brand/specs are the
// canonical marca/ficha técnica; oem/aplicaciones map to the structured tables.
export interface EnrichmentBefore {
  brand: string;
  specsCount: number;
  oemCount: number; // existing product_oem_codes rows (or products.oem length)
  appsCount: number; // existing product_applications rows
}

export interface EnrichmentWouldWrite {
  marca?: string;
  ficha_tecnica?: ProductSpec[];
  oem?: ExtractedOemCode[];
  aplicaciones?: ExtractedApplication[];
}

export function computeEnrichmentWouldWrite(
  before: EnrichmentBefore,
  attrs: EnrichmentAttributes,
): EnrichmentWouldWrite {
  const w: EnrichmentWouldWrite = {};
  if (before.brand === "SIN MARCA" && attrs.marca) w.marca = attrs.marca;
  if (before.specsCount === 0 && attrs.ficha_tecnica.length)
    w.ficha_tecnica = attrs.ficha_tecnica;
  if (before.oemCount === 0 && attrs.oem.length) w.oem = attrs.oem;
  if (before.appsCount === 0 && attrs.aplicaciones.length)
    w.aplicaciones = attrs.aplicaciones;
  return w;
}
