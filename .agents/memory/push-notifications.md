---
name: Carper push & SMS notifications
description: Customer-facing notification architecture — order-state push, back-in-stock push, paid-order SMS — and the reliability rules that keep them correct.
---

# Carper notifications

Three customer-facing channels, all best-effort (a notification failure must NEVER block order fulfillment or stock sync):

1. **Order-state push** (Opción A — ONLY two states): "Pago confirmado" on paid, "No pudimos procesar tu pedido" on failed/cancelled. No ERP changes for this.
2. **Back-in-stock push** ("Avísame cuando vuelva a haber") — push-only, no SMS.
3. **Paid-order SMS** to the customer's `buyerPhone` (WhatsApp is blocked → SMS via Twilio Verify infra), fired at the paid/FULFILLED transition.

## Push transport
- Expo Push API (`https://exp.host/--/api/v2/push/send`) — **no secret/credential needed** to send to `ExponentPushToken[...]`.
- `sendExpoPush` returns `{ invalidTokens, delivered }`. `invalidTokens` = Expo `DeviceNotRegistered` → prune from DB. `delivered` = every batch reached Expo (HTTP-OK + parsed); **false means a transport failure was swallowed** — callers with one-shot semantics must not treat the send as done.

## Guest push tokens
- Guest checkout must keep working: the device's Expo token rides along on the order (`outbound_orders.push_token`) through BOTH paths — Stripe checkout create AND cash/SPEI `/orders`. No auth required to receive paid/failed push.
- Device registers its token at app launch + on auth change via `/api/push/register` (best-effort, web is a no-op).

## Back-in-stock reliability (the part that bit us — see Why)
- Detection: a product transitions 0/NULL → >0. Fired from the webhook precios-existencias loop (real-time) AND `sweepBackInStock()` after each full sync pass (mirror path). BOTH run, so they WILL race.
- **Claim atomically**: `notifyBackInStock` claims pending subs with a single `UPDATE ... SET notifiedAt=now() WHERE notifiedAt IS NULL RETURNING` — only the winning caller sees each row, so concurrent webhook+sweep can't double-send.
- **Un-claim on transport failure**: after sending, if a product's `sendExpoPush` returned `delivered:false`, reset those rows' `notifiedAt` back to null so a later sweep retries. Otherwise an Expo outage silently burns a one-shot subscription.
- **Why:** first pass marked `notifiedAt` unconditionally after send AND used a non-atomic SELECT-then-UPDATE. Result: transient Expo outage dropped alerts forever, and webhook bursts + sweep could send duplicates. Claim-then-conditionally-release fixes both.
- Re-subscribing (`subscribeRestock` upsert on unique(productId, token)) resets `notifiedAt=null` so a future restock notifies again.

## UI limitation
- The "Avísame cuando vuelva a haber" button lives only in producto/[id].tsx's defensive `agotado` branch. Since `sellableProduct()` hides confirmed-0-stock products, that branch is normally unreachable — the button mainly catches stock dropping to 0 mid-view. Subscriptions created elsewhere (e.g. future surfaces) still work end-to-end.
