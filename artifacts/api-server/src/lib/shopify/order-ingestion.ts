// Shopify → Admintotal order ingestion.
//
// Approach: polling via Shopify Admin GraphQL.  Shopify webhooks for order
// events (orders/create, orders/paid) require the `read_orders` scope which
// is NOT provisioned in the v1 Replit-managed Shopify connector.  Until the
// merchant requests that scope, we poll on a schedule (every scheduler tick).
//
// When `read_orders` IS available this function finds paid orders and creates
// the corresponding Admintotal outbound entries so the existing processOutbound-
// Queue() picks them up just like any other sale channel (WhatsApp/Stripe).
//
// When the scope is absent Shopify returns a PERMISSION_DENIED GraphQL error —
// this function catches it, logs a single guidance message, and no-ops.
//
// Idempotency: we track ingested orders by their Shopify order name (#1001,
// etc.) stored in outboundOrders.folio as "SHOPIFY-#1001".  Re-runs skip any
// order whose folio already exists.

import { eq } from "drizzle-orm";
import { db, outboundOrdersTable } from "@workspace/db";
import { logger } from "../logger";
import { shopifyAdminRequest } from "./admin";
import { productHandle } from "./handle";
import crypto from "crypto";

const DEFAULT_SUCURSAL_ID =
  process.env["DEFAULT_SUCURSAL_ID"] ?? process.env["ADMINTOTAL_DEFAULT_SUCURSAL"] ?? "1";

const SHOPIFY_FOLIO_PREFIX = "SHOPIFY-";

type ShopifyOrdersResponse = {
  orders: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string;
        customer: { displayName: string; phone: string | null; email: string | null } | null;
        lineItems: {
          edges: Array<{
            node: {
              quantity: number;
              originalUnitPriceSet: { shopMoney: { amount: string } };
              variant: { sku: string | null } | null;
              title: string;
            };
          }>;
        };
        currentTotalPriceSet: { shopMoney: { amount: string } };
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

const ORDERS_QUERY = `
  query ($cursor: String) {
    orders(first: 50, after: $cursor, query: "financial_status:paid") {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          customer { displayName phone email }
          lineItems(first: 250) {
            edges {
              node {
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                variant { sku }
                title
              }
            }
          }
          currentTotalPriceSet { shopMoney { amount } }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

let lastIngestionLoggedPermissionError = false;

export async function ingestShopifyOrders(): Promise<{
  ingested: number;
  skipped: number;
  permissionDenied: boolean;
}> {
  try {
    let cursor: string | null = null;
    let ingested = 0;
    let skipped = 0;

    do {
      const resp: import("./admin").AdminGraphQLResponse<ShopifyOrdersResponse> =
        await shopifyAdminRequest<ShopifyOrdersResponse>(
          ORDERS_QUERY,
          cursor ? { cursor } : {},
        );

      const { edges, pageInfo } = resp.data.orders;
      for (const edge of edges) {
        const order = edge.node;
        const folio = `${SHOPIFY_FOLIO_PREFIX}${order.name}`;

        // Skip already-ingested orders
        const existing = await db
          .select({ id: outboundOrdersTable.id })
          .from(outboundOrdersTable)
          .where(eq(outboundOrdersTable.folio, folio))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Build line items from Shopify lineItems
        const lines = order.lineItems.edges.map(({ node: item }) => {
          const sku = item.variant?.sku ?? item.title;
          return {
            productId: sku,
            sku,
            name: item.title,
            qty: item.quantity,
            price: parseFloat(item.originalUnitPriceSet.shopMoney.amount),
          };
        });

        const total = parseFloat(order.currentTotalPriceSet.shopMoney.amount);
        const buyerName = order.customer?.displayName ?? "Cliente Shopify";
        const buyerPhone = order.customer?.phone ?? "";

        await db.insert(outboundOrdersTable).values({
          folio,
          status: "pending",
          sucursalId: DEFAULT_SUCURSAL_ID,
          entrega: "envio",
          pago: "shopify",
          buyerName,
          buyerPhone,
          lines,
          total,
          paymentStatus: "paid",
          paidAt: new Date(order.createdAt),
          guestToken: crypto.randomBytes(16).toString("hex"),
        });

        ingested++;
        logger.info({ folio, total, lines: lines.length }, "Shopify: orden ingresada");
      }

      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (cursor);

    if (lastIngestionLoggedPermissionError) {
      lastIngestionLoggedPermissionError = false;
      logger.info("Shopify order ingestion: permiso read_orders ahora disponible");
    }
    return { ingested, skipped, permissionDenied: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Shopify returns PERMISSION_DENIED when read_orders scope is missing.
    // This is expected in v1 of the connector — log once and no-op.
    if (
      msg.includes("PERMISSION_DENIED") ||
      msg.includes("read_orders") ||
      msg.includes("Access denied")
    ) {
      if (!lastIngestionLoggedPermissionError) {
        lastIngestionLoggedPermissionError = true;
        logger.warn(
          "Shopify order ingestion: scope read_orders no disponible en el conector v1. " +
            "Para ingesta automática de órdenes Shopify→Admintotal, solicite el scope " +
            "read_orders en Integraciones → Shopify → Gestionar.",
        );
      }
      return { ingested: 0, skipped: 0, permissionDenied: true };
    }

    logger.error({ err }, "Shopify order ingestion: error inesperado");
    return { ingested: 0, skipped: 0, permissionDenied: false };
  }
}
