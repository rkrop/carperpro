import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { BRAND_LOGOS, NUESTRAS_MARCAS_BANNER, SUPPLIER_BANNERS } from "@/lib/brandAssets";

/**
 * "Nuestras Marcas" credibility wall. The catalog is mostly SIN MARCA, so the
 * logo grid is a trust showcase (non-tappable); the two supplier banners are
 * the tappable CTAs that deep-link into full-text search results.
 */
export function NuestrasMarcas() {
  const c = useColors();
  const router = useRouter();

  return (
    <View style={{ backgroundColor: c.background, paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
        <SectionLabel>Nuestras Marcas</SectionLabel>
        <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -1, textTransform: "uppercase", color: c.foreground, marginTop: 8 }}>
          Refacciones de confianza
        </Text>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: c.mutedForeground, marginTop: 6, lineHeight: 17 }}>
          Trabajamos con las marcas líderes del ramo automotriz.
        </Text>
      </View>

      {/* Hero brand banner */}
      <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
        <Image
          source={NUESTRAS_MARCAS_BANNER}
          style={{ width: "100%", aspectRatio: 1024 / 819, borderWidth: 1, borderColor: c.border }}
          resizeMode="cover"
        />
      </View>

      {/* Tappable supplier promos */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 24, marginBottom: 22 }}>
        {SUPPLIER_BANNERS.map((b) => (
          <Pressable
            key={b.name}
            onPress={() => router.push(b.href as never)}
            style={({ pressed }) => ({ flex: 1, borderWidth: 1, borderColor: pressed ? c.borderStrong : c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
          >
            <Image source={b.image} style={{ width: "100%", aspectRatio: 16 / 9 }} resizeMode="cover" />
          </Pressable>
        ))}
      </View>

      {/* Logo wall */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border, marginHorizontal: 24 }}>
        {BRAND_LOGOS.map((b) => (
          <View
            key={b.name}
            style={{ width: "25%", aspectRatio: 1.4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", padding: 10 }}
          >
            <Image source={b.logo} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </View>
        ))}
      </View>
    </View>
  );
}
