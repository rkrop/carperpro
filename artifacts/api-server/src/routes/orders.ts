import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  outboundOrdersTable,
  sucursalesTable,
  type OutboundOrderLine,
} from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { pushOrder } from "../lib/admintotal/outbound";

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

  const lines: OutboundOrderLine[] = input.lines.map((l) => ({
    productId: l.productId,
    sku: l.sku,
    name: l.name,
    qty: l.qty,
    price: l.price,
  }));

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
      total: input.total,
    })
    .returning();
  const order = inserted[0];

  // Attempt an immediate push. Fail loudly — the order is persisted and the
  // scheduler will retry, but the client must show an error so the buyer knows.
  try {
    await pushOrder(order);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      error: "No se pudo enviar el pedido al ERP. Intenta de nuevo en unos momentos.",
      details: msg,
      folio: order.folio,
      id: order.id,
    });
    return;
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
