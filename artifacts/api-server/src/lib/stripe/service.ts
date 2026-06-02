import { eq, inArray, and, isNotNull, gt } from "drizzle-orm";
import {
  db,
  outboundOrdersTable,
  sucursalesTable,
  productsTable,
  type OutboundOrder,
  type OutboundOrderLine,
} from "@workspace/db";
import { getUncachableStripeClient } from "./client";
import { getWebhookSucursalId } from "../admintotal/config";
import { pushOrder } from "../admintotal/outbound";
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

async function loadOrder(orderId: number): Promise<OutboundOrder | null> {
  const rows = await db
    .select()
    .from(outboundOrdersTable)
    .where(eq(outboundOrdersTable.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Authoritative payment check: retrieves the Checkout Session from Stripe and,
 * if paid, marks the order paid + queues it for Admintotal (immediate push).
 * Idempotent.
 */
export async function reconcileStripeOrder(
  orderId: number,
): Promise<OutboundOrder | null> {
  const order = await loadOrder(orderId);
  if (!order) return null;
  if (order.paymentStatus === "paid") return order;
  if (!order.stripeSessionId) return order;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

  if (session.payment_status === "paid") {
    // Conditional transition — only the call that flips unpaid→paid gets a row
    // back, so exactly one caller (verify / scheduler / webhook) pushes to the
    // ERP. Concurrent reconciles see zero rows and skip the duplicate push.
    const transitioned = await db
      .update(outboundOrdersTable)
      .set({ paymentStatus: "paid", paidAt: new Date(), status: "pending" })
      .where(
        and(
          eq(outboundOrdersTable.id, order.id),
          eq(outboundOrdersTable.paymentStatus, "unpaid"),
        ),
      )
      .returning({ id: outboundOrdersTable.id });

    const fresh = (await loadOrder(order.id)) ?? order;
    if (transitioned.length > 0) {
      // We performed the transition — push to Admintotal immediately; the
      // scheduler retries on failure.
      pushOrder(fresh).catch((err) =>
        logger.warn(
          { orderId: fresh.id, err },
          "Admintotal: push de pedido pagado falló, queda en cola",
        ),
      );
    }
    return fresh;
  }

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

  return order;
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
        eq(outboundOrdersTable.paymentStatus, "unpaid"),
        isNotNull(outboundOrdersTable.stripeSessionId),
        gt(outboundOrdersTable.createdAt, cutoff),
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
