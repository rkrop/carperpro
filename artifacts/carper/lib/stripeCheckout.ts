import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { getAuthToken } from "@workspace/api-client-react";
import { getExpoPushToken } from "./push";

// API base for the deployed api-server.
const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");

export interface CheckoutLine {
  productId: string;
  qty: number;
}

export interface ShippingAddressInput {
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
  /** Random token for guest orders — required to read the order back. */
  guestToken: string | null;
}

const GUEST_TOKEN_STORAGE_KEY = "carper_stripe_guest_token";

function apiUrl(path: string): string {
  if (!API_BASE) {
    throw new Error("No se pudo determinar el servidor de pago.");
  }
  return `${API_BASE}${path}`;
}

/**
 * Build request headers, attaching the Clerk bearer token when a signed-in
 * session exists so the Stripe routes can tie the order to the user. Guests
 * send no token and the order stays anonymous.
 */
async function authedJsonHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
  shippingAddress?: ShippingAddressInput | null;
  lines: CheckoutLine[];
}): Promise<{ orderId: number; folio: string; guestToken: string | null; mode: "native" | "web-redirect" }> {
  const isWeb = Platform.OS === "web";

  // Native returns to the app via deep link; web returns to the checkout page.
  const dest = isWeb
    ? `${window.location.origin}${window.location.pathname}`
    : Linking.createURL("stripe-return");

  // Attach the device's push token so "Pago confirmado" / "No pudimos procesar"
  // push reaches this device — works for guests too (no account needed).
  const pushToken = await getExpoPushToken();

  const res = await fetch(apiUrl("/api/stripe/checkout"), {
    method: "POST",
    headers: await authedJsonHeaders(),
    body: JSON.stringify({
      entrega: opts.entrega,
      buyerName: opts.buyerName,
      buyerPhone: opts.buyerPhone,
      shippingAddress: opts.shippingAddress ?? null,
      lines: opts.lines,
      dest,
      pushToken,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo iniciar el pago con tarjeta.");
  }

  const data = (await res.json()) as CheckoutResponse;
  const guestToken = data.guestToken ?? null;

  if (isWeb) {
    // Persist which order and guest token we're paying so the page can verify
    // on return. Both are needed to authenticate the guest order lookup.
    try {
      window.sessionStorage.setItem("carper_stripe_order", String(data.orderId));
      if (guestToken) {
        window.sessionStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestToken);
      } else {
        window.sessionStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
      }
    } catch {
      // sessionStorage may be unavailable; verify-on-return query param covers it.
    }
    window.location.href = data.url;
    return { orderId: data.orderId, folio: data.folio, guestToken, mode: "web-redirect" };
  }

  // Native: open Stripe in a browser session that closes on the deep-link return.
  await WebBrowser.openAuthSessionAsync(data.url, dest);
  return { orderId: data.orderId, folio: data.folio, guestToken, mode: "native" };
}

/**
 * Authoritative payment check. Returns the order with its payment status.
 * `guestToken` must be provided for guest (unauthenticated) orders.
 */
export async function verifyPayment(
  orderId: number,
  guestToken: string | null,
): Promise<VerifiedOrder | null> {
  const res = await fetch(apiUrl("/api/stripe/verify"), {
    method: "POST",
    headers: await authedJsonHeaders(),
    body: JSON.stringify({ orderId, guestToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { paymentStatus: string; order: VerifiedOrder };
  return data.order ?? null;
}

/**
 * Read the guest token saved during checkout for web-return verification.
 * Clears it from storage after reading (one-time use).
 */
export function consumeStoredGuestToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
    return token;
  } catch {
    return null;
  }
}
