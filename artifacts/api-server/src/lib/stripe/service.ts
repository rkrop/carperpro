import { eq, inArray, and, isNotNull, gt, lt, or } from "drizzle-orm";
import {
  db,
  outboundOrdersTable,
  sucursalesTable,
  productsTable,
  type OutboundOrder,
  type OutboundOrderLine,
} from "@workspace/db";
import type Stripe from "stripe";
import { getUncachableStripeClient } from "./client";
import { getWebhookSucursalId } from "../admintotal/config";
import { pushOrder } from "../admintotal/outbound";
import { getAvailableStock, getLiveSellableStock } from "../admintotal/liveStock";
import { logger } from "../logger";

export interface CheckoutLineInput {
  productId: string;
  qty: number;
}

export interface CreateCheckoutInput {
  sucursalId?: string;
  entrega: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  lines: CheckoutLineInput[];
  /** Where Stripe should return the buyer (app deep link or web URL). */
  dest: string;
}

export interface ClientOrder {
  id: number;
  folio: string;
  total: number;
  entrega: string;
  pago: string;
  paymentStatus: string;
  lines: { id: string; name: string; sku: string; qty: number; price: number }[];
}

export class CheckoutError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function makeFolio(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `APP-${stamp}-${rand}`;
}

/** Public base URL where /api/stripe/* is reachable (for Stripe redirect URLs). */
export function getPublicBaseUrl(): string {
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN?.trim();
  if (!domain) {
    throw new CheckoutError(
      500,
      "No se pudo determinar el dominio público para el pago.",
    );
  }
  return `https://${domain}`;
}

export function orderToClient(order: OutboundOrder): ClientOrder {
  return {
    id: order.id,
    folio: order.folio,
    total: order.total,
    entrega: order.entrega,
    pago: order.pago,
    paymentStatus: order.paymentStatus,
    lines: order.lines.map((l) => ({
      id: l.productId,
      name: l.name,
      sku: l.sku,
      qty: l.qty,
      price: l.price,
    })),
  };
}

/**
 * Build the order (status "awaiting_payment") + a Stripe Checkout Session with
 * dynamic price_data line items. Prices are recomputed from the DB — never
 * trust client-supplied amounts.
 */
