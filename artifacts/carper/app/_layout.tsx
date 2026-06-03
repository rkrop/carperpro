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
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { CartProvider } from "@/context/CartContext";

// Point the generated API client at the api-server. EXPO_PUBLIC_DOMAIN is the
// Replit dev domain (no scheme); requests use relative `/api/...` paths.
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (apiDomain) setBaseUrl(`https://${apiDomain}`);

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
      <Stack.Screen name="resultados" />
      <Stack.Screen name="producto/[id]" />
      <Stack.Screen name="buscar-vehiculo" />
      <Stack.Screen name="carrito" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="confirmacion" />
      <Stack.Screen name="favoritos" />
      <Stack.Screen name="pedidos" />
      <Stack.Screen name="pedido" />
      <Stack.Screen name="notificaciones" />
      <Stack.Screen name="ayuda" />
      <Stack.Screen name="acerca" />
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
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AppProvider>
                <CartProvider>
                  <StatusBar style="dark" />
                  <RootLayoutNav />
                </CartProvider>
              </AppProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
