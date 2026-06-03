import { Feather } from "@expo/vector-icons";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, Hairline, OutlineButton, SectionLabel } from "@/components/CarperUI";
import { Fonts, isWeb, TAB_BAR_HEIGHT, WEB_TOP_INSET } from "@/constants/fonts";
import { useApp, type OrderLine } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

function Row({ icon, label, value, onPress, tint }: { icon: keyof typeof Feather.glyphMap; label: string; value?: string; onPress?: () => void; tint?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
    >
      <Feather name={icon} size={18} color={tint ?? c.foreground} />
      <Text style={{ flex: 1, fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: tint ?? c.foreground }}>{label}</Text>
      {value ? <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.mutedForeground }}>{value}</Text> : null}
      <Feather name="chevron-right" size={16} color={c.neutral400} />
    </Pressable>
  );
}

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || "").trim();
  if (!source) return "MX";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Cuenta() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favorites, orders, sucursal } = useApp();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const cart = useCart();
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 16;

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Mi cuenta";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const reorder = (lines: OrderLine[]) => {
    lines.forEach((l) => cart.add({ id: l.id, sku: l.sku, name: l.name, brand: "", price: l.price, image: null, categoryId: null, stock: null }, l.qty));
    router.push("/carrito");
  };

  const confirmSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Quieres cerrar tu sesión en este dispositivo?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <View style={{ paddingTop: topPad, paddingBottom: 20, paddingHorizontal: 24, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>
          {isSignedIn ? "Bienvenido" : "Carper Autopartes"}
        </Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 32, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground }}>Mi Cuenta</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        {isSignedIn ? (
          /* Signed-in profile */
          <View style={{ backgroundColor: c.background, padding: 24, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ width: 56, height: 56, backgroundColor: c.foreground, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: Fonts.black, fontSize: 20, color: c.background }}>{initialsFor(user?.fullName, email)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }} numberOfLines={1}>{displayName}</Text>
              {email ? <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.mutedForeground, marginTop: 3 }} numberOfLines={1}>{email}</Text> : null}
            </View>
          </View>
        ) : (
          /* Guest CTA */
          <View style={{ backgroundColor: c.background, padding: 24, borderBottomWidth: 1, borderBottomColor: c.border, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 56, height: 56, borderWidth: 1, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" }}>
                <Feather name="user" size={24} color={c.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Invitado</Text>
                <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: c.mutedForeground, marginTop: 3 }}>
                  Inicia sesión para guardar favoritos, direcciones y pedidos en todos tus dispositivos.
                </Text>
              </View>
            </View>
            <AccentButton label="Iniciar sesión" icon="log-in" onPress={() => router.push("/(auth)/sign-in")} />
            <OutlineButton label="Crear cuenta" onPress={() => router.push("/(auth)/sign-up")} />
          </View>
        )}

        {/* Quick links */}
        <View style={{ marginTop: 24 }}>
          <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12 }}>Mi Actividad</SectionLabel>
          <Hairline />
          <Row icon="heart" label="Favoritos" value={`${favorites.length}`} onPress={() => router.push("/favoritos")} />
          {isSignedIn ? <Row icon="map-pin" label="Mis direcciones" onPress={() => router.push("/direcciones")} /> : null}
          <Row icon="package" label="Mis pedidos" value={`${orders.length}`} onPress={() => router.push("/pedidos")} />
          <Row icon="home" label="Nuestra tienda" value={sucursal.name} onPress={() => router.push("/sucursal")} />
        </View>

        {/* Order history */}
        {orders.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12 }}>Historial de Pedidos</SectionLabel>
            <View style={{ borderTopWidth: 1, borderColor: c.border }}>
              {orders.slice(0, 5).map((o) => {
                const firstName = o.lines[0]?.name;
                return (
                  <View key={o.id} style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{o.folio}</Text>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: c.foreground }}>{formatMXN(o.total)}</Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }} numberOfLines={1}>
                      {o.date} · {o.lines.length} {o.lines.length === 1 ? "artículo" : "artículos"}
                      {firstName ? ` · ${firstName}` : ""}
                    </Text>
                    <Pressable
                      onPress={() => reorder(o.lines)}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 12, borderWidth: 1, borderColor: c.primary, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? c.neutral50 : c.background })}
                    >
                      <Feather name="rotate-ccw" size={13} color={c.primary} />
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>Volver a pedir</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Settings */}
        <View style={{ marginTop: 24 }}>
          <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12 }}>Ajustes</SectionLabel>
          <Hairline />
          <Row icon="bell" label="Notificaciones" onPress={() => router.push("/notificaciones")} />
          <Row icon="help-circle" label="Ayuda y soporte" onPress={() => router.push("/ayuda")} />
          <Row icon="info" label="Acerca de Carper" value="v1.0.0" onPress={() => router.push("/acerca")} />
          {isSignedIn ? <Row icon="log-out" label="Cerrar sesión" tint={c.destructive} onPress={confirmSignOut} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
