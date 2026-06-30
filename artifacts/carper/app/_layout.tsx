import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PhoneAuthProvider, useAuth } from "@/lib/auth";
import { OnboardingProvider, useOnboarding } from "@/lib/onboarding";
import { registerPushToken } from "@/lib/push";
import { AppProvider } from "@/context/AppContext";
import { CartProvider } from "@/context/CartContext";

// Point the generated API client at the api-server. Native builds use an
// explicit full URL so the backend can live on Render, a custom domain, or localhost.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (apiUrl) setBaseUrl(apiUrl.replace(/\/+$/, ""));

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

// Bridge Clerk's session token into the shared API client. Login is OPTIONAL
// app-wide: the getter returns the bearer token when signed in and null
// otherwise, so guest requests (catalog, guest checkout) keep working while
// signed-in requests reach the /me account endpoints.
function ApiAuthBridge() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  // Register the device's push token on launch and whenever auth changes, so the
  // backend can reach this device (and link it to the account once signed in)
  // for order-state and back-in-stock notifications. Best-effort.
  useEffect(() => {
    void registerPushToken();
  }, [isSignedIn]);
  return null;
}

// One-time welcome/onboarding gate. Login is OPTIONAL, so this is NOT a hard
// auth wall: on first launch (flag unset) an un-signed-in user is sent to the
// welcome screen, which sells the app and offers create-account / sign-in /
// explore-as-guest. Any of those marks the flag so the gate never fires again.
function OnboardingGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const { loaded, seen } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loaded || !isLoaded) return;
    const top = segments[0];
    const inWelcome = top === "bienvenida";
    const inAuth = top === "(auth)";
    if (!seen && !isSignedIn && !inWelcome && !inAuth) {
      router.replace("/bienvenida");
    }
  }, [loaded, seen, isLoaded, isSignedIn, segments, router]);

  return null;
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Sensible global caching so navigating back to a screen shows data instantly
// from cache while it refreshes in the background. Stock-sensitive queries
// (e.g. cart availability) opt out by overriding staleTime/gcTime per-query.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min: catalog data is fresh enough to reuse
      gcTime: 10 * 60_000, // keep cached pages around for 10 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="bienvenida" options={{ animation: "fade" }} />
      <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
      <Stack.Screen name="direcciones" />
      <Stack.Screen name="subcategorias" />
      <Stack.Screen name="resultados" />
      <Stack.Screen name="producto/[id]" />
      <Stack.Screen name="buscar-vehiculo" />
      <Stack.Screen name="asistente" />
      <Stack.Screen name="carrito" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="confirmacion" />
      <Stack.Screen name="favoritos" />
      <Stack.Screen name="pedidos" />
      <Stack.Screen name="pedido" />
      <Stack.Screen name="notificaciones" />
      <Stack.Screen name="ayuda" />
      <Stack.Screen name="acerca" />
      <Stack.Screen name="politicas" />
      <Stack.Screen name="escanear" options={{ presentation: "modal" }} />
      <Stack.Screen name="sucursal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <ClerkLoaded>
        <PhoneAuthProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <OnboardingProvider>
                    <ApiAuthBridge />
                    <OnboardingGate />
                    <AppProvider>
                      <CartProvider>
                        <StatusBar style="dark" />
                        <RootLayoutNav />
                      </CartProvider>
                    </AppProvider>
                  </OnboardingProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
        </PhoneAuthProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
