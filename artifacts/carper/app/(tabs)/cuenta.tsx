import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Hairline, SectionLabel } from "@/components/CarperUI";
import { Fonts, isWeb, TAB_BAR_HEIGHT, WEB_TOP_INSET } from "@/constants/fonts";
import { getProduct } from "@/data/catalog";
import { useApp, vehicleLabel, vehicleSub } from "@/context/AppContext";
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

export default function Cuenta() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vehicle, favorites, orders, sucursal } = useApp();
  const cart = useCart();
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 16;

  const reorder = (lines: { id: string; qty: number }[]) => {
    lines.forEach((l) => cart.add(l.id, l.qty));
    router.push("/carrito");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <View style={{ paddingTop: topPad, paddingBottom: 20, paddingHorizontal: 24, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>Bienvenido</Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 32, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground }}>Mi Cuenta</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        {/* Profile */}
        <View style={{ backgroundColor: c.background, padding: 24, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ width: 56, height: 56, backgroundColor: c.foreground, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: Fonts.black, fontSize: 20, color: c.background }}>TM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Taller Mecánico</Text>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.mutedForeground, marginTop: 3 }}>cliente@carper.mx</Text>
          </View>
        </View>

        {/* Vehicle */}
        <View style={{ marginTop: 12 }}>
          <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12, marginTop: 12 }}>Mi Vehículo</SectionLabel>
          <Pressable
            onPress={() => router.push("/buscar-vehiculo")}
            style={({ pressed }) => ({ backgroundColor: pressed ? c.neutral50 : c.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 24, paddingVertical: 18, flexDirection: "row", alignItems: "center", gap: 16 })}
          >
            <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Feather name="truck" size={18} color={c.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>{vehicleLabel(vehicle)}</Text>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, textTransform: "uppercase", color: c.mutedForeground, marginTop: 2 }}>{vehicleSub(vehicle)}</Text>
            </View>
            <Feather name="edit-2" size={15} color={c.neutral400} />
          </Pressable>
        </View>

        {/* Quick links */}
        <View style={{ marginTop: 24 }}>
          <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12 }}>Mi Actividad</SectionLabel>
          <Hairline />
          <Row icon="heart" label="Favoritos" value={`${favorites.length}`} onPress={() => router.push("/favoritos")} />
          <Row icon="map-pin" label="Sucursal preferida" value={sucursal.name.replace("Sucursal ", "")} onPress={() => router.push("/sucursal")} />
          <Row icon="package" label="Mis pedidos" value={`${orders.length}`} />
        </View>

        {/* Order history */}
        {orders.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 12 }}>Historial de Pedidos</SectionLabel>
            <View style={{ borderTopWidth: 1, borderColor: c.border }}>
              {orders.slice(0, 5).map((o) => {
                const first = getProduct(o.lines[0]?.id);
                return (
                  <View key={o.id} style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{o.folio}</Text>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: c.foreground }}>{formatMXN(o.total)}</Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }} numberOfLines={1}>
                      {o.date} · {o.lines.length} {o.lines.length === 1 ? "artículo" : "artículos"}
                      {first ? ` · ${first.name}` : ""}
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
          <Row icon="bell" label="Notificaciones" />
          <Row icon="help-circle" label="Ayuda y soporte" />
          <Row icon="info" label="Acerca de Carper" value="v1.0.0" />
          <Row icon="log-out" label="Cerrar sesión" tint={c.destructive} />
        </View>
      </ScrollView>
    </View>
  );
}
