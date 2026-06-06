import { and, eq, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  subcategoriesTable,
  productOemCodesTable,
  productApplicationsTable,
  enrichmentStagingTable,
  type ProductSpec,
} from "@workspace/db";
import { logger } from "./logger";
import { withAdvisoryLock, JOB_LOCK } from "./advisory-lock";
import { notTestProduct, sellableProduct } from "./catalogSearch";
import {
  extractAttributes,
  computeEnrichmentWouldWrite,
  type EnrichmentAttributes,
  type EnrichmentBefore,
  type EnrichmentWouldWrite,
  type ExtractedApplication,
} from "./attribute-extraction";

// Fase A — enrichment RUNNER. Walks products whose target fields (marca/ficha
// técnica/oem/aplicaciones) are still empty, asks extractAttributes to mine them
// from the product's OWN text, and EITHER (dry-run) stages every proposal in
// enrichment_staging for human review, OR (write, gated off) fills ONLY the empty
// canonical fields + the structured product_oem_codes / product_applications
// tables. NEVER touches price or stock.
//
// SAFETY: validateGrounding now enforces real anchoring (only values literally in
// the source survive; vehicle makes / generic words are dropped from marca), but
// writes stay gated behind ENRICHMENT_WRITES_ENABLED so a human reviews
// enrichment_staging before anything reaches `products`. Until the flag is flipped,
// write=true is refused at the route.

const SOURCE = "descripcion-erp";
// Tier-2 OpenAI throughput. Per-row backoff (below) is the safety net for the odd
// 429, so a transient failure retries the ONE row instead of aborting the batch.
const CONCURRENCY = 18;
// Per-row retry on transient (429/timeout) failures: up to 5 attempts with
// exponential backoff + jitter. After the last attempt the row is counted as
// failed and SKIPPED (enriched_at stays NULL → a later resume picks it up).
const MAX_ROW_ATTEMPTS = 5;
const RETRY_BASE_MS = 800;
const RETRY_MAX_MS = 20_000;
const MAX_SOURCE_CHARS = 4000;
// Applies ONLY to the write path (applyEnrichmentWrites). Staging records every
// proposal regardless; this gate decides what is ADDITIVELY written to
// products / product_oem_codes / product_applications.
const CONFIDENCE_THRESHOLD = 0.6;

export class EnrichmentWritesDisabledError extends Error {
  constructor() {
    super(
      "Escrituras de enriquecimiento deshabilitadas. " +
        "Revisa enrichment_staging y habilita ENRICHMENT_WRITES_ENABLED=1 cuando quieras aplicar.",
    );
    this.name = "EnrichmentWritesDisabledError";
  }
}

export function writesEnabled(): boolean {
  return process.env.ENRICHMENT_WRITES_ENABLED === "1";
}

interface EnrichRow {
  id: string;
  sku: string;
  name: string;
  brand: string;
  oem: string[] | null;
  vehicles: string[];
  specs: ProductSpec[];
  descripcionEcommerce: string | null;
  descripcionAdicional: string | null;
  descripcion: string | null;
}

// FULL source text: name + the three description columns in priority order, so
// extraction (and, later, grounding) sees everything we know about the part.
// Name is passed separately; the descriptions are merged and capped.
function buildSourceDescripcion(row: EnrichRow): string {
  const parts = [
    row.descripcionEcommerce,
    row.descripcionAdicional,
    row.descripcion,
  ]
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "";
  return parts.join("\n").slice(0, MAX_SOURCE_CHARS);
}

function specsCount(specs: ProductSpec[]): number {
  return Array.isArray(specs) ? specs.length : 0;
}

// Display string for products.vehicles, e.g. "CADILLAC DEVILLE 1982-1989".
function formatApplication(a: ExtractedApplication): string {
  let s = `${a.make} ${a.model}`.trim();
  if (a.year_from && a.year_to) {
    s += a.year_from === a.year_to ? ` ${a.year_from}` : ` ${a.year_from}-${a.year_to}`;
  } else if (a.year_from) {
    s += ` ${a.year_from}`;
  }
  if (a.motor) s += ` ${a.motor}`;
  return s.trim();
}

