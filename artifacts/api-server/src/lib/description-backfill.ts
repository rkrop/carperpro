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
} from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { notTestProduct, sellableProduct } from "./catalogSearch";
import { withAdvisoryLock, JOB_LOCK } from "./advisory-lock";

// Offline batch generator for AI sales descriptions (Task #49). The Admintotal
// ERP leaves almost the entire catalog without a `descripcion`, so a shopper
// would otherwise see "sin descripción" on most parts. Here we generate a short,
// useful Spanish sales description from the product's REAL data (name, brand,
// category, specs, vehicles, OEM) and store it in `descripcion_generada`. It is
// served ONLY as a fallback when the ERP `descripcion` is empty (see
// serializeProduct), so it never overrides real copy.
//
// This runs entirely OFF the request path: on boot and on the periodic
// scheduler tick, exactly like the embedding backfill. It is idempotent and
// resumable — it only touches rows where `descripcion_generada IS NULL` (which is
// also what the reset trigger sets when source content changes), so changed/new
// products get a fresh description automatically.
//
// STRICT grounding: the model is instructed to use only the data we give it and
// to never invent specs, compatibility, warranties or prices; a server-side
// guard additionally rejects any output that slips in a price/warranty/stock
// claim, leaving that row NULL to be retried on a later pass.

const MODEL = "gpt-5-nano"; // same cheap/fast model as the search assist
const AI_TIMEOUT_MS = 15000;
// Generous budget: gpt-5-nano spends part of it on reasoning, so a low cap
// truncates the JSON mid-description. 500 leaves ample room for the short text.
const MAX_OUTPUT_TOKENS = 500;

// Rows pulled from the DB per page. Each row becomes one chat completion, run
// through a small concurrency pool so we generate steadily without flooding the
// integration proxy.
const PAGE = 40;
const CONCURRENCY = 5;
// Bounds the loop so a bug can't spin forever. ~8k sellable rows / PAGE leaves
// huge headroom.
const MAX_ITER = 2000;

// Guards against overlapping runs (the boot pass and the periodic tick can both
// call this). A second concurrent call simply no-ops, so we never double-spend
// model calls on the same NULL rows.
let running = false;

interface GenRow {
  id: string;
  name: string;
  brand: string;
  specs: ProductSpec[];
  vehicles: string[];
  oem: string[] | null;
  categoryName: string | null;
  subcategoryName: string | null;
  // md5 of the exact source columns the reset trigger watches, computed in SQL
  // at read time. The write only lands if this still matches at write time, so a
  // concurrent ERP change during generation can't leave a stale description.
  fp: string;
}

// Fingerprint over the SAME columns as the products_embedding_reset trigger
// (name/brand/descripcion/specs/vehicles/oem/category_id/subcategory_id). `q` is
// the column qualifier: `products.` in the SELECT (the join also has a `name`
// column, so it must be qualified) and empty in the UPDATE (single table). Both
// render to the same expression over the same columns → identical md5.
function fingerprintExpr(q: string): string {
  return `md5(
    coalesce(${q}name,'') || E'\\x1f' ||
    coalesce(${q}brand,'') || E'\\x1f' ||
    coalesce(${q}descripcion,'') || E'\\x1f' ||
    coalesce(${q}specs::text,'') || E'\\x1f' ||
    coalesce(${q}vehicles::text,'') || E'\\x1f' ||
    coalesce(${q}oem::text,'') || E'\\x1f' ||
    coalesce(${q}category_id::text,'') || E'\\x1f' ||
    coalesce(${q}subcategory_id::text,'')
  )`;
}

const SYSTEM_PROMPT = `Eres redactor de catálogo de Carper Autopartes, una refaccionaria mexicana. Escribes una descripción de venta breve y clara para una refacción, en español de México.

Reglas estrictas (MUY IMPORTANTE):
- Usa ÚNICAMENTE los datos que se te dan. NO inventes especificaciones, medidas, materiales, compatibilidad con vehículos, números de parte, garantías ni precios.
- Si un dato no aparece en la información, NO lo menciones ni lo supongas. No agregues marcas, modelos ni años de vehículos que no estén en los datos.
- NO prometas existencias ni tiempos de entrega. NO incluyas precios ni SKUs en el texto.
- Escribe 1 a 3 oraciones, máximo ~45 palabras. Tono profesional y útil, sin exagerar (evita "el mejor", "garantizado", "calidad insuperable").
- Escribe SOLO la descripción de la pieza, como en una ficha de producto. NO hagas comentarios sobre tu propia respuesta ni sobre los datos: prohibido usar frases como "basado en el nombre", "según la ficha", "descripción general", "sin especificaciones adicionales" o similares. NO repitas etiquetas como "Nombre:" ni "Línea:".
- Si solo tienes el nombre de la pieza, descríbela de forma general según lo que es, sin inventar detalles y sin aclarar que te basas en el nombre.

Responde SIEMPRE en JSON con este formato exacto:
{"descripcion": "tu descripción aquí"}`;

