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
Quantity is `disponible`; the warehouse id is `almacen.id`. Confirmed warehouse
ids: Bodega 1533, Matriz 9, California 1530, Costera 1531, Navojoa 1532, IMSS
1534, MAL ESTADO 1535. The mapper sums sellable `disponible` into a single
`stockQty`, written to `products.erpStockQty` (the `inventory` table is no longer
used) — see [stock-model.md](stock-model.md).

**Why:** The sync mapper originally only checked `existencias`/`almacenes` +
`cantidad`/`stock`, so it silently dropped every stock value — a full 32k-product
sync left `inventory` EMPTY and the whole app showed *Agotado*. Stock is real but
sparse (~1% of catalog rows have any).

**Sellable-warehouse filter (Matriz + Bodega only):** parseInventory now counts
`disponible` ONLY from the ids in `getSellableWarehouseIds()` (config; default
`9,1533`, override `ADMINTOTAL_SELLABLE_WAREHOUSE_IDS`). Everything else —
other branches (California/Costera/Navojoa), IMSS, MAL ESTADO — is dropped, so a
product reads available only when it has units in a store we sell from. This is
what narrows the visible catalog to the ~13,906 in-stock-in-Bodega/Matriz set
the merchant also scoped their webhooks to. **Why:** the business is single-store
(Matriz) + its Bodega; the old rule summed every warehouse except MAL ESTADO, so
a part with stock only in another branch wrongly showed as available. A product
with `info_almacenes` present but no sellable entry collapses to a confirmed 0
(hidden), per the empty-array rule below.

**How to apply:** If everything shows *unknown / Consultar*, check `select count(*)
from products where erp_stock_qty is not null` — if 0, no stock has synced yet
(mapper not reading ERP field names, or no sync/webhook has run). The
precios-existencias webhook sends a single aggregate `stock` per sku; it only
covers changed SKUs, so the full `productos` sync is what bulk-loads initial stock.

## `activo=1` is the ONLY honored server-side filter on `productos/`
Probed live: the API SILENTLY IGNORES warehouse/existencia filters — `almacen=`,
`almacen_id=`, `con_existencia=`, `existencia__gt=0`, `disponible__gt=0`, `stock=1`
all return the full `count` (32,553). Stock-oriented endpoints (`existencias/`,
`inventario/`, `almacenes/{id}/productos/`, `kardex/`) all 404. The one filter
that works is **`activo=1`** → 22,496 (drops ~10k inactive/discontinued). Also
honored: exact `?codigo=` (see client.ts detail-lookup note). streamProductos
sends `activo=1` so each pass fetches ~31% fewer pages under the rate limit.

**Why it matters:** you CANNOT make the ERP return only the in-stock or
single-warehouse subset — narrowing to Bodega/Matriz happens client-side in the
mapper, which does NOT speed the fetch (still pages through all active products);
`activo=1` is the only thing that actually shrinks the pull. Don't re-probe
warehouse filters hoping they work — they're silently dropped.

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
`stock_updated_at asc nulls first`). Each id is refreshed via `getProductoByCodigo`
(exact-match `?codigo=`, NOT the pk-keyed detail route — see the codigo-lookup
section above), stock recomputed with the shared mapper → `stockQty`.

**Why coexist, not compete:** the targeted pass SKIPS entirely while `isSyncing()`
is true (full pass mid-flight) so the two never fight the same ERP rate-limit
budget; CONCURRENCY=3, small batch. 404 from the detail endpoint → stock set 0
(off-shelf; the full pass prunes it later). `stockQty===undefined` (no signal) →
leave untouched (same defensive rule as the full sync).

**How to apply (the trap):** Drizzle `asc(sql\`col nulls first\`)` emits invalid
`col nulls first asc`; write the whole clause as one raw `sql\`col asc nulls first\``.
Config knobs: `ADMINTOTAL_TARGETED_REFRESH_INTERVAL_MS` (30s floor),
`ADMINTOTAL_TARGETED_REFRESH_BATCH` (1..200), `ADMINTOTAL_TARGETED_REFRESH_ORDER_DAYS`.

## Per-product live lookup MUST use `?codigo=`, NOT the detail-by-id route
Our catalog stores products keyed by **código** (`products.id === código === sku`,
e.g. `"02537"`), because the mapper derives id from `clave/codigo/sku`. But the
ERP detail route **`productos/{id}/` keys on Admintotal's INTERNAL numeric pk**.
So `getProductoById("02537")` makes the ERP read it as **pk 2537** and return a
COMPLETELY DIFFERENT product (a different part, often inactive/0-stock) — NOT a
404, so it silently looks "valid". The correct single-product lookup is
`getProductoByCodigo(codigo)` → exact-match `?codigo=` filter on `productos/`
(only the first page; require `row.codigo === codigo`, else null = unavailable).

