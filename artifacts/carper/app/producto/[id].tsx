import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, EmptyState, Hairline } from "@/components/CarperUI";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { ProductImage } from "@/components/ProductImage";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { getProduct } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { discountPct, formatMXN, stockStatus } from "@/lib/format";

export default function Producto() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const cart = useCart();
  const { addRecent, toggleFavorite, isFavorite } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (product) addRecent(product.id);
  }, [product?.id]);

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ScreenHeader title="Detalle" />
        <EmptyState icon="alert-circle" title="No encontrado" message="Esta refacción no está disponible." actionLabel="Volver" onAction={() => router.back()} />
      </View>
    );
  }

  const status = stockStatus(product.stock);
  const agotado = status === "agotado";
  const fav = isFavorite(product.id);
  const off = product.originalPrice ? discountPct(product.price, product.originalPrice) : 0;
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  const onAdd = () => {
    cart.add(product.id);
    setAdded(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const statusColor = status === "alto" ? c.success : status === "bajo" ? c.primary : c.neutral400;
  const statusLabel = status === "alto" ? "En existencia" : status === "bajo" ? "Últimas piezas" : "Agotado";

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader
        title="Detalle de Refacción"
        action={{ icon: "heart", onPress: () => toggleFavorite(product.id), tint: fav ? c.primary : c.foreground }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Full-bleed image */}
        <View style={{ width: "100%", aspectRatio: 1, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, position: "relative" }}>
          <ProductImage image={product.image} categoryId={product.categoryId} style={{ flex: 1 }} pad={40} iconSize={64} />
          <View style={{ position: "absolute", bottom: 16, left: 16, backgroundColor: c.foreground, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: c.background, fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{product.brand}</Text>
          </View>
          {off > 0 ? (
            <View style={{ position: "absolute", top: 16, right: 16, backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: c.primaryForeground, fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5 }}>-{off}%</Text>
            </View>
          ) : null}
        </View>

        {/* Meta */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View style={{ backgroundColor: c.neutral100, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>SKU {product.sku}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={{ fontFamily: Fonts.black, fontSize: 26, lineHeight: 28, letterSpacing: -1, textTransform: "uppercase", color: c.foreground, marginBottom: 24 }}>
            {product.name}
          </Text>

          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 6 }}>Precio Unitario</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 36, letterSpacing: -2, color: c.foreground }}>{formatMXN(product.price)}</Text>
            {product.originalPrice ? (
              <Text style={{ fontFamily: Fonts.mono, fontSize: 15, color: c.neutral400, textDecorationLine: "line-through" }}>{formatMXN(product.originalPrice)}</Text>
            ) : null}
          </View>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground, marginTop: 6 }}>IVA incluido</Text>
        </View>

        {/* Compatibility */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: c.border, gap: 16 }}>
          {product.compatible ? (
            <CompatibilityBadge vehicle="Nissan Tsuru 1.6 1992" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 14 }}>
              <Feather name="alert-triangle" size={16} color={c.neutral400} />
              <Text style={{ flex: 1, fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>
                Verifica compatibilidad con tu vehículo
              </Text>
            </View>
          )}

          <Pressable onPress={() => setShowAll((v) => !v)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground }}>
              Ver {product.vehicles.length} vehículos compatibles
            </Text>
            <Feather name={showAll ? "chevron-up" : "chevron-down"} size={16} color={c.neutral400} />
          </Pressable>

          {showAll
            ? product.vehicles.map((v) => (
                <View key={v} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Feather name="check" size={12} color={c.neutral400} />
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 12, textTransform: "uppercase", color: c.mutedForeground }}>{v}</Text>
                </View>
              ))
            : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="info" size={14} color={c.neutral400} />
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground, textDecorationLine: "underline" }}>
              Confirmar con un asesor
            </Text>
          </View>
        </View>

        {/* Specs */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 28 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 16 }}>Especificaciones Técnicas</Text>
          <Hairline />
          {product.specs.map((s) => (
            <View key={s.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground }}>{s.label}</Text>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, textTransform: "uppercase", color: c.mutedForeground }}>{s.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, padding: 20, paddingBottom: bottomPad }}>
        {added ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, height: 56, borderWidth: 1, borderColor: c.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
              <Feather name="check" size={16} color={c.success} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.success }}>Agregado</Text>
            </View>
            <View style={{ flex: 1 }}>
              <AccentButton label="Ver Carrito" icon="shopping-cart" onPress={() => router.push("/carrito")} />
            </View>
          </View>
        ) : (
          <AccentButton label={agotado ? "Agotado" : "Agregar al Carrito"} icon="shopping-cart" onPress={onAdd} disabled={agotado} />
        )}
      </View>
    </View>
  );
}
