// Expo push-notification setup for Carper. Requests permission, fetches the
// device's Expo push token, and registers it with the api-server so the backend
// can send order-state ("Pago confirmado" / "No pudimos procesar tu pedido")
// and back-in-stock notifications.
//
// All of this is best-effort: notifications are an enhancement, never a blocker.
// On the web (where remote push isn't supported here) every call is a no-op.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { getAuthToken } from "@workspace/api-client-react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// Show alerts/badges while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

async function authedHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // No auth available: register as a guest device.
  }
  return headers;
}

/**
 * Request permission and return the device's Expo push token (or null when
 * unavailable: web, simulator, denied permission, or no projectId). Cached after
 * the first successful fetch so we don't re-prompt.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;
  if (cachedToken) return cachedToken;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Predeterminado",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    cachedToken = tokenResp.data;
    return cachedToken;
  } catch {
    return null;
  }
}

/** Register the device's push token with the api-server (best-effort). */
export async function registerPushToken(): Promise<void> {
  if (!API_BASE) return;
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/api/push/register`, {
      method: "POST",
      headers: await authedHeaders(),
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {
    // Best-effort: a failed registration just means no push until next launch.
  }
}

/**
 * Subscribe this device to a product's back-in-stock notification. Returns true
 * when the subscription was accepted. Throws on no token so the UI can prompt
 * the user to enable notifications.
 */
export async function subscribeRestock(productId: string): Promise<boolean> {
  if (!API_BASE) return false;
  const token = await getExpoPushToken();
  if (!token) {
    throw new Error(
      "Activa las notificaciones para avisarte cuando vuelva a haber stock.",
    );
  }
  const res = await fetch(
    `${API_BASE}/api/products/${encodeURIComponent(productId)}/restock-subscribe`,
    {
      method: "POST",
      headers: await authedHeaders(),
      body: JSON.stringify({ token }),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo registrar el aviso.");
  }
  return true;
}