export interface EnrichmentSampleRow {
  id: string;
  sku: string;
  name: string;
  before: { brand: string; specsCount: number; oemCount: number; appsCount: number };
  extracted: EnrichmentAttributes;
  wouldWrite: EnrichmentWouldWrite;
  staged?: string[];
  written?: { products: string[]; oemCodes: number; applications: number };
}

export interface EnrichmentResult {
  mode: "dry-run" | "write";
  scanned: number;
  withProposals: number;
  proposals: {
    marca: number;
    ficha_tecnica: number;
    oem: number;
    aplicaciones: number;
  };
  staged: number;
  written: { products: number; oemCodes: number; applications: number };
  aborted: boolean;
  // Rows that exhausted MAX_ROW_ATTEMPTS on transient API failures and were
  // skipped (NOT written). They keep enriched_at NULL so a resume re-tries them.
  failed: number;
  sample: EnrichmentSampleRow[];
}

function emptyResult(write: boolean): EnrichmentResult {
  return {
    mode: write ? "write" : "dry-run",
    scanned: 0,
    withProposals: 0,
    proposals: { marca: 0, ficha_tecnica: 0, oem: 0, aplicaciones: 0 },
    staged: 0,
    written: { products: 0, oemCodes: 0, applications: 0 },
    aborted: false,
    failed: 0,
    sample: [],
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Per-row extraction with exponential backoff + jitter on transient (retryable)
// failures. Non-retryable outcomes (empty/invalid model output) return immediately.
// Returns the last result; the caller treats a still-retryable result as "failed,
// skip" so ONE flaky row never aborts a long full-catalog run.
async function extractWithRetry(
  input: { codigo: string; nombre: string; descripcion: string },
): Promise<Awaited<ReturnType<typeof extractAttributes>>> {
  let last = await extractAttributes(input);
  for (let attempt = 1; !last.ok && last.retryable && attempt < MAX_ROW_ATTEMPTS; attempt++) {
    const backoff = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
    const jitter = Math.floor(Math.random() * RETRY_BASE_MS);
    await sleep(backoff + jitter);
    last = await extractAttributes(input);
  }
  return last;
}

// dry-run: replace any prior PENDING proposals for this product (so re-runs are
// idempotent), then write ONE staging row per proposed field. Touches ONLY
// enrichment_staging — never products or the final tables.
async function stageProposals(
  id: string,
  attrs: EnrichmentAttributes,
  w: EnrichmentWouldWrite,
): Promise<string[]> {
  const rows: (typeof enrichmentStagingTable.$inferInsert)[] = [];
  const conf = String(attrs.confidence);
  if (w.marca !== undefined)
    rows.push({ productId: id, field: "marca", proposedValue: w.marca, confidence: conf, source: SOURCE });
  if (w.ficha_tecnica !== undefined)
    rows.push({ productId: id, field: "ficha_tecnica", proposedValue: w.ficha_tecnica, confidence: conf, source: SOURCE });
  if (w.oem !== undefined)
    rows.push({ productId: id, field: "oem", proposedValue: w.oem, confidence: conf, source: SOURCE });
  if (w.aplicaciones !== undefined)
    rows.push({ productId: id, field: "aplicaciones", proposedValue: w.aplicaciones, confidence: conf, source: SOURCE });
  if (rows.length === 0) return [];

  await db
    .delete(enrichmentStagingTable)
    .where(
      and(
        eq(enrichmentStagingTable.productId, id),
        eq(enrichmentStagingTable.status, "pending"),
      ),
    );
  await db.insert(enrichmentStagingTable).values(rows);
  return rows.map((r) => r.field);
}

// write mode (GATED): ADDITIVE, only when confidence >= threshold. Every UPDATE
// re-checks the field is STILL empty (a sync could have filled it between read and
// write). brand/specs/oem/vehicles stay the canonical display values; the codes
// and applications are ALSO inserted in structured form (deduped). Price/stock
// are never in any SET clause.
async function applyEnrichmentWrites(
  id: string,
  attrs: EnrichmentAttributes,
  w: EnrichmentWouldWrite,
): Promise<{ products: string[]; oemCodes: number; applications: number }> {
  const written = { products: [] as string[], oemCodes: 0, applications: 0 };
  if (attrs.confidence < CONFIDENCE_THRESHOLD) return written;

  if (w.marca) {
    const r = await db
      .update(productsTable)
      .set({ brand: w.marca })
      .where(and(eq(productsTable.id, id), eq(productsTable.brand, "SIN MARCA")));
    if ((r.rowCount ?? 0) > 0) written.products.push("brand");
  }
  if (w.ficha_tecnica) {
    const r = await db
      .update(productsTable)
      .set({ specs: w.ficha_tecnica })
      .where(
        and(
          eq(productsTable.id, id),
          sql`coalesce(jsonb_array_length(case when jsonb_typeof(${productsTable.specs}) = 'array' then ${productsTable.specs} else '[]'::jsonb end), 0) = 0`,
        ),
      );
    if ((r.rowCount ?? 0) > 0) written.products.push("specs");
  }
  if (w.oem) {
    const codes = w.oem.map((o) => o.code);
    const r = await db
      .update(productsTable)
      .set({ oem: codes })
      .where(
        and(
          eq(productsTable.id, id),
          sql`(${productsTable.oem} is null or cardinality(${productsTable.oem}) = 0)`,
        ),
      );
    if ((r.rowCount ?? 0) > 0) written.products.push("oem");
  }
  if (w.aplicaciones) {
    const display = w.aplicaciones.map(formatApplication).filter((s) => s.length > 0);
    const r = await db
      .update(productsTable)
      .set({ vehicles: display })
      .where(
        and(
          eq(productsTable.id, id),
          sql`cardinality(${productsTable.vehicles}) = 0`,
        ),
      );
    if ((r.rowCount ?? 0) > 0) written.products.push("vehicles");
  }

  // Structured OEM codes (deduped by code_norm already present for this product).
  if (w.oem && w.oem.length) {
    const existing = await db
      .select({ codeNorm: productOemCodesTable.codeNorm })
      .from(productOemCodesTable)
      .where(eq(productOemCodesTable.productId, id));
    const have = new Set(existing.map((e) => e.codeNorm));
    const toInsert = w.oem
      .filter((o) => !have.has(o.code_norm))
      .map((o) => ({
        productId: id,
        brand: o.brand ?? null,
        codeRaw: o.code,
        codeNorm: o.code_norm,
        source: SOURCE,
      }));
    if (toInsert.length) {
      const r = await db
        .insert(productOemCodesTable)
        .values(toInsert)
        .onConflictDoNothing();
      written.oemCodes = r.rowCount ?? toInsert.length;
    }
  }

  // Structured applications (deduped by make|model|years for this product).
  if (w.aplicaciones && w.aplicaciones.length) {
    const existing = await db
      .select({
        make: productApplicationsTable.make,
        model: productApplicationsTable.model,
        yearFrom: productApplicationsTable.yearFrom,
        yearTo: productApplicationsTable.yearTo,
      })
      .from(productApplicationsTable)
      .where(eq(productApplicationsTable.productId, id));
    const key = (m: string, mo: string, yf: number | null, yt: number | null) =>
      `${m}|${mo}|${yf ?? ""}|${yt ?? ""}`;
    const have = new Set(existing.map((e) => key(e.make, e.model, e.yearFrom, e.yearTo)));
    const toInsert = w.aplicaciones
      .filter((a) => !have.has(key(a.make, a.model, a.year_from ?? null, a.year_to ?? null)))
      .map((a) => ({
        productId: id,
        make: a.make,
        model: a.model,
        yearFrom: a.year_from ?? null,
        yearTo: a.year_to ?? null,
        motor: a.motor ?? null,
        source: SOURCE,
      }));
    if (toInsert.length) {
      const r = await db
        .insert(productApplicationsTable)
        .values(toInsert)
        .onConflictDoNothing();
      written.applications = r.rowCount ?? toInsert.length;
    }
  }

  // Provenance + review state — only when something was actually filled.
  if (written.products.length || written.oemCodes || written.applications) {
    await db
      .update(productsTable)
      .set({
        enrichmentSource: SOURCE,
        enrichmentConfidence: String(attrs.confidence),
        enrichedAt: new Date(),
        enrichmentReviewStatus: "applied",
      })
      .where(eq(productsTable.id, id));
  }
  return written;
}

// Stamp provenance columns (enriched_at) WITHOUT touching any catalog field —
// marks a row "seen, nothing additive to apply" so a resumable full sweep does
// not re-select it and therefore terminates. Additive-only: never alters
// brand/specs/oem/vehicles, price, or stock. Guarded on enriched_at IS NULL so
// it never overwrites an existing applied stamp (idempotent under overlap).
async function markEnrichmentProcessed(
  id: string,
  confidence: number,
  status: "no_data" | "no_extract",
): Promise<void> {
  await db
    .update(productsTable)
    .set({
      enrichmentSource: SOURCE,
      enrichmentConfidence: String(confidence),
      enrichedAt: new Date(),
      enrichmentReviewStatus: status,
    })
    .where(and(eq(productsTable.id, id), sql`${productsTable.enrichedAt} is null`));
}

export async function runEnrichmentBatch(opts: {
  limit: number;
  write: boolean;
  sampleSize?: number;
}): Promise<EnrichmentResult> {
  const limit = Math.max(1, Math.min(opts.limit, 1000));
  const sampleSize = opts.sampleSize ?? Math.min(limit, 60);

  // Honor the user's "do not enable writes yet": refuse write=true until grounding
  // is implemented and the operator flips the flag.
  if (opts.write && !writesEnabled()) {
    throw new EnrichmentWritesDisabledError();
  }

  const rows: EnrichRow[] = await db
    .select({
      id: productsTable.id,
      sku: productsTable.sku,
      name: productsTable.name,
      brand: productsTable.brand,
      oem: productsTable.oem,
      vehicles: productsTable.vehicles,
      specs: productsTable.specs,
      descripcionEcommerce: productsTable.descripcionEcommerce,
      descripcionAdicional: productsTable.descripcionAdicional,
      descripcion: productsTable.descripcion,
    })
    .from(productsTable)
    .where(
      and(
        notTestProduct(),
        sellableProduct(),
        // RESUMABLE: skip anything already processed (enriched_at set), so batch
        // N+1 continues where N stopped instead of reprocessing the same rows.
        sql`${productsTable.enrichedAt} is null`,
        sql`(${productsTable.brand} = 'SIN MARCA'
              or coalesce(jsonb_array_length(case when jsonb_typeof(${productsTable.specs}) = 'array' then ${productsTable.specs} else '[]'::jsonb end), 0) = 0
              or ${productsTable.oem} is null or cardinality(${productsTable.oem}) = 0
              or cardinality(${productsTable.vehicles}) = 0)`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(limit);

  const result = emptyResult(opts.write);
  if (rows.length === 0) return result;

  let next = 0;
  const reports: EnrichmentSampleRow[] = [];

  // Progress heartbeat for long full-catalog runs: every 100 processed rows log
  // processed / written-products / failed / remaining.
  let lastLoggedAt = 0;
  const logProgressMaybe = (): void => {
    if (result.scanned - lastLoggedAt < 100) return;
    lastLoggedAt = result.scanned;
    logger.info(
      {
        procesados: result.scanned,
        escritos_products: result.written.products,
        oem: result.written.oemCodes,
        aplicaciones: result.written.applications,
        fallidos: result.failed,
        restantes: rows.length - result.scanned,
      },
      "enrichment: progreso",
    );
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= rows.length) return;
      const row = rows[i]!;

      const ext = await extractWithRetry({
        codigo: row.sku,
        nombre: row.name,
        descripcion: buildSourceDescripcion(row),
      });
      result.scanned++;
      logProgressMaybe();
      if (!ext.ok) {
        // Transient failure that survived all retries → SKIP this row (leave
        // enriched_at NULL so a resume re-tries it) instead of aborting the run.
        // A non-retryable failure means the model returned nothing extractable,
        // so in write mode mark it processed to keep the full sweep terminating.
        if (ext.retryable) {
          result.failed++;
        } else if (opts.write) {
          await markEnrichmentProcessed(row.id, 0, "no_extract");
        }
        continue;
      }

      const before: EnrichmentBefore = {
        brand: row.brand,
        specsCount: specsCount(row.specs),
        oemCount: row.oem?.length ?? 0,
        appsCount: row.vehicles.length,
      };
      const wouldWrite = computeEnrichmentWouldWrite(before, ext.attrs);
      const hasProposal =
        wouldWrite.marca !== undefined ||
        wouldWrite.ficha_tecnica !== undefined ||
        wouldWrite.oem !== undefined ||
        wouldWrite.aplicaciones !== undefined;

      if (hasProposal) {
        result.withProposals++;
        if (wouldWrite.marca !== undefined) result.proposals.marca++;
        if (wouldWrite.ficha_tecnica !== undefined) result.proposals.ficha_tecnica++;
        if (wouldWrite.oem !== undefined) result.proposals.oem++;
        if (wouldWrite.aplicaciones !== undefined) result.proposals.aplicaciones++;
      }

      const report: EnrichmentSampleRow = {
        id: row.id,
        sku: row.sku,
        name: row.name,
        before: {
          brand: before.brand,
          specsCount: before.specsCount,
          oemCount: before.oemCount,
          appsCount: before.appsCount,
        },
        extracted: ext.attrs,
        wouldWrite,
      };

      if (opts.write) {
        let written = { products: [] as string[], oemCodes: 0, applications: 0 };
        if (hasProposal) {
          written = await applyEnrichmentWrites(row.id, ext.attrs, wouldWrite);
          report.written = written;
          result.written.products += written.products.length;
          result.written.oemCodes += written.oemCodes;
          result.written.applications += written.applications;
        }
        // Resumable sweep: stamp enriched_at on EVERY processed row, even when
        // nothing was filled (no proposal / below threshold / already populated),
        // so it is not re-selected next batch and the full run terminates.
        if (!written.products.length && !written.oemCodes && !written.applications) {
          await markEnrichmentProcessed(row.id, ext.attrs.confidence, "no_data");
        }
      } else if (hasProposal) {
        const staged = await stageProposals(row.id, ext.attrs, wouldWrite);
        report.staged = staged;
        result.staged += staged.length;
      }

      reports.push(report);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()),
  );

  // Per-row backoff means a long run no longer aborts wholesale; transient
  // failures that survived all retries are counted in result.failed instead.
  result.aborted = false;
  if (result.failed > 0) {
    logger.warn(
      { fallidos: result.failed },
      "enrichment: filas omitidas por fallas transitorias tras agotar reintentos",
    );
  }
  const withHits = reports.filter((r) => (r.staged?.length ?? 0) > 0 || r.written);
  const withoutHits = reports.filter((r) => !((r.staged?.length ?? 0) > 0 || r.written));
  result.sample = [...withHits, ...withoutHits].slice(0, sampleSize);
  return result;
}

// ---------------------------------------------------------------------------
// Full-catalog sweep
// ---------------------------------------------------------------------------
// Runs entirely inside the server process. A fire-and-forget HTTP request can
// kick this off and the work continues even after the client socket closes
// (Node does not cancel an in-flight async handler on disconnect), so we do not
// depend on any external loop staying alive. Loops fixed-size batches until the
// candidate pool is exhausted; bails out early if a pool consists only of
// transient failures so a few un-enrichable rows cannot loop forever.

export type SweepStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  batches: number;
  scanned: number;
  withProposals: number;
  written: { products: number; oemCodes: number; applications: number };
  failed: number;
  lastError: string | null;
};

let sweepStatus: SweepStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  batches: 0,
  scanned: 0,
  withProposals: 0,
  written: { products: 0, oemCodes: 0, applications: 0 },
  failed: 0,
  lastError: null,
};

