import { and, eq, lt } from "drizzle-orm";
import { db, outboundOrdersTable, type OutboundOrder } from "@workspace/db";
import { logger } from "../logger";
import { AdmintotalClient } from "./client";
import { isAdmintotalConfigured } from "./config";

const MAX_ATTEMPTS = 6;

let processing = false;

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
  const client = new AdmintotalClient();
  const payload = buildPedidoPayload(order);
  try {
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
  }
}

// Process all pending orders that haven't exhausted their retries.
export async function processOutboundQueue(): Promise<void> {
  if (processing) return;
  if (!isAdmintotalConfigured()) return;
  processing = true;
  try {
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
    logger.info({ count: pending.length }, "Admintotal: procesando cola de pedidos");
    for (const order of pending) {
      try {
        await pushOrder(order);
      } catch {
        // Already recorded on the row; keep processing the rest.
      }
    }
  } finally {
    processing = false;
  }
}

export { MAX_ATTEMPTS };
