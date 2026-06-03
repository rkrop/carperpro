import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { ProductImage } from "@/components/ProductImage";
import { Fonts } from "@/constants/fonts";
import { Product } from "@/data/catalog";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { discountPct, formatMXN, stockStatus } from "@/lib/format";

/** Full-width product list row (Resultados screen). */
export const ProductRow = React.memo(function ProductRow({ product }: { product: Product }) {
  const c = useColors();
  const router = useRouter();
  const cart = useCart();
  const status = stockStatus(product.stock);
  const agotado = status === "agotado";
  const off = product.originalPrice ? discountPct(product.price, product.originalPrice) : 0;

  return (
    <Pressable
      onPress={() => router.push(`/producto/${product.id}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 16,
        padding: 20,
        backgroundColor: pressed ? c.neutral50 : c.background,
      })}
    >
      <View style={{ width: 96, height: 96, borderWidth: 1, borderColor: c.border, position: "relative" }}>
        <ProductImage image={product.image} categoryId={product.categoryId} style={{ flex: 1 }} />
        {agotado ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              backgroundColor: c.neutral400,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: c.background, fontFamily: Fonts.bold, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>
              Agotado
            </Text>
          </View>
        ) : off > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              backgroundColor: c.primary,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: c.primaryForeground, fontFamily: Fonts.bold, fontSize: 8, letterSpacing: 1 }}>-{off}%</Text>
          </View>
        ) : (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              backgroundColor: c.borderStrong,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: c.background, fontFamily: Fonts.bold, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>
              {status === "consultar"
                ? "Consultar"
                : `${product.stock} pza`}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>
            {product.brand}
          </Text>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground }}>SKU {product.sku}</Text>
        </View>

        <Text
          style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: -0.1, textTransform: "uppercase", color: c.foreground, lineHeight: 16 }}
          numberOfLines={2}
        >
          {product.name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto", paddingTop: 10 }}>
          <View>
            {product.originalPrice ? (
              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.neutral400, textDecorationLine: "line-through" }}>
                {formatMXN(product.originalPrice)}
              </Text>
            ) : null}
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 16, letterSpacing: -0.5, color: c.foreground }}>
              {formatMXN(product.price)}
            </Text>
          </View>
          <Pressable
            disabled={agotado}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              cart.add(product);
            }}
            style={{
              width: 36,
              height: 36,
              borderWidth: 1,
              borderColor: agotado ? c.border : c.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="plus" size={16} color={agotado ? c.neutral300 : c.foreground} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

/** Compact card for horizontal carousels (recently viewed, related). */
export function ProductCardMini({ product }: { product: Product }) {
  const c = useColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/producto/${product.id}`)}
      style={{ width: 150, borderWidth: 1, borderColor: c.border, padding: 12, backgroundColor: c.background }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: c.neutral100, marginBottom: 12 }}>
        <ProductImage image={product.image} categoryId={product.categoryId} style={{ flex: 1 }} />
      </View>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 4 }}>
        SKU {product.sku}
      </Text>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, textTransform: "uppercase", color: c.foreground, lineHeight: 14, marginBottom: 8 }} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: -0.5, color: c.foreground }}>{formatMXN(product.price)}</Text>
    </Pressable>
  );
}
