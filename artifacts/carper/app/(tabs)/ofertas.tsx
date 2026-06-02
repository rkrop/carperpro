import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/CarperUI";
import { ProductImage } from "@/components/ProductImage";
import { Fonts, isWeb, TAB_BAR_HEIGHT, WEB_TOP_INSET } from "@/constants/fonts";
import { useDeals } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { discountPct, formatMXN } from "@/lib/format";

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

export default function Ofertas() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const countdown = useCountdown(4 * 3_600_000 + 12 * 60_000 + 59 * 1000);
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 16;
  const { sucursal } = useApp();
  const { data: deals, isLoading, isError, error } = useDeals(sucursal.id || undefined);
  const dealOfDay = deals?.dealOfDay ?? null;
  const ofertas = deals?.ofertas ?? [];
  const dealOff = dealOfDay?.originalPrice ? discountPct(dealOfDay.price, dealOfDay.originalPrice) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <View style={{ paddingTop: topPad, paddingBottom: 20, paddingHorizontal: 24, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 8 }}>
          Precios de temporada
        </Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 32, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground }}>Ofertas</Text>
      </View>

      {isError ? (
        <EmptyState icon="alert-circle" title="Error al cargar" message={error instanceof Error ? error.message : "No se pudieron cargar las ofertas."} />
      ) : !isLoading && ofertas.length === 0 && !dealOfDay ? (
        <EmptyState icon="tag" title="Sin ofertas" message="No hay ofertas disponibles por ahora." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
          {/* Featured deal of the day */}
          {dealOfDay ? (
            <Pressable onPress={() => router.push(`/producto/${dealOfDay.id}`)} style={{ backgroundColor: c.foreground, padding: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <Feather name="zap" size={12} color={c.primary} />
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>Oferta del Día</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 20 }}>
                <View style={{ width: 110, height: 110, backgroundColor: c.background }}>
                  <ProductImage image={dealOfDay.image} categoryId={dealOfDay.categoryId} style={{ flex: 1 }} pad={10} />
                </View>
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: Fonts.black, fontSize: 18, lineHeight: 20, letterSpacing: -0.5, textTransform: "uppercase", color: c.background }}>
                    {dealOfDay.name}
                  </Text>
                  <View>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.neutral400, textDecorationLine: "line-through" }}>
                      {dealOfDay.originalPrice ? formatMXN(dealOfDay.originalPrice) : ""}
                    </Text>
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, letterSpacing: -1, color: c.primary }}>{formatMXN(dealOfDay.price)}</Text>
                  </View>
                </View>
              </View>
              {dealOff > 0 ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 16 }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 24, letterSpacing: -1, color: c.primary }}>-{dealOff}%</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 3 }}>Termina en</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 15, color: c.background }}>{countdown}</Text>
                  </View>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          {/* All deals */}
          <View style={{ marginTop: 12, backgroundColor: c.background, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}>
            {ofertas.map((p, i) => {
              const off = p.originalPrice ? discountPct(p.price, p.originalPrice) : 0;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/producto/${p.id}`)}
                  style={({ pressed }) => ({ flexDirection: "row", gap: 16, padding: 20, borderBottomWidth: i === ofertas.length - 1 ? 0 : 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
                >
                  <View style={{ width: 84, height: 84, borderWidth: 1, borderColor: c.border, position: "relative" }}>
                    <ProductImage image={p.image} categoryId={p.categoryId} style={{ flex: 1 }} />
                    <View style={{ position: "absolute", top: 0, left: 0, backgroundColor: c.primary, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Text style={{ color: c.primaryForeground, fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 0.5 }}>-{off}%</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 4 }}>{p.brand}</Text>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 12, textTransform: "uppercase", color: c.foreground, lineHeight: 16 }} numberOfLines={2}>{p.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 15, letterSpacing: -0.5, color: c.foreground }}>{formatMXN(p.price)}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.neutral400, textDecorationLine: "line-through" }}>
                        {p.originalPrice ? formatMXN(p.originalPrice) : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