export async function createCardCheckoutSession(
  input: CreateCheckoutInput,
): Promise<{ url: string; orderId: number; folio: string }> {
  if (!input.lines || input.lines.length === 0) {
    throw new CheckoutError(400, "El pedido no tiene productos");
  }
  if (!input.dest || typeof input.dest !== "string") {
    throw new CheckoutError(400, "Falta la URL de retorno (dest)");
  }

  // Resolve the sucursal: client value if valid, else the main store (Matriz).
  const sucursalId = input.sucursalId?.trim() || getWebhookSucursalId();
  const suc = await db
    .select({ id: sucursalesTable.id })
    .from(sucursalesTable)
    .where(eq(sucursalesTable.id, sucursalId))
    .limit(1);
  if (suc.length === 0) {
    throw new CheckoutError(400, "Sucursal no válida");
  }

  const requestedIds = input.lines.map((l) => l.productId);
  const dbProducts = await db
    .select({
      id: productsTable.id,
      sku: productsTable.sku,
      name: productsTable.name,
      price: productsTable.price,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, requestedIds));

  const priceMap = new Map(dbProducts.map((p) => [p.id, p]));
  const unknownIds = requestedIds.filter((id) => !priceMap.has(id));
  if (unknownIds.length > 0) {
    throw new CheckoutError(400, "Productos no encontrados en catálogo", {
      ids: unknownIds,
    });
  }

  const lines: OutboundOrderLine[] = input.lines.map((l) => {
    const dbP = priceMap.get(l.productId)!;
    const qty = Math.max(1, Math.floor(l.qty));
    return { productId: dbP.id, sku: dbP.sku, name: dbP.name, qty, price: dbP.price };
  });

  const payable = lines.filter((l) => l.price > 0);
  if (payable.length === 0) {
    throw new CheckoutError(
      400,
      "Los productos no tienen precio disponible para pago en línea",
    );
  }

  // Live stock gate: verify each part is actually available (in the requested
  // quantity) against Admintotal before taking the buyer to payment. Falls back
  // to the local mirror when the ERP is unreachable. Requested quantity is summed
  // per productId first, so the same part split across multiple lines can't slip
  // past the check.
  const availability = await getAvailableStock(requestedIds);
  const requestedByProduct = aggregateRequested(lines);
  const shortfalls = lines.filter(
    (l) => (availability.get(l.productId) ?? 0) < (requestedByProduct.get(l.productId) ?? 0),
  );
  if (shortfalls.length > 0) {
    const detail = shortfalls
      .map((l) => `${l.name} (disponible: ${availability.get(l.productId) ?? 0})`)
      .join(", ");
    throw new CheckoutError(
      409,
      `Algunos productos ya no están disponibles en la cantidad solicitada: ${detail}. Actualiza tu carrito e inténtalo de nuevo.`,
      {
        items: shortfalls.map((l) => ({
          productId: l.productId,
          sku: l.sku,
          name: l.name,
          requested: requestedByProduct.get(l.productId) ?? l.qty,
          available: availability.get(l.productId) ?? 0,
        })),
      },
    );
  }

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const folio = makeFolio();

  const inserted = await db
    .insert(outboundOrdersTable)
    .values({
      folio,
      status: "awaiting_payment",
      sucursalId,
      entrega: input.entrega,
      pago: "Tarjeta",
      buyerName: input.buyerName ?? null,
      buyerPhone: input.buyerPhone ?? null,
      lines,
      total,
      paymentStatus: "unpaid",
    })
    .returning();
  const order = inserted[0];

  const stripe = await getUncachableStripeClient();
  const base = getPublicBaseUrl();
  const ret = (status: string) =>
    `${base}/api/stripe/return?order=${order.id}&status=${status}&dest=${encodeURIComponent(input.dest)}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: payable.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(l.price * 100),
          product_data: {
            name: l.name,
            metadata: { sku: l.sku, productId: l.productId },
          },
        },
      })),
      metadata: { orderId: String(order.id), folio },
      client_reference_id: String(order.id),
      success_url: ret("success"),
      cancel_url: ret("cancel"),
    });

    if (!session.url) {
      throw new CheckoutError(502, "Stripe no devolvió una URL de pago");
    }

    await db
      .update(outboundOrdersTable)
      .set({ stripeSessionId: session.id })
      .where(eq(outboundOrdersTable.id, order.id));

    return { url: session.url, orderId: order.id, folio };
  } catch (err) {
    // Roll the order back to failed so it never lingers as a phantom order.
    await db
      .update(outboundOrdersTable)
      .set({ status: "failed", paymentStatus: "failed", lastError: String(err) })
      .where(eq(outboundOrdersTable.id, order.id));
    if (err instanceof CheckoutError) throw err;
    logger.error({ err, orderId: order.id }, "Stripe: error al crear sesión de pago");
    throw new CheckoutError(502, "No se pudo iniciar el pago con tarjeta");
  }
}

// Sum the requested quantity per productId across order lines, so a part that
// appears in more than one line is checked against its TOTAL demand.
function aggregateRequested(lines: OutboundOrderLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lines) {
    map.set(l.productId, (map.get(l.productId) ?? 0) + l.qty);
  }
  return map;
}

async function loadOrder(orderId: number): Promise<OutboundOrder | null> {
  const rows = await db
    .select()
    .from(outboundOrdersTable)
    .where(eq(outboundOrdersTable.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

// If a "fulfilling" claim is older than this, assume the worker that took it
// crashed and allow another to reclaim it (so paid orders never get stranded).
const FULFILL_LEASE_MS = 5 * 60 * 1000;

/**
 * Authoritative payment check: retrieves the Checkout Session from Stripe and,
 * if paid, re-verifies stock LIVE before fulfilling. If everything is in stock
 * the order is queued for Admintotal; if a part sold out during the payment
 * window the charge is auto-refunded and the order cancelled. Idempotent and
 * safe under concurrent callers (verify / scheduler / webhook).
 */
export async function reconcileStripeOrder(
  orderId: number,
): Promise<OutboundOrder | null> {
  const order = await loadOrder(orderId);
  if (!order) return null;
  // Terminal states — nothing left to do.
  if (order.paymentStatus === "refunded" || order.status === "cancelled") {
    return order;
  }
  // Already fulfilled (paid + queued/sent). Only paid orders still in the
  // awaiting_payment / fulfilling phase need the stock re-check below.
  if (
    order.paymentStatus === "paid" &&
    order.status !== "awaiting_payment" &&
    order.status !== "fulfilling"
  ) {
    return order;
  }
  if (!order.stripeSessionId) return order;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

  if (session.status === "expired") {
    await db
      .update(outboundOrdersTable)
      .set({ paymentStatus: "failed", status: "failed" })
      .where(
        and(
          eq(outboundOrdersTable.id, order.id),
          eq(outboundOrdersTable.paymentStatus, "unpaid"),
        ),
      );
    return (await loadOrder(order.id)) ?? order;
  }

  if (session.payment_status !== "paid") return order;

  // Payment captured. Flag it paid once, but keep the order OUT of the ERP queue
  // (status stays awaiting_payment) until the live stock re-check passes.
  if (order.paymentStatus === "unpaid") {
    await db
      .update(outboundOrdersTable)
      .set({ paymentStatus: "paid", paidAt: new Date() })
      .where(
        and(
          eq(outboundOrdersTable.id, order.id),
          eq(outboundOrdersTable.paymentStatus, "unpaid"),
        ),
      );
  }

  // Claim fulfillment so exactly one worker proceeds. The common path claims
  // awaiting_payment -> fulfilling; a stale "fulfilling" lease (crashed worker)
  // can be reclaimed after FULFILL_LEASE_MS. Both are single-winner because the
  // conditional UPDATE bumps updatedAt and only one row matches.
  const current = (await loadOrder(order.id)) ?? order;
  if (current.paymentStatus !== "paid") return current;

  let owns = false;
  if (current.status === "awaiting_payment") {
    const claimed = await db
      .update(outboundOrdersTable)
      .set({ status: "fulfilling" })
      .where(
        and(
          eq(outboundOrdersTable.id, order.id),
          eq(outboundOrdersTable.status, "awaiting_payment"),
        ),
      )
      .returning({ id: outboundOrdersTable.id });
    owns = claimed.length > 0;
  } else if (current.status === "fulfilling") {
    const staleCutoff = new Date(Date.now() - FULFILL_LEASE_MS);
    const reclaimed = await db
      .update(outboundOrdersTable)
      .set({ status: "fulfilling" })
      .where(
        and(
          eq(outboundOrdersTable.id, order.id),
          eq(outboundOrdersTable.status, "fulfilling"),
          lt(outboundOrdersTable.updatedAt, staleCutoff),
        ),
      )
      .returning({ id: outboundOrdersTable.id });
    owns = reclaimed.length > 0;
  }
  if (!owns) return (await loadOrder(order.id)) ?? current;

  const fresh = (await loadOrder(order.id)) ?? current;
  return fulfillPaidOrder(stripe, session, fresh);
}

/**
 * For a paid order we own: re-verify stock live and either queue it for the ERP
 * or, if a part sold out, auto-refund and cancel. Only refunds on POSITIVE
 * confirmation of a shortfall — if the ERP can't be reached we proceed with
 * fulfillment (the buyer already paid) rather than refunding on uncertainty.
 */
async function fulfillPaidOrder(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  order: OutboundOrder,
): Promise<OutboundOrder> {
  let soldOut: OutboundOrderLine[] = [];
  try {
    const { available } = await getLiveSellableStock(
      order.lines.map((l) => l.productId),
    );
    // Sum requested qty per productId so a part split across lines is compared
    // against its TOTAL demand, not each line in isolation.
    const requestedByProduct = aggregateRequested(order.lines);
    soldOut = order.lines.filter(
      (l) =>
        available.has(l.productId) &&
        (available.get(l.productId) ?? 0) < (requestedByProduct.get(l.productId) ?? 0),
    );
  } catch (err) {
    logger.warn(
      { orderId: order.id, err },
      "Stripe: no se pudo reverificar stock tras el pago; se continúa con el envío",
    );
    soldOut = [];
  }

  if (soldOut.length > 0) {
    return refundSoldOutOrder(stripe, session, order, soldOut);
  }

  // In stock — advance to the ERP queue and push immediately; the scheduler
  // retries on failure.
  await db
    .update(outboundOrdersTable)
    .set({ status: "pending" })
    .where(eq(outboundOrdersTable.id, order.id));
  const queued = (await loadOrder(order.id)) ?? order;
  pushOrder(queued).catch((err) =>
    logger.warn(
      { orderId: queued.id, err },
      "Admintotal: push de pedido pagado falló, queda en cola",
    ),
  );
  return queued;
}

// Auto-refund a paid order whose item(s) sold out during the payment window.
async function refundSoldOutOrder(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  order: OutboundOrder,
  soldOut: OutboundOrderLine[],
): Promise<OutboundOrder> {
  const reason = `AGOTADO: ${soldOut
    .map((l) => `${l.name} (${l.sku})`)
    .join(", ")}`;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  let refunded = false;
  if (paymentIntentId) {
    try {
      // Idempotency key keyed on the order guards against a double refund if a
      // stale-lease reclaim re-enters this path for the same order.
      await stripe.refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `carper-refund-${order.id}` },
      );
      refunded = true;
    } catch (err) {
      logger.error(
        { orderId: order.id, err },
        "Stripe: el reembolso automático falló; requiere revisión manual",
      );
    }
  } else {
    logger.error(
      { orderId: order.id },
      "Stripe: no hay payment_intent para reembolsar el pedido agotado",
    );
  }

  // Cancel either way so a sold-out order is NEVER pushed to the ERP; flag for
  // manual review when the automatic refund could not be issued.
  await db
    .update(outboundOrdersTable)
    .set({
      status: "cancelled",
      paymentStatus: refunded ? "refunded" : "paid",
      lastError: refunded ? reason : `${reason} — REEMBOLSO MANUAL PENDIENTE`,
    })
    .where(eq(outboundOrdersTable.id, order.id));
  logger.info(
    { orderId: order.id, soldOut: soldOut.map((l) => l.sku), refunded },
    "Stripe: pedido agotado tras el pago; cancelado",
  );
  return (await loadOrder(order.id)) ?? order;
}

/**
 * Backstop for buyers who pay but never return to the app: reconcile recent
 * unpaid card orders. Called from the scheduler and after webhooks.
 */
export async function reconcilePendingStripeOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const pending = await db
    .select({ id: outboundOrdersTable.id })
    .from(outboundOrdersTable)
    .where(
      and(
        isNotNull(outboundOrdersTable.stripeSessionId),
        gt(outboundOrdersTable.createdAt, cutoff),
        or(
          // Buyers who paid but never returned to the app.
          eq(outboundOrdersTable.paymentStatus, "unpaid"),
          // Paid orders stranded mid-fulfillment (e.g. a crashed worker).
          and(
            eq(outboundOrdersTable.paymentStatus, "paid"),
            inArray(outboundOrdersTable.status, ["awaiting_payment", "fulfilling"]),
          ),
        ),
      ),
    );
  if (pending.length === 0) return;
  for (const { id } of pending) {
    try {
      await reconcileStripeOrder(id);
    } catch (err) {
      logger.warn({ orderId: id, err }, "Stripe: reconciliación de pedido falló");
    }
  }
}
