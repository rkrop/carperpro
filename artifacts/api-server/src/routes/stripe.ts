import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, outboundOrdersTable } from "@workspace/db";
import {
  createCardCheckoutSession,
  reconcileStripeOrder,
  reconcilePendingStripeOrders,
  orderToClient,
  getPublicBaseUrl,
  CheckoutError,
  type CheckoutLineInput,
} from "../lib/stripe/service";
import { normalizeShippingAddress } from "../lib/shippingAddress";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function parseLines(raw: unknown): CheckoutLineInput[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: CheckoutLineInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const productId = (item as Record<string, unknown>).productId;
    const qty = (item as Record<string, unknown>).qty;
    if (typeof productId !== "string" || productId.length === 0) return null;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return null;
    lines.push({ productId, qty });
  }
  return lines;
}

/** Create a Stripe Checkout Session for a card order. */
router.post("/stripe/checkout", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const lines = parseLines(body.lines);
    if (!lines || lines.length === 0) {
      res.status(400).json({ error: "Pedido inválido: faltan productos" });
      return;
    }
    const dest = typeof body.dest === "string" ? body.dest : "";
    if (!dest) {
      res.status(400).json({ error: "Falta la URL de retorno" });
      return;
    }
    const entrega = typeof body.entrega === "string" ? body.entrega : "tienda";
    const shippingAddress = normalizeShippingAddress(body.shippingAddress);
    // Home delivery requires a complete structured address (calle, núm.
    // exterior, colonia, CP de 5 dígitos) — mirrors the cash/SPEI path.
    if (entrega === "envio" && !shippingAddress) {
      res.status(400).json({ error: "La dirección de envío está incompleta o es inválida" });
      return;
    }
    const result = await createCardCheckoutSession({
      sucursalId: typeof body.sucursalId === "string" ? body.sucursalId : undefined,
      entrega,
      buyerName: typeof body.buyerName === "string" ? body.buyerName : null,
      buyerPhone: typeof body.buyerPhone === "string" ? body.buyerPhone : null,
      shippingAddress,
      lines,
      dest,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof CheckoutError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    logger.error({ err }, "Stripe: error en /stripe/checkout");
    res.status(500).json({ error: "No se pudo iniciar el pago" });
  }
});

/**
 * Stripe redirects the browser here (success_url/cancel_url). We 302 to the
 * app's return target (a deep link on native, a web URL on web). Only redirect
 * to first-party destinations to avoid open redirects.
 */
router.get("/stripe/return", (req: Request, res: Response): void => {
  const status = typeof req.query.status === "string" ? req.query.status : "unknown";
  const order = typeof req.query.order === "string" ? req.query.order : "";
  const dest = typeof req.query.dest === "string" ? req.query.dest : "";

  if (!dest || !isAllowedDest(dest)) {
    res
      .status(400)
      .type("html")
      .send("<p>Destino de retorno no válido. Vuelve a la aplicación.</p>");
    return;
  }

  const sep = dest.includes("?") ? "&" : "?";
  const target = `${dest}${sep}status=${encodeURIComponent(status)}&order=${encodeURIComponent(order)}`;
  res.redirect(302, target);
});

// Custom URI schemes the native app is allowed to be returned to. "carper" is
// the app scheme; "exp" is Expo Go during development.
const ALLOWED_APP_SCHEMES = new Set(["carper", "exp"]);

function isAllowedDest(dest: string): boolean {
  const lower = dest.toLowerCase();

  // Native deep links: only first-party app schemes.
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
    const match = /^([a-z][a-z0-9+.-]*):/.exec(lower);
    return match !== null && ALLOWED_APP_SCHEMES.has(match[1]);
  }

  // Web: our own public host, or a first-party Replit-served host (the Expo web
  // app and the api-server can live on different *.replit.dev/.app subdomains).
  try {
    const destHost = new URL(dest).host;
    const ownHost = new URL(getPublicBaseUrl()).host;
    if (destHost === ownHost) return true;
    const bare = destHost.split(":")[0];
    return (
      bare === "localhost" ||
      bare.endsWith(".replit.dev") ||
      bare.endsWith(".replit.app") ||
      bare.endsWith(".repl.co")
    );
  } catch {
    return false;
  }
}

/** Authoritative verify-on-return: confirm payment and return the order. */
router.post("/stripe/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const orderId =
      typeof body.orderId === "number"
        ? body.orderId
        : typeof body.orderId === "string"
          ? Number(body.orderId)
          : NaN;
    if (!Number.isFinite(orderId)) {
      res.status(400).json({ error: "orderId inválido" });
      return;
    }
    const order = await reconcileStripeOrder(orderId);
    if (!order) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    res.json({ paymentStatus: order.paymentStatus, order: orderToClient(order) });
    // Opportunistically reconcile any other stragglers.
    reconcilePendingStripeOrders().catch(() => {});
  } catch (err) {
    logger.error({ err }, "Stripe: error en /stripe/verify");
    res.status(500).json({ error: "No se pudo verificar el pago" });
  }
});

/** Lightweight read of an order's payment status (no Stripe call). */
router.get("/stripe/order/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const rows = await db
    .select()
    .from(outboundOrdersTable)
    .where(eq(outboundOrdersTable.id, id))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  res.json({ paymentStatus: rows[0].paymentStatus, order: orderToClient(rows[0]) });
});

export default router;