**Why:** a live, in-stock part (código 02537: Bodega 2 + Matriz 1 = 3 sellable,
activo, $407.57) was reported `disponible: 0` and BLOCKED card checkout, because
the live stock gate (`liveStock.ts`) and targeted refresh (`targetedRefresh.ts`)
both passed the código to the pk-keyed detail route and read a wrong product
(pk 2537 = an inactive "CONECTOR 4 VIAS" at 0). The detail route returns wrong
data **without erroring** — that's what made it look like a real stockout.

**How to apply:** Any per-product ERP fetch keyed by our stored id MUST go through
`getProductoByCodigo`. Never reintroduce `getProductoById(ourId)` for stock/price
checks. `getProductoById` (pk route) is only correct if you genuinely hold an ERP
pk, which we never store. The `?codigo=` filter is server-honored exact-match
(confirmed: returns count 1 for the right product); the pk image-probe note below
still used `productos/{id}/` with a real pk for that one diagnostic.

## The v2 API exposes only ONE image per product (`imagen_url`)
The `productos/{id}/` detail payload carries a single `imagen_url` string and no
image array. Probed sub-resources (`productos/{id}/imagenes|documentos|archivos|
galeria/`, `documentos/?producto=`, `producto_imagenes/?producto=`) ALL 404.

**Why it matters:** Merchants see multiple photos per product in the Admintotal
WEB ADMIN, but those extra images are not reachable through the v2 REST API we
sync from — so the catalog (web + app) can only ever show the one `imagen_url`.
Don't promise a multi-image gallery sourced from the ERP; the data isn't there.

**How to apply:** To show more than one photo, the images must come from elsewhere
(staff uploading extra photos to object storage, or a different/ecommerce
Admintotal API if one is ever enabled). The mobile app renders photos via
`artifacts/carper/components/ProductImage.tsx` — which uses **expo-image** with
`cachePolicy="memory-disk"` so a photo downloads once and repeat views are
instant (the old RN `Image` had no disk cache → it re-fetched every time).

**Confirmed by a live dump of `productos/{id}/`** (every top-level key): the ONLY
image field is `imagen_url`; there is no imagenes/medios/galeria/documentos array.
The single image lives in GCS under `.../carper/documentos/<name>_<rand>.jpg`, so
the extra photos a merchant sees in the web admin are attachments in the product's
"Documentos" area — not exposed by v2 (documentos endpoints 404). The webhook
"Creación de productos" body confirms the same single `imagen_url`.

**Unused-but-available fields worth surfacing later:** `descripcion_ecommerce`
(rich text, e.g. "APLICACIONES: Cummins / Freightliner / Kenworth / Mack" — the
vehicle fitment list), `marca`, `porcentaje_iva`/`porcentaje_ieps`, `precio_neto`.
We currently don't map `descripcion_ecommerce`; it's a quick catalog-quality win.

## Global request limiter + per-fetch wrapping (deadlock trap)
Every Admintotal HTTP call funnels through ONE process-wide `RequestLimiter`
(`client.ts`): a concurrency cap (`ADMINTOTAL_MAX_CONCURRENCY`, default 5), optional
min spacing between starts (`ADMINTOTAL_MIN_INTERVAL_MS`), and a global 429 pause
(`pauseFor`/`pausedUntil`) so one 429 backs the WHOLE process off, not just the
caller that hit it. Use the lazy `getAdmintotalClient()` singleton everywhere
(sync/targetedRefresh/outbound/liveStock) — not `new AdmintotalClient()` — so the
api_key is logged in once and all callers share the limiter. Local per-call
CONCURRENCY (e.g. liveStock's 5) is now subordinate to this global cap.

**Why (the trap):** `request()` is RECURSIVE on retry. Wrap ONLY the `fetch` in
`limiter.run()`, never the whole `request()` — `run()` releases its slot in
`finally` before the backoff `sleep`/recursive retry, so sleeping callers don't
occupy a slot and recursion never re-enters while holding one. Wrapping all of
`request()` would deadlock (slot held across the sleep + recursive acquire).
Spacing is reserved synchronously in `acquire()` (read+write `nextSlotAt` with no
await between) so concurrent acquirers space out; the wait loop re-checks
`pausedUntil` so a 429 pause set AFTER reservation still delays. Backoff is
`backoffWithJitter` (50–100% of exponential, capped 15s) on network + 429/5xx (NOT
401 reauth) to avoid thundering-herd reconvergence.

**How to apply:** live stock has a short TTL cache (`ADMINTOTAL_STOCK_TTL_MS`,
default 30s) keyed by productId. Pass `{ force: true }` to
`getLiveSellableStock`/`getAvailableStock` whenever the result CONFIRMS a sale
(post-payment `fulfillPaidOrder`) — never confirm a sale on cached stock. The
pre-payment gate may use the cache (the forced post-payment re-check is the real
guard). `unverified → local DB mirror` degradation is unchanged.
