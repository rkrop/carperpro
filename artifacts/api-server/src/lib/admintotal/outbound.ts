import { and, eq, lt } from "drizzle-orm";
import { db, outboundOrdersTable, type OutboundOrder } from "@workspace/db";
import { logger } from "../logger";
import { getAdmintotalClient } from "./client";
import { isAdmintotalConfigured } from "./config";
import { buildAddressObservaciones } from "../shippingAddress";
import { withAdvisoryLock, JOB_LOCK } from "../advisory-lock";

const MAX_ATTEMPTS = 6;

let processing = false;
// In-process dedup: order IDs currently being pushed (prevents queue racing with
// the immediate push that happens right after order insertion).
const pushingIds = new Set<number>();

// Build the Admintotal pedido payload from a queued order. Field names are
// assumptions (documented) until the real ERP payload is confirmed.
function buildPedidoPayload(order: OutboundOrder): Record<string, unknown> {
  return {
    folio: order.folio,
    almacen: order.sucursalId,
    entrega: order.entrega,
    forma_pago: order.pago,
    cliente_nombre: order.buyerName ?? undefined,
    cliente_telefono: order.buyerPhone ?? undefined,
    // Delivery address (+ map link) so the store sees it in Admintotal, for
    // card orders too where there is no WhatsApp hand-off.
    observaciones: order.shippingAddress
      ? buildAddressObservaciones(order.shippingAddress)
      : undefined,
    total: order.total,
    detalles: order.lines.map((l) => ({
      producto: l.productId,
      clave: l.sku,
      descripcion: l.name,
      cantidad: l.qty,
      precio: l.price,
    })),
  };
}

export async function pushOrder(order: OutboundOrder): Promise<void> {
  if (pushingIds.has(order.id)) {
    logger.warn(
      { orderId: order.id },
      "Admintotal: pedido ya en proceso de envío, se omite duplicado",
    );
    return;
  }
  pushingIds.add(order.id);
  const payload = buildPedidoPayload(order);
  try {
    const client = getAdmintotalClient();
    const res = await client.createPedido(payload);
    const pedidoId =
      (res.id != null ? String(res.id) : undefined) ??
      (res.folio != null ? String(res.folio) : undefined) ??
      null;
    await db
      .update(outboundOrdersTable)
      .set({
        status: "sent",
        admintotalPedidoId: pedidoId,
        sentAt: new Date(),
        lastError: null,
        attempts: order.attempts + 1,
      })
      .where(eq(outboundOrdersTable.id, order.id));
    logger.info(
      { orderId: order.id, folio: order.folio, pedidoId },
      "Admintotal: pedido enviado",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const attempts = order.attempts + 1;
    const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await db
      .update(outboundOrdersTable)
      .set({ status, attempts, lastError: msg })
      .where(eq(outboundOrdersTable.id, order.id));
    logger.error(
      { orderId: order.id, attempts, status, err },
      "Admintotal: envío de pedido falló",
    );
    throw err;
  } finally {
    pushingIds.delete(order.id);
  }
}

// Process all pending orders that haven't exhausted their retries.
export async function processOutboundQueue(): Promise<void> {
  if (processing) return;
  if (!isAdmintotalConfigured()) return;
  processing = true;
  try {
    const ran = await withAdvisoryLock(JOB_LOCK.outboundQueue, async () => {
      const pending = await db
        .select()
        .from(outboundOrdersTable)
        .where(
          and(
            eq(outboundOrdersTable.status, "pending"),
            lt(outboundOrdersTable.attempts, MAX_ATTEMPTS),
          ),
        );
      if (pending.length === 0) return;
      logger.info(
        { count: pending.length },
        "Admintotal: procesando cola de pedidos",
      );
      for (const order of pending) {
        try {
          await pushOrder(order);
        } catch {
          // Already recorded on the row; keep processing the rest.
        }
      }
    });
    if (!ran) {
      logger.debug("Admintotal: otra instancia procesa la cola, se omite");
    }
  } finally {
    processing = false;
  }
}

export { MAX_ATTEMPTS };
