import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { TIPS } from "@/lib/homeContent";

/** Editorial maintenance tips that build trust and link to relevant parts. */
export function ConsejosTaller() {
  const c = useColors();
  const router = useRouter();

  return (
    <View style={{ paddingVertical: 32 }}>
      <SectionLabel style={{ paddingHorizontal: 24, marginBottom: 6 }}>Consejos del Taller</SectionLabel>
      <Text style={{ fontFamily: Fonts.black, fontSize: 22, letterSpacing: -1, textTransform: "uppercase", color: c.foreground, paddingHorizontal: 24, marginBottom: 20 }}>
        Diagnostica como experto
      </Text>

      {TIPS.map((t, i) => (
        <Pressable
          key={t.id}
          onPress={() => router.push(`/resultados?q=${encodeURIComponent(t.query)}`)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? c.neutral50 : c.background,
            borderTopWidth: 1,
            borderBottomWidth: i === TIPS.length - 1 ? 1 : 0,
            borderColor: c.border,
          })}
        >
          <View style={{ height: 160, backgroundColor: c.neutral100 }}>
            <Image source={t.image} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ padding: 24 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 8 }}>
              {t.tag}
            </Text>
            <Text style={{ fontFamily: Fonts.black, fontSize: 18, letterSpacing: -0.6, textTransform: "uppercase", color: c.foreground, lineHeight: 20, marginBottom: 8 }}>
              {t.title}
            </Text>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.mutedForeground }}>{t.body}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground }}>
                Ver refacciones
              </Text>
              <Feather name="arrow-right" size={14} color={c.foreground} />
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