// Turn the product's real fields into a compact, labeled data block. Empty
// fields are omitted so the model is never tempted to fill a blank.
function buildDataBlock(row: GenRow): string {
  const lines: string[] = [`Nombre: ${row.name}`];
  if (row.brand && row.brand !== "SIN MARCA") lines.push(`Marca: ${row.brand}`);
  if (row.categoryName) lines.push(`Línea: ${row.categoryName}`);
  if (row.subcategoryName) lines.push(`Sublínea: ${row.subcategoryName}`);
  const specs = (row.specs ?? [])
    .map((s) => `${s.label}: ${s.value}`)
    .filter((s) => s.trim() !== ":")
    .join("; ");
  if (specs) lines.push(`Especificaciones: ${specs}`);
  const vehicles = (row.vehicles ?? []).filter(Boolean);
  if (vehicles.length)
    lines.push(`Vehículos compatibles: ${vehicles.join(", ")}`);
  const oem = (row.oem ?? []).filter(Boolean);
  if (oem.length) lines.push(`Códigos OEM: ${oem.join(", ")}`);
  return lines.join("\n");
}

// Server-side grounding guard, mirroring the assistant's. Prompt rules alone
// don't guarantee the model won't slip a fabricated price, warranty or stock
// claim into the prose, so we reject any output that contains those specifics
// (the row stays NULL and is retried later). Compatibility/specs aren't guarded
// here because, when present, they come straight from the data block.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\$\s?\d/, // "$1,200"
  /\d[\d.,]*\s?(pesos|mxn|m\.n\.|mn)\b/i, // "350 pesos", "1200 mxn"
  /\bgarant(í|i)a|garantizad/i, // invented warranties
  /\b\d+\s*(piezas?|en stock|en existencia|disponibles?|existencias?)/i, // stock claims
  /\b(?:hay|tenemos|quedan)\s+\d+/i, // "hay 5", "tenemos 3"
];

function hasForbiddenSpecifics(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

// Grounding guard for invented vehicle-compatibility YEARS — the most common and
// most checkable fabricated spec. A 4-digit year in the output is allowed only
// when it (or its 2-digit form) is present in the source data block, so the
// legitimate "03-07" → "2003-2007" expansion passes while an invented "2015"
// (with no 15/2015 anywhere in the data) is rejected and the row stays NULL.
function hasUngroundedYear(text: string, dataBlock: string): boolean {
  const years = text.match(/\b(?:19|20)\d{2}\b/g);
  if (!years) return false;
  return years.some((year) => {
    if (dataBlock.includes(year)) return false;
    const suffix = year.slice(2); // "2003" → "03"
    return !new RegExp(`\\b${suffix}\\b`).test(dataBlock);
  });
}

type GenResult =
  | { ok: true; text: string }
  // retryable=true → API/timeout/network (likely an outage): abort the run and
  // retry on the next pass. retryable=false → empty/guard-rejected output: skip
  // this row (leave NULL) and keep going.
  | { ok: false; retryable: boolean };

// Generate one product's description. Throws nothing — distinguishes a transient
// API failure (retryable) from a content rejection (skip) via the result type.
async function generateDescription(row: GenRow): Promise<GenResult> {
  const dataBlock = buildDataBlock(row);
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
          {
            role: "user",
            content: `Datos de la refacción:\n${dataBlock}`,
          },
        ],
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    );
    content = completion.choices[0]?.message?.content;
  } catch {
    // Timeout / network / API error → treat as outage, abort the run.
    return { ok: false, retryable: true };
  }

  if (!content) return { ok: false, retryable: false };

  let text = "";
  try {
    const parsed = JSON.parse(content) as { descripcion?: unknown };
    if (typeof parsed.descripcion === "string")
      text = parsed.descripcion.trim();
  } catch {
    return { ok: false, retryable: false };
  }

  if (!text || text.length < 10) return { ok: false, retryable: false };
  if (hasForbiddenSpecifics(text)) return { ok: false, retryable: false };
  if (hasUngroundedYear(text, dataBlock))
    return { ok: false, retryable: false };

  return { ok: true, text };
}

