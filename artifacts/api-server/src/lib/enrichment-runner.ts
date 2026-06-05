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
const CONCURRENCY = 4;
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

function writesEnabled(): boolean {
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
    sample: [],
  };
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
  let aborted = false;
  const reports: EnrichmentSampleRow[] = [];

  const worker = async (): Promise<void> => {
    for (;;) {
      if (aborted) return;
      const i = next++;
      if (i >= rows.length) return;
      const row = rows[i]!;

      const ext = await extractAttributes({
        codigo: row.sku,
        nombre: row.name,
        descripcion: buildSourceDescripcion(row),
      });
      result.scanned++;
      if (!ext.ok) {
        if (ext.retryable) {
          aborted = true;
          return;
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

      if (hasProposal) {
        if (opts.write) {
          const written = await applyEnrichmentWrites(row.id, ext.attrs, wouldWrite);
          report.written = written;
          result.written.products += written.products.length;
          result.written.oemCodes += written.oemCodes;
          result.written.applications += written.applications;
        } else {
          const staged = await stageProposals(row.id, ext.attrs, wouldWrite);
          report.staged = staged;
          result.staged += staged.length;
        }
      }

      reports.push(report);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()),
  );

  result.aborted = aborted;
  if (aborted) {
    logger.warn("enrichment: lote abortado por falla transitoria de la API");
  }
  const withHits = reports.filter((r) => (r.staged?.length ?? 0) > 0 || r.written);
  const withoutHits = reports.filter((r) => !((r.staged?.length ?? 0) > 0 || r.written));
  result.sample = [...withHits, ...withoutHits].slice(0, sampleSize);
  return result;
}
