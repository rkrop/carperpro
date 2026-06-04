import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
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

// Structured home-delivery address captured at checkout. Persisted on the order
// so it is never lost (the card/Stripe path used to drop it) and can be sent to
// the ERP (observaciones) and the store's WhatsApp. `mapsUrl` is a ready-to-tap
// Google Maps link built from GPS coordinates (preferred) or the address text,
// so the driver navigates straight to the door.
export interface ShippingAddress {
  calle: string;
  numExterior: string;
  numInterior?: string;
  colonia: string;
  cp: string;
  municipio?: string;
  estado?: string;
  referencias?: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
}

export type OutboundOrderStatus =
  | "pending"
  | "sent"
  | "failed"
  // Card orders awaiting Stripe payment. Excluded from the Admintotal queue
  // (which only picks up "pending") until payment is confirmed.
  | "awaiting_payment"
  // Paid card order being processed (live stock re-check before ERP push).
  // Also excluded from the queue so it is never pushed mid-verification.
  | "fulfilling"
  // Order voided after payment (e.g. sold out during the payment window). The
  // buyer is refunded; never pushed to the ERP.
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

// Queue of app orders to push to Admintotal as pedidos. Retried automatically.
export const outboundOrdersTable = pgTable(
  "outbound_orders",
  {
  id: serial("id").primaryKey(),
  // Owning account (Clerk user id) when the order was placed while signed in.
  // Null for guest/anonymous checkout, which stays fully supported.
  userId: text("user_id"),
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
  // Structured home-delivery address (null for in-store pickup orders).
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
  lines: jsonb("lines").$type<OutboundOrderLine[]>().notNull().default([]),
  total: doublePrecision("total").notNull().default(0),
  // Online card payment (Stripe). Cash/SPEI orders stay "unpaid".
  paymentStatus: text("payment_status")
    .$type<PaymentStatus>()
    .notNull()
    .default("unpaid"),
  stripeSessionId: text("stripe_session_id"),
  // Expo push token of the device that placed the order. Captured at checkout so
  // order-state pushes ("Pago confirmado" / "No pudimos procesar tu pedido")
  // reach the buyer even when they checked out as a guest. Null when the device
  // hadn't registered for push (denied permission, web, etc.).
  pushToken: text("push_token"),
  // Random token issued at checkout for guest orders (userId IS NULL). Required
  // alongside orderId when a caller tries to read back a guest order — prevents
  // enumeration via sequential integer ids.
  guestToken: text("guest_token"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbound_orders_user_id_idx").on(t.userId)],
);

export const insertOutboundOrderSchema = createInsertSchema(
  outboundOrdersTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOutboundOrder = z.infer<typeof insertOutboundOrderSchema>;
export type OutboundOrder = typeof outboundOrdersTable.$inferSelect;
