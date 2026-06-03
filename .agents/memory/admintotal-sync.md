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
