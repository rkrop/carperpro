import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

// API base — same domain the generated client points at (EXPO_PUBLIC_DOMAIN is
// the api-server's public host in dev/prod).
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

export interface CheckoutLine {
  productId: string;
  qty: number;
}

export interface VerifiedOrder {
  id: number;
  folio: string;
  total: number;
  entrega: string;
  pago: string;
  status: string;
  paymentStatus: string;
  lines: { id: string; name: string; sku: string; qty: number; price: number }[];
}

interface CheckoutResponse {
  url: string;
  orderId: number;
  folio: string;
}

function apiUrl(path: string): string {
  if (!API_BASE) {
    throw new Error("No se pudo determinar el servidor de pago.");
  }
  return `${API_BASE}${path}`;
}

/**
 * Start a Stripe Checkout for the given lines.
 * - Native: opens the Stripe page in an auth session that returns to the app
 *   deep link, then resolves so the caller can verify.
 * - Web: returns the checkout URL so the caller can do a full-page redirect
 *   (the browser navigates away; verification happens on return).
 */
export async function startCardCheckout(opts: {
  entrega: string;
  buyerName: string;
  buyerPhone: string;
  lines: CheckoutLine[];
}): Promise<{ orderId: number; folio: string; mode: "native" | "web-redirect" }> {
  const isWeb = Platform.OS === "web";

  // Native returns to the app via deep link; web returns to the checkout page.
  const dest = isWeb
    ? `${window.location.origin}${window.location.pathname}`
    : Linking.createURL("stripe-return");

  const res = await fetch(apiUrl("/api/stripe/checkout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entrega: opts.entrega,
      buyerName: opts.buyerName,
      buyerPhone: opts.buyerPhone,
      lines: opts.lines,
      dest,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo iniciar el pago con tarjeta.");
  }

  const data = (await res.json()) as CheckoutResponse;

  if (isWeb) {
    // Persist which order we're paying so the page can verify on return.
    try {
      window.sessionStorage.setItem("carper_stripe_order", String(data.orderId));
    } catch {
      // sessionStorage may be unavailable; verify-on-return query param covers it.
    }
    window.location.href = data.url;
    return { orderId: data.orderId, folio: data.folio, mode: "web-redirect" };
  }

  // Native: open Stripe in a browser session that closes on the deep-link return.
  await WebBrowser.openAuthSessionAsync(data.url, dest);
  return { orderId: data.orderId, folio: data.folio, mode: "native" };
}

/** Authoritative payment check. Returns the order with its payment status. */
export async function verifyPayment(orderId: number): Promise<VerifiedOrder | null> {
  const res = await fetch(apiUrl("/api/stripe/verify"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { paymentStatus: string; order: VerifiedOrder };
  return data.order ?? null;
}
