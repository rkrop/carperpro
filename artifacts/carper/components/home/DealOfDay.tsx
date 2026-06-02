import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Fonts } from "@/constants/fonts";
import { Product } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";
import { discountPct } from "@/lib/format";

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs);
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r <= 1000 ? targetMs : r - 1000)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Live "Oferta del día" strip. Kept as its own memoized component so the
 * per-second countdown only re-renders this strip, not the whole (image-heavy)
 * home screen.
 */
function DealOfDayBase({ product }: { product: Product }) {
  const c = useColors();
  const router = useRouter();
  const countdown = useCountdown(4 * 3_600_000 + 12 * 60_000 + 59 * 1000);
  const off = product.originalPrice ? discountPct(product.price, product.originalPrice) : 0;

  return (
    <Pressable
      onPress={() => router.push(`/producto/${product.id}`)}
      style={{ backgroundColor: c.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 24, paddingVertical: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
    >
      <View style={{ flex: 1, paddingRight: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Feather name="zap" size={12} color={c.primary} />
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>Oferta del Día</Text>
        </View>
        <Text style={{ fontFamily: Fonts.black, fontSize: 18, letterSpacing: -0.6, textTransform: "uppercase", color: c.foreground }} numberOfLines={2}>
          {product.name}{off > 0 ? ` -${off}%` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 4 }}>Termina en</Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 15, letterSpacing: -0.5, color: c.foreground }}>{countdown}</Text>
      </View>
    </Pressable>
  );
}

export const DealOfDay = React.memo(DealOfDayBase);
