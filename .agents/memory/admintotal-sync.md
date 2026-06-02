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
