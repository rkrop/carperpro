import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface OutboundOrderLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  price: number;
}

export type OutboundOrderStatus = "pending" | "sent" | "failed";

// Queue of app orders to push to Admintotal as pedidos. Retried automatically.
export const outboundOrdersTable = pgTable("outbound_orders", {
  id: serial("id").primaryKey(),
  folio: text("folio").notNull(),
  status: text("status").$type<OutboundOrderStatus>().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  admintotalPedidoId: text("admintotal_pedido_id"),
  sucursalId: text("sucursal_id").notNull(),
  entrega: text("entrega").notNull().default("tienda"),
  pago: text("pago").notNull().default(""),
  buyerName: text("buyer_name"),
  buyerPhone: text("buyer_phone"),
  lines: jsonb("lines").$type<OutboundOrderLine[]>().notNull().default([]),
  total: doublePrecision("total").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const insertOutboundOrderSchema = createInsertSchema(
  outboundOrdersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOutboundOrder = z.infer<typeof insertOutboundOrderSchema>;
export type OutboundOrder = typeof outboundOrdersTable.$inferSelect;
