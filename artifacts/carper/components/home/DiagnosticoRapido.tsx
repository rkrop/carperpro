import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { SYMPTOMS } from "@/lib/homeContent";

/** Symptom-based shortcuts that drop the shopper into a relevant catalog search. */
export function DiagnosticoRapido() {
  const c = useColors();
  const router = useRouter();

  return (
    <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <SectionLabel style={{ marginBottom: 6 }}>Diagnóstico Rápido</SectionLabel>
      <Text style={{ fontFamily: Fonts.black, fontSize: 22, letterSpacing: -1, textTransform: "uppercase", color: c.foreground, marginBottom: 20 }}>
        ¿Qué le pasa a tu auto?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border }}>
        {SYMPTOMS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/resultados?q=${encodeURIComponent(s.query)}`)}
            style={({ pressed }) => ({
              width: "50%",
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderColor: c.border,
              paddingVertical: 20,
              paddingHorizontal: 16,
              gap: 10,
              backgroundColor: pressed ? c.neutral50 : c.background,
            })}
          >
            <MaterialCommunityIcons name={s.icon as any} size={22} color={c.primary} />
            <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: c.foreground, lineHeight: 15 }} numberOfLines={2}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
