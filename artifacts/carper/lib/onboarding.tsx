import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Persisted flag that records the user has passed through the welcome /
 * onboarding screen at least once. Auth is OPTIONAL app-wide, so the welcome
 * screen is a one-time gate (shown until the user creates an account, signs in,
 * or chooses to explore as a guest) — not a hard auth wall.
 */
export const WELCOME_SEEN_KEY = "carper.welcomeSeen";

interface OnboardingContextValue {
  /** True once the persisted flag has been read from storage. */
  loaded: boolean;
  /** Whether the user has already passed the welcome screen. */
  seen: boolean;
  /** Persists the flag AND flips in-memory state immediately. */
  markSeen: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => {
        if (active) setSeen(v === "1");
      })
      // On a storage read error, treat as seen so we never trap the user.
      .catch(() => {
        if (active) setSeen(true);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const markSeen = useCallback(async () => {
    // Flip in-memory state first so the gate never bounces the user back to the
    // welcome screen in the same session before the async write resolves.
    setSeen(true);
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, "1");
    } catch {
      // Best-effort: a failed write just means the welcome may show next launch.
    }
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({ loaded, seen, markSeen }),
    [loaded, seen, markSeen],
  );

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
