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
