// Sends a WhatsApp notification to Carper's number whenever a card order is
// confirmed PAID. Best-effort and fire-and-forget: a failure here must never
// block order fulfillment, so callers swallow rejections (we also log them).
//
// Delivery note: without an approved WhatsApp template, Twilio only allows
// free-form business messages inside the 24 h customer-service window (i.e.
// within 24 h of the recipient last messaging the sender). Outside that window
// Twilio returns error 63016 and the message is not delivered. Set
// CARPER_NOTIFY_WHATSAPP_TEMPLATE_SID to an approved Content template SID to
// switch to a template (variable {{1}} carries the full order detail).
import type { OutboundOrder, OutboundOrderLine } from "@workspace/db";
import { logger } from "../logger";
import { getTwilioCredentials, twilioBasicAuth } from "./credentials";

const API_BASE = "https://api.twilio.com/2010-04-01";

// The connector exposes only the API Key SID, so the AC account SID (required in
// the Messages API path) is resolved once via the API and cached in-process.
let cachedAccountSid: string | null = null;

function moneyMx(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function entregaLabel(entrega: string): string {
  return entrega === "tienda" ? "Recoger en tienda" : "Envío a domicilio";
}

function formatLine(line: OutboundOrderLine): string {
  const qty = Math.max(1, Math.round(Number(line.qty) || 1));
  const subtotal = moneyMx((Number(line.price) || 0) * qty);
  const sku = line.sku ? ` (SKU ${line.sku})` : "";
  return `• ${qty} × ${line.name}${sku} — ${subtotal}`;
}

function formatAddress(order: OutboundOrder): string[] {
  const a = order.shippingAddress;
  if (!a) return [];
  const out: string[] = ["", "📍 *Dirección de envío:*"];
  const numInt = a.numInterior ? ` Int. ${a.numInterior}` : "";
  out.push(`${a.calle} ${a.numExterior}${numInt}`.trim());
  out.push(`Col. ${a.colonia}, C.P. ${a.cp}`);
  const cityState = [a.municipio, a.estado].filter(Boolean).join(", ");
  if (cityState) out.push(cityState);
  if (a.referencias) out.push(`Referencias: ${a.referencias}`);
  if (a.mapsUrl) out.push(`Mapa: ${a.mapsUrl}`);
  return out;
}

/** Builds the full Spanish WhatsApp body for a paid order. */
export function buildOrderPaidMessage(order: OutboundOrder): string {
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const fecha = (order.paidAt ?? new Date()).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const parts: string[] = [
    "🟢 *Pedido PAGADO* (Carper Autopartes)",
    "",
    `*Folio:* ${order.folio}`,
    `*Fecha:* ${fecha}`,
    `*Pago:* ${order.pago || "Tarjeta"}`,
    `*Entrega:* ${entregaLabel(order.entrega)}`,
  ];

  if (order.buyerName) parts.push(`*Cliente:* ${order.buyerName}`);
  if (order.buyerPhone) parts.push(`*Teléfono:* ${order.buyerPhone}`);

  parts.push("", "🛒 *Productos:*");
  if (lines.length > 0) {
    for (const line of lines) parts.push(formatLine(line));
  } else {
    parts.push("• (sin detalle de productos)");
  }

  parts.push("", `*Total:* ${moneyMx(Number(order.total) || 0)}`);

  if (order.entrega !== "tienda") {
    parts.push(...formatAddress(order));
  }

  return parts.join("\n");
}

function toWhatsAppAddress(e164: string): string {
  const trimmed = e164.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

async function resolveAccountSid(
  apiKeySid: string,
  apiKeySecret: string,
  hint?: string,
): Promise<string> {
  if (cachedAccountSid) return cachedAccountSid;

  // The connector's `api_key` field occasionally holds the AC account SID.
  if (hint && /^AC[0-9a-fA-F]{32}$/.test(hint)) {
    cachedAccountSid = hint;
    return hint;
  }

  // Otherwise discover the owning account via the API key.
  const r = await fetch(`${API_BASE}/Accounts.json?PageSize=1`, {
    headers: { Authorization: twilioBasicAuth(apiKeySid, apiKeySecret) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    throw new Error(`No se pudo resolver el Account SID de Twilio: ${r.status}`);
  }
  const data = (await r.json()) as { accounts?: { sid?: string }[] };
  const sid = data.accounts?.[0]?.sid;
  if (!sid) throw new Error("No se encontró el Account SID de Twilio.");
  cachedAccountSid = sid;
  return sid;
}

/**
 * Send the paid-order detail to Carper's WhatsApp. Resolves silently on success
 * and rejects on failure (callers fire-and-forget). Returns the Twilio message
 * SID when sent.
 */
export async function sendOrderPaidWhatsApp(
  order: OutboundOrder,
): Promise<string | null> {
  const from = process.env.CARPER_NOTIFY_WHATSAPP_FROM;
  const to = process.env.CARPER_NOTIFY_WHATSAPP_TO;
  if (!from || !to) {
    logger.warn(
      "Notificación WhatsApp omitida: faltan CARPER_NOTIFY_WHATSAPP_FROM/TO.",
    );
    return null;
  }

  const creds = await getTwilioCredentials();
  const accountSid = await resolveAccountSid(
    creds.apiKeySid,
    creds.apiKeySecret,
    creds.accountSidHint,
  );

  const body = new URLSearchParams({
    From: toWhatsAppAddress(from),
    To: toWhatsAppAddress(to),
  });

  const templateSid = process.env.CARPER_NOTIFY_WHATSAPP_TEMPLATE_SID;
  const message = buildOrderPaidMessage(order);
  if (templateSid) {
    // Approved template path: the full detail rides in variable {{1}}.
    body.set("ContentSid", templateSid);
    body.set("ContentVariables", JSON.stringify({ "1": message }));
  } else {
    body.set("Body", message);
  }

  const r = await fetch(`${API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: twilioBasicAuth(creds.apiKeySid, creds.apiKeySecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!r.ok) {
    const detail = (await r.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
    };
    throw new Error(
      `Twilio Messages ${r.status} (code ${detail.code ?? "?"}): ${
        detail.message ?? "envío de WhatsApp falló"
      }`,
    );
  }

  const data = (await r.json()) as { sid?: string };
  return data.sid ?? null;
}

/**
 * Fire-and-forget wrapper: notify Carper that an order was paid. Never throws —
 * a notification failure must not affect order fulfillment.
 */
export function notifyOrderPaid(order: OutboundOrder): void {
  void sendOrderPaidWhatsApp(order)
    .then((sid) => {
      logger.info(
        { folio: order.folio, messageSid: sid },
        "Notificación de pedido pagado enviada por WhatsApp",
      );
    })
    .catch((err) => {
      logger.warn(
        { folio: order.folio, err: err instanceof Error ? err.message : err },
        "No se pudo enviar la notificación de WhatsApp del pedido pagado",
      );
    });
}
