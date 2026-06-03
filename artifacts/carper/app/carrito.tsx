import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, EmptyState } from "@/components/CarperUI";
import { ProductImage } from "@/components/ProductImage";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useCart, type StockRefreshResult, type StockUpdates } from "@/context/CartContext";
import { useProductsAvailability } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

function piezas(n: number): string {
  return `${n} ${n === 1 ? "pieza" : "piezas"}`;
}

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

  // Snapshot the cart's product ids the first time it loads (it hydrates from
  // storage asynchronously). A stable list keeps the availability query key and
  // the one-shot refresh below from churning as we clamp/remove lines.
  const [snapshotIds, setSnapshotIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (snapshotIds === null && cart.items.length > 0) {
      setSnapshotIds(cart.items.map((i) => i.id));
    }
  }, [cart.items, snapshotIds]);

  const availability = useProductsAvailability(snapshotIds ?? []);

  // Apply the refreshed stock to the saved cart exactly once, then surface what
  // changed (clamped quantities / removed-out-of-stock lines) to the shopper.
  const appliedRef = useRef(false);
  const [notice, setNotice] = useState<StockRefreshResult | null>(null);
  useEffect(() => {
    if (appliedRef.current || !availability.data) return;
    const updates: StockUpdates = {};
    for (const a of availability.data) updates[a.id] = a.stock;
    const result = cart.refreshStock(updates);
    appliedRef.current = true;
    if (result.clamped.length > 0 || result.removed.length > 0) setNotice(result);
  }, [availability.data, cart]);

  const adjustedIds = useMemo(
    () => new Set((notice?.clamped ?? []).map((cl) => cl.id)),
    [notice],
  );

  if (cart.items.length === 0) {
    const removedNames = notice?.removed.map((r) => r.name) ?? [];
    const cleared = removedNames.length > 0;
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ScreenHeader title="Carrito" />
        <EmptyState
          icon="shopping-cart"
          title={cleared ? "Productos agotados" : "Carrito vacío"}
          message={
            cleared
              ? `Quitamos productos que ya no están disponibles: ${removedNames.join(", ")}. Explora el catálogo para encontrar alternativas.`
              : "Aún no agregas refacciones. Explora el catálogo para comenzar."
          }
          actionLabel="Ir al Catálogo"
          onAction={() => router.replace("/(tabs)/categorias")}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title={`Carrito · ${cart.count}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
        {notice && (notice.clamped.length > 0 || notice.removed.length > 0) ? (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              padding: 16,
              backgroundColor: c.primarySoft,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Feather name="alert-triangle" size={16} color={c.primary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.primary }}>
                Actualizamos tu carrito
              </Text>
              {notice.removed.length > 0 ? (
                <Text style={{ fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17, color: c.foreground }}>
                  {`Quitamos por falta de existencias: ${notice.removed.map((r) => r.name).join(", ")}.`}
                </Text>
              ) : null}
              {notice.clamped.length > 0 ? (
                <Text style={{ fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17, color: c.foreground }}>
                  {`Ajustamos cantidades por disponibilidad: ${notice.clamped
                    .map((cl) => `${cl.name} (${piezas(cl.available)})`)
                    .join(", ")}.`}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={() => setNotice(null)} hitSlop={8}>
              <Feather name="x" size={16} color={c.neutral400} />
            </Pressable>
          </View>
        ) : null}
        <View style={{ backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
          {cart.items.map((item) => {
            const atMax = item.stock != null && item.qty >= item.stock;
            const wasAdjusted = adjustedIds.has(item.id);
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
                  {atMax && item.stock != null ? (
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase", color: c.primary, marginTop: 8 }}>
                      {wasAdjusted
                        ? `Ajustamos la cantidad: solo quedan ${piezas(item.stock)}`
                        : `Solo quedan ${piezas(item.stock)}`}
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
