import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, EmptyState } from "@/components/CarperUI";
import { ProductImage } from "@/components/ProductImage";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

function QtyButton({ icon, onPress, disabled }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
      <Feather name={icon} size={14} color={disabled ? c.neutral300 : c.foreground} />
    </Pressable>
  );
}

export default function Carrito() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { sucursal } = useApp();
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  if (cart.items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ScreenHeader title="Carrito" />
        <EmptyState icon="shopping-cart" title="Carrito vacío" message="Aún no agregas refacciones. Explora el catálogo para comenzar." actionLabel="Ir al Catálogo" onAction={() => router.replace("/(tabs)/categorias")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title={`Carrito · ${cart.count}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
        <View style={{ backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
          {cart.items.map((item) => {
            const atMax = item.stock != null && item.qty >= item.stock;
            return (
              <View key={item.id} style={{ flexDirection: "row", gap: 16, padding: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Pressable onPress={() => router.push(`/producto/${item.id}`)} style={{ width: 80, height: 80, borderWidth: 1, borderColor: c.border }}>
                  <ProductImage image={item.image} categoryId={item.categoryId} style={{ flex: 1 }} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>{item.brand}</Text>
                    <Pressable onPress={() => cart.remove(item.id)} hitSlop={8}>
                      <Feather name="trash-2" size={15} color={c.neutral400} />
                    </Pressable>
                  </View>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 12, textTransform: "uppercase", color: c.foreground, lineHeight: 16, marginTop: 4 }} numberOfLines={2}>{item.name}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <QtyButton icon="minus" onPress={() => cart.setQty(item.id, item.qty - 1)} />
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 14, color: c.foreground, minWidth: 16, textAlign: "center" }}>{item.qty}</Text>
                      <QtyButton icon="plus" onPress={() => cart.setQty(item.id, item.qty + 1)} disabled={atMax} />
                    </View>
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 15, letterSpacing: -0.5, color: c.foreground }}>{formatMXN(item.price * item.qty)}</Text>
                  </View>
                  {atMax ? (
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase", color: c.primary, marginTop: 8 }}>
                      {`Solo quedan ${item.stock} ${item.stock === 1 ? "pieza" : "piezas"}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Pickup note */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 20 }}>
          <Feather name="map-pin" size={16} color={c.primary} />
          <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>
            Disponible para recoger en {sucursal.name}
          </Text>
        </View>
      </ScrollView>

      {/* Summary + CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 24, paddingTop: 20, paddingBottom: bottomPad }}>
        <SummaryRow label="Subtotal" value={formatMXN(cart.base)} />
        <SummaryRow label="IVA (16%)" value={formatMXN(cart.iva)} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 14, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Total</Text>
          <Text style={{ fontFamily: Fonts.monoBold, fontSize: 18, letterSpacing: -0.5, color: c.foreground }}>{formatMXN(cart.total)}</Text>
        </View>
        <AccentButton label="Continuar al Pago" icon="arrow-right" onPress={() => router.push("/checkout")} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: c.foreground }}>{value}</Text>
    </View>
  );
}
