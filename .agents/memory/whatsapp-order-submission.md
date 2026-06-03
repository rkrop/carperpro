---
name: WhatsApp (cash/SPEI) order submission
description: How the mobile cash/SPEI checkout submits orders and why it now hits POST /orders
---

The mobile checkout's cash (efectivo) / SPEI path now calls `POST /api/orders`
(generated `useCreateOrder`) BEFORE opening WhatsApp, not just a local-only
WhatsApp send.

**Why:** that endpoint carries the server-side stock guard. Calling it first
lets a 409 (`{error, items:[{name, requested, available, ...}]}`) reject
over-ordered lines and surface an itemized "solo quedan X" message + a "Ver
carrito" route-back, instead of the old silent WhatsApp send that ignored stock.
The order is also created/queued to the ERP (endpoint purpose: "Submit an app
order"), and its server folio (`APP-...`) is used in the WhatsApp message +
local order, replacing the old client `CAR-...` folio.

**How to apply:**
- The single-store app sends `sucursalId: STORE.id` which is `""`. `POST /orders`
  resolves a blank/whitespace sucursalId to the default (Matriz, via
  `getWebhookSucursalId()`), mirroring the Stripe checkout path. Do NOT require a
  real sucursalId from this client.
- The generated client throws `ApiError` with `.status` and parsed `.data`;
  detect the shortfall by duck-typing `status === 409` + `data.items` (the
  `ApiError` class is not re-exported from `@workspace/api-client-react`).
- Most catalog products report unknown stock (erpStockQty null) in dev, so the
  409 is hard to trigger live; verify the sucursal fallback instead by posting a
  blank sucursalId + bogus product id and expecting "Productos no encontrados"
  (not "Sucursal no válida").
