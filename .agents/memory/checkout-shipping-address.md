---
name: Checkout shipping address (home delivery)
description: How structured delivery address capture + persistence works in carper checkout and its server-side invariants.
---

# Checkout shipping address

Home-delivery (`entrega === "envio"`) captures a structured address (calle, núm
ext/int, CP, colonia, referencias) + optional GPS pin in `carper/app/checkout.tsx`.
Colonia autocomplete by CP comes from a free server proxy to api.zippopotam.us
(`GET /api/postal-codes/:cp`), which also returns estado + a CP centroid used as a
map-link fallback when the buyer doesn't share GPS.

**Invariant — address must reach BOTH order paths.** The cash/SPEI path
(`createOrder`) and the Stripe card path (`startCardCheckout`) must each send and
persist `shippingAddress`. It's easy to wire one and forget the other; historically
the address was dropped entirely on the card path. It is persisted to
`outbound_orders.shipping_address` (jsonb), enriched into the WhatsApp message, and
pushed to the ERP as `observaciones`.

**Why:** wrong/missing delivery addresses caused failed deliveries — the whole
reason the feature exists. A silent drop on one path reintroduces the bug.

**Server-side validation is authoritative.** Both `POST /orders` and
`POST /stripe/checkout` reject `entrega=envio` without a valid normalized address.
`normalizeShippingAddress` requires calle + numExterior + colonia + CP matching
`^\d{5}$`; client validation alone is not enough (direct API / older clients).

**Codegen gotcha:** the generated zod schema for the CP endpoint is
`GetPostalCodeResponse` — `PostalCode` is a TYPE-only export, not a zod schema. Use
`GetPostalCodeResponse.parse(...)` in the route.

**Client gotcha:** the CP lookup is async and unguarded inputs race. `lookupCp`
uses a monotonic `cpReqId` ref to ignore stale responses and resets derived geo
state (estado/municipio/cpCentroid) on every CP edit so the map pin never
mismatches the current CP. Reverse-geocode (expo-location) is best-effort and
unsupported on web — always wrapped so it never blocks; GPS coords alone still give
a precise pin.
