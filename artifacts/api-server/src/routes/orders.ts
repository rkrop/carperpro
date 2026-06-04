import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  outboundOrdersTable,
  productsTable,
  type OutboundOrder,
  type OutboundOrderLine,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { pushOrder } from "../lib/admintotal/outbound";
import { resolveSucursalId } from "../lib/sucursal";
import { effectivePrice } from "../lib/pricing";
import { normalizeShippingAddress } from "../lib/shippingAddress";
import { getOptionalUserId, ensureUser } from "../middlewares/requireAuth";
import { writeLimiter } from "../middlewares/rateLimit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Signals a client-facing failure raised inside the order transaction. Throwing
// it rolls the transaction back (no half-written order) while carrying the HTTP
// status + body to return to the caller.
class OrderError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(typeof body.error === "string" ? body.error : "Order error");
  }
}

function makeFolio(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `APP-${stamp}-${rand}`;
}

router.post("/orders", writeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Pedido inválido", details: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  if (input.lines.length === 0) {
    res.status(400).json({ error: "El pedido no tiene productos" });
    return;
  }

  // Resolve the sucursal: client value if valid, else the configured webhook
  // branch, else any existing branch. The single-store app submits a blank
  // sucursalId on purpose, so we must supply a real seeded branch here.
  const sucursalId = await resolveSucursalId(input.sucursalId);
  if (!sucursalId) {
    res.status(400).json({ error: "Sucursal no válida" });
    return;
  }

  // Home delivery requires a complete structured address (calle, núm. exterior,
  // colonia, CP de 5 dígitos). Reject envío orders without one so a malformed or
  // missing address never reaches persistence/ERP.
  const shippingAddress = normalizeShippingAddress(input.shippingAddress);
  if (input.entrega === "envio" && !shippingAddress) {
    res.status(400).json({ error: "La dirección de envío está incompleta o es inválida" });
    return;
  }

  // Link the order to the buyer's account when signed in (guest checkout stays
  // fully supported — userId is simply null for anonymous orders). Provisioning
  // is idempotent and independent of the order, so it runs before the
  // transaction (it does its own network call to Clerk — keeping that out of the
  // DB transaction avoids holding a connection open across a remote call).
  const userId = getOptionalUserId(req);
  if (userId) {
    try {
      await ensureUser(userId);
    } catch (err) {
      logger.warn({ userId, err }, "No se pudo aprovisionar la cuenta al crear el pedido");
    }
  }

  const requestedIds = input.lines.map((l) => l.productId);
  // Normalize quantities to a positive integer (mirrors the Stripe path). This
  // is what defends the stock check below: without it, a negative/zero/
  // fractional qty could offset a positive line in the per-product sum and slip
  // past the guard.
  const normalizedQty = (qty: number): number => Math.max(1, Math.floor(qty));

  let order: OutboundOrder;
  try {
    // Atomic order creation: re-read the products (locking their rows), validate
    // existence + stock, and insert the order — all in ONE transaction. If
    // anything throws, the transaction rolls back and NO partial order row is
    // left behind. Locking the product rows (FOR UPDATE) also serializes
    // concurrent orders for the same parts, so two simultaneous checkouts can't
    // both pass a stock check that only one should.
    order = await db.transaction(async (tx) => {
      // Recompute prices from DB — never trust client-supplied economic values.
      const dbProducts = await tx
        .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name, price: productsTable.price, costo: productsTable.costo, stock: productsTable.erpStockQty })
        .from(productsTable)
        .where(inArray(productsTable.id, requestedIds))
        .for("update");

      const priceMap = new Map(dbProducts.map((p) => [p.id, p]));
      const unknownIds = requestedIds.filter((id) => !priceMap.has(id));
      if (unknownIds.length > 0) {
        throw new OrderError(400, { error: "Productos no encontrados en catálogo", ids: unknownIds });
      }

      // Stock guard for the non-card path (cash / SPEI). Enforce against the
      // local ERP-mirrored count, the same source the app's quantity cap uses: a
      // known count (erpStockQty not null) can't be exceeded, while unknown
      // stock (null) stays orderable. Quantities are summed per product so the
      // same part split across lines can't slip past. The card/Stripe path keeps
      // its stricter live-ERP gate.
      const requestedByProduct = new Map<string, number>();
      for (const l of input.lines) {
        requestedByProduct.set(l.productId, (requestedByProduct.get(l.productId) ?? 0) + normalizedQty(l.qty));
      }
      const shortfalls = dbProducts.filter(
        (p) => p.stock != null && (requestedByProduct.get(p.id) ?? 0) > p.stock,
      );
      if (shortfalls.length > 0) {
        const detail = shortfalls.map((p) => `${p.name} (disponible: ${p.stock})`).join(", ");
        throw new OrderError(409, {
          error: `Algunos productos ya no están disponibles en la cantidad solicitada: ${detail}. Actualiza tu carrito e inténtalo de nuevo.`,
          items: shortfalls.map((p) => ({
            productId: p.id,
            sku: p.sku,
            name: p.name,
            requested: requestedByProduct.get(p.id) ?? 0,
            available: p.stock,
          })),
        });
      }

      const lines: OutboundOrderLine[] = input.lines.map((l) => {
        const dbP = priceMap.get(l.productId)!;
        return {
          productId: dbP.id,
          sku: dbP.sku,
          name: dbP.name,
          qty: normalizedQty(l.qty),
          price: effectivePrice(dbP), // authoritative ERP-mirrored price (precio venta, else costo)
        };
      });

      const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
      const folio = makeFolio();
      const inserted = await tx
        .insert(outboundOrdersTable)
        .values({
          folio,
          status: "pending",
          userId: userId ?? null,
          sucursalId,
          entrega: input.entrega,
          pago: input.pago,
          buyerName: input.buyerName ?? null,
          buyerPhone: input.buyerPhone ?? null,
          shippingAddress,
          pushToken: input.pushToken ?? null,
          lines,
          total,
        })
        .returning();
      return inserted[0];
    });
  } catch (err) {
    if (err instanceof OrderError) {
      res.status(err.status).json(err.body);
      return;
    }
    throw err; // unexpected: bubble to the central error handler (logged + 500)
  }

  // Attempt an immediate push. If it fails the order stays queued for the
  // scheduler to retry — we ALWAYS confirm to the client so the buyer knows
  // their order is saved and avoids duplicate submissions. This runs AFTER the
  // transaction commits so the queued order is durably persisted first.
  try {
    await pushOrder(order);
  } catch (err) {
    logger.warn({ orderId: order.id, err }, "Admintotal: push inmediato falló, pedido en cola para reintento");
  }

  const fresh = await db
    .select()
    .from(outboundOrdersTable)
    .where(eq(outboundOrdersTable.id, order.id))
    .limit(1);
  const finalOrder = fresh[0] ?? order;

  res.status(201).json({
    id: finalOrder.id,
    folio: finalOrder.folio,
    status: finalOrder.status,
    admintotalPedidoId: finalOrder.admintotalPedidoId ?? null,
  });
});

export default router;
