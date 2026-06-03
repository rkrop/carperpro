---
name: Admintotal ERP sync
description: Operational notes for the live Admintotal inbound sync (clave format, rate limits)
---

## ADMINTOTAL_CLAVE format
The clave is the **bare account subdomain** (e.g. `carper`), used to build
`https://<clave>.admintotal.com/api/v2`.

**Why:** A user once set it to the full URL (`https://carper.admintotal.com`),
producing a malformed `https://https//carper.admintotal.com.admintotal.com` and
ENOTFOUND. The config now normalizes any form (strips protocol/path/.admintotal.com
suffix) and fails fast if the result isn't `^[a-z0-9-]+$`.

**How to apply:** If sync errors with a bad host, check whether the clave secret
was entered as a URL rather than the subdomain.

## Rate limiting
The `productos` endpoint is heavily rate-limited (returns 429 from the first page).
Categories and branches sync in seconds; a **full product sync (~7k products at
100/page) takes many minutes** because of 429 backoff. This is expected — the
scheduler retries every ~15 min, so a partial/slow product sync is not a failure.

**How to apply:** Don't block waiting for the product sync to finish. Verify the
connection via the categories/branches sync succeeding; let products complete in
the background.

## Stock lives in `info_almacenes[].disponible` (not `existencias`)
The ERP `productos/` payload carries per-warehouse stock under the key
**`info_almacenes`**, an array of `{ almacen: { id, nombre }, disponible }`.
Quantity is `disponible`; the warehouse id is `almacen.id` (e.g. 1533 "Bodega",
9 "Matriz", 1535 "MAL ESTADO"). The mapper sums sellable `disponible` across
warehouses into a single `stockQty`, written to `products.erpStockQty` on the
product row (the `inventory` table is no longer used) — see [stock-model.md](stock-model.md).

**Why:** The sync mapper originally only checked `existencias`/`almacenes` +
`cantidad`/`stock`, so it silently dropped every stock value — a full 32k-product
sync left `inventory` EMPTY and the whole app showed *Agotado*. Stock is real but
sparse (~1% of catalog rows have any). The "MAL ESTADO" warehouse is
damaged/unsellable goods and is excluded by name (`/mal\s*estado/i`).

**How to apply:** If everything shows *unknown / Consultar*, check `select count(*)
from products where erp_stock_qty is not null` — if 0, no stock has synced yet
(mapper not reading ERP field names, or no sync/webhook has run). The
precios-existencias webhook sends a single aggregate `stock` per sku; it only
covers changed SKUs, so the full `productos` sync is what bulk-loads initial stock.

## Productos sync MUST stream-and-write per page (never buffer-then-write)
The product pull streams pages and upserts each page as it arrives, gracefully
stopping (keeping progress, `pullComplete=false`) on 429/5xx. Pruning of stale
products/brands runs ONLY when `pullComplete` is true.

**Why:** It originally buffered every page into one array before writing anything,
so a single mid-fetch 429 (which is the *norm* here) aborted the run and persisted
NOTHING — leaving all 32k rows at `erp_stock_qty=NULL` ("Consultar") forever, even
though the mapper read stock correctly. A partial pull that writes what it got is
strictly better than an all-or-nothing pull that almost never completes.

**How to apply:** Keep per-page writes; never reintroduce a "collect all then
upsert" shape. Never prune on an incomplete pull (would empty the catalog on a
transient hiccup). After each run a logger.info line + the syncState `message`
report catalog-wide known/zero/unknown coverage — use that to watch the
"Consultar" gap close over successive syncs.

## Productos pull RESUMES across ticks — a "cycle" is a multi-run unit
The full pull must NOT restart at page 0 each tick: it persists where it stopped
and the next tick continues from there, so a pass naturally spans several
rate-limited ticks. The catalog is effectively too big to pull in one tick, so the
unit of correctness is the whole pass ("cycle"), not a single run.

**Why:** Restarting at 0 each tick re-fetched the same early pages and never
reached the tail, so stock coverage crept up painfully slowly. Resuming makes
every tick forward progress → whole catalog gets real quantities in a predictable
window. The resume point is the saved pagination URL (not a numeric offset we
compute), which stays valid across the gap and survives a switch to cursor
pagination.

**How to apply (the trap):** Because a pass spans ticks, NEVER make per-cycle
decisions from a single run's in-memory accumulators (seen-id list, per-run
category counts) — that was the whole previous bug class. Prune stale products by
"not touched since the cycle began" (a row-level sync timestamp), gated on the
cycle actually finishing AND near-full coverage; recompute category counts from
the products table, not the run accumulator. Watch out: Drizzle's `$onUpdate` does
NOT fire on `onConflictDoUpdate`, so the per-row sync timestamp must be set
explicitly in the upsert or the prune deletes live rows. Lean toward MORE retry
persistence per page (bounded backoff, honor Retry-After) since extra pages landed
per tick directly shrink the "Consultar" window.

## Empty `info_almacenes: []` means a CONFIRMED 0 (not "no signal")
List and detail endpoints return IDENTICAL `info_almacenes` arrays, so per-product
detail fetches add nothing. The mapper distinguishes: array present-but-empty →
stockQty 0 (confirmed off-shelf); array with items → summed `disponible`; array
absent entirely → `undefined` (no signal, leave existing value untouched). Empty
arrays cluster in the NEWEST products (low offsets); older offsets are ~fully
stocked.

**Why:** Persisting ERP-reported 0 is the whole point of closing the Consultar gap,
but the defensive rule still holds — a *missing* field must never zero/hide stock.
**Tradeoff:** the catalog query hides 0-stock (`coalesce(erpStockQty,1)>0`), so
faithfully persisting 0 HIDES products that previously showed as "Consultar".
Possible follow-up: show "Agotado" in listings instead of hiding.

## Two-tier stock refresh: full pass + targeted high-frequency pass
Two SEPARATE scheduler timers run independently (`scheduler.ts`): the ~15min full
resumable `productos` pass, and a ~3min lightweight TARGETED refresh
(`targetedRefresh.ts`). The targeted pass keeps the most important quantities
fresh between full passes. Per-tick it picks a small batch (`getTargetedRefreshBatchSize`,
default 25): recently-ordered product ids (parsed from `outbound_orders.lines`
jsonb, last `getTargetedRefreshOrderLookbackDays` days) first, then backfilled with
the stalest known-stock rows (`erp_stock_qty is not null` ordered by
`stock_updated_at asc nulls first`). Each id is refreshed via `getProductoById`
(detail endpoint), stock recomputed with the shared `mapProduct` → `stockQty`.

**Why coexist, not compete:** the targeted pass SKIPS entirely while `isSyncing()`
is true (full pass mid-flight) so the two never fight the same ERP rate-limit
budget; CONCURRENCY=3, small batch. 404 from the detail endpoint → stock set 0
(off-shelf; the full pass prunes it later). `stockQty===undefined` (no signal) →
leave untouched (same defensive rule as the full sync).

**How to apply (the trap):** Drizzle `asc(sql\`col nulls first\`)` emits invalid
`col nulls first asc`; write the whole clause as one raw `sql\`col asc nulls first\``.
Config knobs: `ADMINTOTAL_TARGETED_REFRESH_INTERVAL_MS` (30s floor),
`ADMINTOTAL_TARGETED_REFRESH_BATCH` (1..200), `ADMINTOTAL_TARGETED_REFRESH_ORDER_DAYS`.
