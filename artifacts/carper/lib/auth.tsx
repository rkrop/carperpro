import { useAuth as useClerkAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// API helpers (phone OTP flow)
// ---------------------------------------------------------------------------

// Same domain the generated client points at (EXPO_PUBLIC_DOMAIN is the Replit
// dev domain, no scheme). Requests use absolute URLs so the raw fetch here and
// the generated client both reach the api-server.
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

async function postJson<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error ?? "")
        : "") || "Algo salió mal. Inténtalo de nuevo.";
    throw new Error(message);
  }
  return data as T;
}

/** Sends an SMS OTP to the given phone number via the server. */
export async function startPhoneVerification(phone: string): Promise<void> {
  await postJson("/api/auth/phone/start", { phone });
}

interface VerifyResponse {
  token: string;
  userId: string;
  expiresAt: string;
}

/** Checks the OTP; on success returns the opaque session token + phone user id. */
export async function verifyPhoneCode(
  phone: string,
  code: string,
): Promise<VerifyResponse> {
  return postJson<VerifyResponse>("/api/auth/phone/verify", { phone, code });
}

async function serverRevokePhoneSession(token: string): Promise<void> {
  try {
    await postJson("/api/auth/phone/signout", undefined, token);
  } catch {
    // Best-effort: clearing the local token below is what signs the user out.
  }
}

/**
 * Returns true only when the server explicitly rejects the token (401), i.e. it
 * expired or was revoked elsewhere. Network errors return false so we never sign
 * a user out just because they're offline.
 */
async function phoneTokenIsRevoked(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 401;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Phone session storage
// ---------------------------------------------------------------------------

const PHONE_TOKEN_KEY = "carper.phoneSession.token";
const PHONE_USER_KEY = "carper.phoneSession.userId";

interface PhoneAuthContextValue {
  phoneToken: string | null;
  phoneUserId: string | null;
  /** True once the persisted session has been read from secure storage. */
  loaded: boolean;
  setPhoneSession: (token: string, userId: string) => Promise<void>;
  clearPhoneSession: () => Promise<void>;
}

const PhoneAuthContext = createContext<PhoneAuthContextValue | null>(null);

export function PhoneAuthProvider({ children }: { children: React.ReactNode }) {
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneUserId, setPhoneUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [token, userId] = await Promise.all([
          SecureStore.getItemAsync(PHONE_TOKEN_KEY),
          SecureStore.getItemAsync(PHONE_USER_KEY),
        ]);
        if (!active) return;
        // Drop a persisted session the server no longer accepts (expired or
        // revoked elsewhere) so the UI doesn't show a stale signed-in state.
        if (token && (await phoneTokenIsRevoked(token))) {
          await Promise.all([
            SecureStore.deleteItemAsync(PHONE_TOKEN_KEY),
            SecureStore.deleteItemAsync(PHONE_USER_KEY),
          ]);
          if (!active) return;
          setPhoneToken(null);
          setPhoneUserId(null);
        } else {
          setPhoneToken(token);
          setPhoneUserId(userId);
        }
      } catch {
        // ignore — treat as signed-out
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPhoneSession = useCallback(async (token: string, userId: string) => {
    await Promise.all([
      SecureStore.setItemAsync(PHONE_TOKEN_KEY, token),
      SecureStore.setItemAsync(PHONE_USER_KEY, userId),
    ]);
    setPhoneToken(token);
    setPhoneUserId(userId);
  }, []);

  const clearPhoneSession = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(PHONE_TOKEN_KEY),
      SecureStore.deleteItemAsync(PHONE_USER_KEY),
    ]);
    setPhoneToken(null);
    setPhoneUserId(null);
  }, []);

  const value = useMemo<PhoneAuthContextValue>(
    () => ({ phoneToken, phoneUserId, loaded, setPhoneSession, clearPhoneSession }),
    [phoneToken, phoneUserId, loaded, setPhoneSession, clearPhoneSession],
  );

  return (
    <PhoneAuthContext.Provider value={value}>{children}</PhoneAuthContext.Provider>
  );
}

function usePhoneAuthContext(): PhoneAuthContextValue {
  const ctx = useContext(PhoneAuthContext);
  if (!ctx) {
    throw new Error("usePhoneAuth must be used within a PhoneAuthProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Unified auth hook (Clerk email/Google + phone OTP)
// ---------------------------------------------------------------------------

export type AuthMethod = "clerk" | "phone" | null;

export interface UnifiedAuth {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  method: AuthMethod;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Permanently deletes the account and personal data, then clears local auth. */
  deleteAccount: () => Promise<void>;
}

/**
 * Drop-in replacement for `@clerk/expo`'s `useAuth` that merges Clerk sessions
 * (email/Google) with the custom phone OTP session. Clerk takes precedence when
 * both happen to be present. The token getter feeds `setAuthTokenGetter`, so the
 * generated API client attaches whichever bearer token is active.
 */
export function useAuth(): UnifiedAuth {
  const clerk = useClerkAuth();
  const phone = usePhoneAuthContext();

  const clerkSignedIn = clerk.isSignedIn === true;
  const phoneSignedIn = !clerkSignedIn && Boolean(phone.phoneToken);

  const getToken = useCallback(async () => {
    if (clerk.isSignedIn) {
      try {
        return await clerk.getToken();
      } catch {
        return null;
      }
    }
    return phone.phoneToken;
  }, [clerk, phone.phoneToken]);

  const signOut = useCallback(async () => {
    if (clerk.isSignedIn) {
      await clerk.signOut();
    }
    if (phone.phoneToken) {
      await serverRevokePhoneSession(phone.phoneToken);
      await phone.clearPhoneSession();
    }
  }, [clerk, phone]);

  const deleteAccount = useCallback(async () => {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api/me`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok && res.status !== 204) {
      throw new Error("No se pudo eliminar tu cuenta. Inténtalo de nuevo.");
    }
    // The server already removed the account and its sessions; just clear the
    // local auth state so the UI returns to the signed-out (guest) view.
    if (clerk.isSignedIn) {
      try {
        await clerk.signOut();
      } catch {
        // Non-fatal: the account is already gone server-side.
      }
    }
    if (phone.phoneToken) {
      await phone.clearPhoneSession();
    }
  }, [getToken, clerk, phone]);

  return useMemo<UnifiedAuth>(
    () => ({
      isLoaded: clerk.isLoaded && phone.loaded,
      isSignedIn: clerkSignedIn || phoneSignedIn,
      userId: clerkSignedIn ? clerk.userId ?? null : phoneSignedIn ? phone.phoneUserId : null,
      method: clerkSignedIn ? "clerk" : phoneSignedIn ? "phone" : null,
      getToken,
      signOut,
      deleteAccount,
    }),
    [
      clerk.isLoaded,
      clerk.userId,
      clerkSignedIn,
      phone.loaded,
      phone.phoneUserId,
      phoneSignedIn,
      getToken,
      signOut,
      deleteAccount,
    ],
  );
}

/** Exposes the phone-session setter for the OTP UI without the full hook. */
export function usePhoneSession() {
  const { setPhoneSession } = usePhoneAuthContext();
  return { setPhoneSession };
}
