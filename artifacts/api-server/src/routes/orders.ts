import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  outboundOrdersTable,
  sucursalesTable,
  productsTable,
  type OutboundOrderLine,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { pushOrder } from "../lib/admintotal/outbound";
import { effectivePrice } from "../lib/pricing";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function makeFolio(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `APP-${stamp}-${rand}`;
}

router.post("/orders", async (req: Request, res: Response): Promise<void> => {
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

  // Validate the sucursal exists (ERP-backed).
  const suc = await db
    .select({ id: sucursalesTable.id })
    .from(sucursalesTable)
    .where(eq(sucursalesTable.id, input.sucursalId))
    .limit(1);
  if (suc.length === 0) {
    res.status(400).json({ error: "Sucursal no válida" });
    return;
  }

  // Recompute prices from DB — never trust client-supplied economic values.
  const requestedIds = input.lines.map((l) => l.productId);
  const dbProducts = await db
    .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name, price: productsTable.price, costo: productsTable.costo })
    .from(productsTable)
    .where(inArray(productsTable.id, requestedIds));

  const priceMap = new Map(dbProducts.map((p) => [p.id, p]));
  const unknownIds = requestedIds.filter((id) => !priceMap.has(id));
  if (unknownIds.length > 0) {
    res.status(400).json({ error: "Productos no encontrados en catálogo", ids: unknownIds });
    return;
  }

  const lines: OutboundOrderLine[] = input.lines.map((l) => {
    const dbP = priceMap.get(l.productId)!;
    return {
      productId: dbP.id,
      sku: dbP.sku,
      name: dbP.name,
      qty: l.qty,
      price: effectivePrice(dbP), // authoritative ERP-mirrored price (precio venta, else costo)
    };
  });

  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const folio = makeFolio();
  const inserted = await db
    .insert(outboundOrdersTable)
    .values({
      folio,
      status: "pending",
      sucursalId: input.sucursalId,
      entrega: input.entrega,
      pago: input.pago,
      buyerName: input.buyerName ?? null,
      buyerPhone: input.buyerPhone ?? null,
      lines,
      total,
    })
    .returning();
  const order = inserted[0];

  // Attempt an immediate push. If it fails the order stays queued for the
  // scheduler to retry — we ALWAYS confirm to the client so the buyer knows
  // their order is saved and avoids duplicate submissions.
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
