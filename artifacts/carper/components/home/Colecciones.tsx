import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, Text, useWindowDimensions, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { CAMPAIGNS } from "@/lib/campaigns";
import { HOME_COLLECTION_IDS } from "@/lib/homeContent";

/** Spotlights a few curated Ofertas campaigns on the home screen. */
export function Colecciones() {
  const c = useColors();
  const router = useRouter();
  const items = HOME_COLLECTION_IDS.map((id) => CAMPAIGNS.find((cp) => cp.id === id)).filter(
    (cp): cp is NonNullable<typeof cp> => Boolean(cp),
  );

  if (items.length === 0) return null;

  const imgH = Math.round(useWindowDimensions().width * (768 / 1408));

  return (
    <View style={{ backgroundColor: c.background, paddingTop: 32, paddingBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 18 }}>
        <SectionLabel>Colecciones Destacadas</SectionLabel>
        <Pressable onPress={() => router.push("/ofertas")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.primary }}>Ver todas</Text>
          <Feather name="arrow-right" size={13} color={c.primary} />
        </Pressable>
      </View>

      {items.map((cp) => (
        <Pressable
          key={cp.id}
          onPress={() => router.push(`/resultados?q=${encodeURIComponent(cp.query)}`)}
          style={({ pressed }) => ({ marginBottom: 24, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={{ height: imgH, backgroundColor: c.neutral100 }}>
            <Image source={cp.image} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ paddingHorizontal: 24, paddingTop: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 6 }}>
                {cp.tag}
              </Text>
              <Text style={{ fontFamily: Fonts.black, fontSize: 17, letterSpacing: -0.6, textTransform: "uppercase", color: c.foreground, lineHeight: 19 }}>
                {cp.title}
              </Text>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17, color: c.mutedForeground, marginTop: 6 }} numberOfLines={2}>
                {cp.subtitle}
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={c.foreground} style={{ marginTop: 18 }} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}