// Generate AI sales descriptions for every sellable, non-test product that has
// no ERP `descripcion` and no generated one yet. Mirrors backfillEmbeddings:
// idempotent, resumable across restarts, safe to call repeatedly (overlapping
// calls no-op). No-ops with a log when the OpenAI integration isn't configured.
//
// Pages by keyset (id) rather than re-selecting NULL rows: a row that fails the
// content guard stays NULL but the cursor moves past it, so one bad row can't
// stall the rest of the catalog within a run — it's simply retried on the next
// full pass.
export async function backfillDescriptions(): Promise<void> {
  if (!isOpenAIConfigured()) {
    logger.info(
      "descripciones: integración OpenAI ausente; generación omitida (catálogo intacto)",
    );
    return;
  }
  if (running) {
    logger.debug(
      "descripciones: generación ya en curso, se omite esta ejecución",
    );
    return;
  }
  running = true;
  try {
    const ran = await withAdvisoryLock(
      JOB_LOCK.descriptionBackfill,
      runDescriptionBackfill,
    );
    if (!ran) {
      logger.debug(
        "descripciones: otra instancia tiene el lock de generación, se omite esta ejecución",
      );
    }
  } catch (err) {
    logger.error({ err }, "descripciones: generación falló (no fatal)");
  } finally {
    running = false;
  }
}

// The real pass, run under a Postgres advisory lock so only one instance
// generates descriptions at a time across an Autoscale fleet.
async function runDescriptionBackfill(): Promise<void> {
  logger.info(
    "descripciones: iniciando generación (se reanuda tras reinicios)",
  );
  let total = 0;
  let iterations = 0;
  let cursor = "";
  for (;;) {
    if (++iterations > MAX_ITER) {
      logger.error(
        { total, iterations },
        "descripciones: generación abortada por límite de iteraciones",
      );
      break;
    }

    const page: GenRow[] = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        brand: productsTable.brand,
        specs: productsTable.specs,
        vehicles: productsTable.vehicles,
        oem: productsTable.oem,
        categoryName: categoriesTable.name,
        subcategoryName: subcategoriesTable.name,
        fp: sql<string>`${sql.raw(fingerprintExpr("products."))}`,
      })
      .from(productsTable)
      .leftJoin(
        categoriesTable,
        eq(productsTable.categoryId, categoriesTable.id),
      )
      .leftJoin(
        subcategoriesTable,
        eq(productsTable.subcategoryId, subcategoriesTable.id),
      )
      .where(
        and(
          sql`${productsTable.descripcionGenerada} is null`,
          sql`(${productsTable.descripcion} is null or btrim(${productsTable.descripcion}) = '')`,
          gt(productsTable.id, cursor),
          notTestProduct(),
          sellableProduct(),
        ),
      )
      .orderBy(asc(productsTable.id))
      .limit(PAGE);

    if (page.length === 0) break;
    cursor = page[page.length - 1]!.id;

    // Generate the page through a small concurrency pool. A retryable (API)
    // failure aborts the whole run so we don't burn calls during an outage.
    let updated = 0;
    let aborted = false;
    let next = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        if (aborted) return;
        const i = next++;
        if (i >= page.length) return;
        const row = page[i]!;
        const result = await generateDescription(row);
        if (result.ok) {
          // Land the write ONLY if the row is still NULL, still lacks an ERP
          // descripcion, and its source fingerprint is unchanged since we read
          // it. If an ERP sync touched the watched columns mid-generation (the
          // reset trigger NULLed it again), the fingerprint differs and this
          // is a no-op — the row gets a fresh description on the next pass
          // instead of a stale one being written back.
          const res = await db.execute(
            sql`update products set descripcion_generada = ${result.text}
                  where id = ${row.id}
                    and descripcion_generada is null
                    and (descripcion is null or btrim(descripcion) = '')
                    and ${sql.raw(fingerprintExpr(""))} = ${row.fp}`,
          );
          if (res.rowCount && res.rowCount > 0) updated++;
        } else if (result.retryable) {
          aborted = true;
          return;
        }
        // content skip → leave NULL, move on
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, page.length) }, () =>
        worker(),
      ),
    );

    total += updated;
    if (aborted) {
      logger.error(
        { total },
        "descripciones: fallo de API, generación detenida (se reintenta en el próximo arranque/tick)",
      );
      break;
    }
    logger.info({ generated: total }, "descripciones: progreso de generación");
  }

  if (total > 0) {
    logger.info({ generated: total }, "descripciones: generación completada");
  } else {
    logger.info("descripciones: sin filas pendientes (catálogo al día)");
  }
}
