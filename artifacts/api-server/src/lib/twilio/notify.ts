// Sends an SMS notification to Carper's number whenever a card order is
// confirmed PAID. Best-effort and fire-and-forget: a failure here must never
// block order fulfillment, so callers swallow rejections (we also log them).
//
// SMS is intentionally simpler to operate than WhatsApp: no approved Content
// template and no registered WhatsApp sender are required. The body is plain
// text (no emojis or markdown), since SMS renders asterisks literally and emojis
// force UCS-2 encoding (more billable segments).
//
// Configuration:
//   CARPER_NOTIFY_SMS_TO   — destination number, E.164 (required to send).
//   CARPER_NOTIFY_SMS_FROM — optional sender override; defaults to the Twilio
//                            connection's own phone number when unset.
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
  return `- ${qty} x ${line.name}${sku} — ${subtotal}`;
}

function formatAddress(order: OutboundOrder): string[] {
  const a = order.shippingAddress;
  if (!a) return [];
  const out: string[] = ["", "Dirección de envío:"];
  const numInt = a.numInterior ? ` Int. ${a.numInterior}` : "";
  out.push(`${a.calle} ${a.numExterior}${numInt}`.trim());
  out.push(`Col. ${a.colonia}, C.P. ${a.cp}`);
  const cityState = [a.municipio, a.estado].filter(Boolean).join(", ");
  if (cityState) out.push(cityState);
  if (a.referencias) out.push(`Referencias: ${a.referencias}`);
  if (a.mapsUrl) out.push(`Mapa: ${a.mapsUrl}`);
  return out;
}

/** Builds the full Spanish SMS body for a paid order (plain text). */
export function buildOrderPaidMessage(order: OutboundOrder): string {
  const lines = Array.isArray(order.lines) ? order.lines : [];
  const fecha = (order.paidAt ?? new Date()).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const parts: string[] = [
    "Pedido PAGADO - Carper Autopartes",
    "",
    `Folio: ${order.folio}`,
    `Fecha: ${fecha}`,
    `Pago: ${order.pago || "Tarjeta"}`,
    `Entrega: ${entregaLabel(order.entrega)}`,
  ];

  if (order.buyerName) parts.push(`Cliente: ${order.buyerName}`);
  if (order.buyerPhone) parts.push(`Teléfono: ${order.buyerPhone}`);

  parts.push("", "Productos:");
  if (lines.length > 0) {
    for (const line of lines) parts.push(formatLine(line));
  } else {
    parts.push("- (sin detalle de productos)");
  }

  parts.push("", `Total: ${moneyMx(Number(order.total) || 0)}`);

  if (order.entrega !== "tienda") {
    parts.push(...formatAddress(order));
  }

  return parts.join("\n");
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
 * Send the paid-order detail to Carper's number via SMS. Resolves silently on
 * success and rejects on failure (callers fire-and-forget). Returns the Twilio
 * message SID when sent, or null when notification is not configured.
 */
export async function sendOrderPaidSms(
  order: OutboundOrder,
): Promise<string | null> {
  const to = process.env.CARPER_NOTIFY_SMS_TO;
  if (!to) {
    logger.warn("Notificación SMS omitida: falta CARPER_NOTIFY_SMS_TO.");
    return null;
  }

  const creds = await getTwilioCredentials();

  // From defaults to the Twilio connection's own number when not overridden.
  const from = process.env.CARPER_NOTIFY_SMS_FROM || creds.phoneNumber;
  if (!from) {
    logger.warn(
      "Notificación SMS omitida: no hay remitente (configura CARPER_NOTIFY_SMS_FROM " +
        "o un número en la conexión de Twilio).",
    );
    return null;
  }

  const accountSid = await resolveAccountSid(
    creds.apiKeySid,
    creds.apiKeySecret,
    creds.accountSidHint,
  );

  const body = new URLSearchParams({
    From: from.trim(),
    To: to.trim(),
    Body: buildOrderPaidMessage(order),
  });

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
        detail.message ?? "envío de SMS falló"
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
  void sendOrderPaidSms(order)
    .then((sid) => {
      if (!sid) return; // not configured: a warning was already logged
      logger.info(
        { folio: order.folio, messageSid: sid },
        "Notificación de pedido pagado enviada por SMS",
      );
    })
    .catch((err) => {
      logger.warn(
        { folio: order.folio, err: err instanceof Error ? err.message : err },
        "No se pudo enviar la notificación SMS del pedido pagado",
      );
    });
}