export function getSweepStatus(): SweepStatus {
  return { ...sweepStatus, written: { ...sweepStatus.written } };
}

export function isSweepRunning(): boolean {
  return sweepStatus.running;
}

export async function runFullEnrichmentSweep(opts: {
  write: boolean;
  batchSize?: number;
  maxBatches?: number;
}): Promise<void> {
  if (sweepStatus.running) {
    logger.warn("enrichment sweep: ya en curso; se ignora el disparo duplicado");
    return;
  }
  const batchSize = opts.batchSize ?? 1000;
  const maxBatches = opts.maxBatches ?? 30;
  sweepStatus = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    batches: 0,
    scanned: 0,
    withProposals: 0,
    written: { products: 0, oemCodes: 0, applications: 0 },
    failed: 0,
    lastError: null,
  };
  logger.info(
    { write: opts.write, batchSize, maxBatches },
    "enrichment sweep: iniciando barrido completo del catálogo",
  );
  try {
    // Cross-instance singleton: under Autoscale more than one instance could
    // receive the trigger, so we take a non-blocking advisory lock and only the
    // holder runs the loop. The in-memory `running` flag above guards repeats
    // within a single instance; this guards across instances.
    const ran = await withAdvisoryLock(JOB_LOCK.enrichmentSweep, async () => {
      let stalls = 0;
      for (let i = 0; i < maxBatches; i++) {
        const r = await runEnrichmentBatch({
          limit: batchSize,
          write: opts.write,
          sampleSize: 0,
        });
        sweepStatus.batches++;
        sweepStatus.scanned += r.scanned;
        sweepStatus.withProposals += r.withProposals;
        sweepStatus.written.products += r.written.products;
        sweepStatus.written.oemCodes += r.written.oemCodes;
        sweepStatus.written.applications += r.written.applications;
        sweepStatus.failed += r.failed;
        logger.info(
          {
            lote: sweepStatus.batches,
            scanned: r.scanned,
            withProposals: r.withProposals,
            written: r.written,
            failed: r.failed,
            acumulado: { scanned: sweepStatus.scanned, written: sweepStatus.written },
          },
          "enrichment sweep: lote completado",
        );
        if (r.scanned === 0) break;
        // Pool is only transient failures (nothing newly markable) → don't loop
        // forever on a handful of un-enrichable rows.
        if (r.scanned === r.failed) {
          stalls++;
          if (stalls >= 2) {
            logger.warn(
              { lote: sweepStatus.batches },
              "enrichment sweep: el pool sólo contiene fallas transitorias; deteniendo",
            );
            break;
          }
        } else {
          stalls = 0;
        }
      }
    });
    if (!ran) {
      sweepStatus.lastError = "otra instancia tiene el lock del barrido; se omite";
      logger.warn("enrichment sweep: otra instancia tiene el lock; se omite este disparo");
    }
  } catch (err) {
    sweepStatus.lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "enrichment sweep: error durante el barrido");
  } finally {
    sweepStatus.running = false;
    sweepStatus.finishedAt = new Date().toISOString();
    logger.info({ resumen: getSweepStatus() }, "enrichment sweep: barrido finalizado");
  }
}
