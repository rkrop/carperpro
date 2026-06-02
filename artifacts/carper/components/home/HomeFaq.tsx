import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { HOME_FAQ } from "@/lib/homeContent";

function FaqItem({ q, a }: { q: string; a: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 18, backgroundColor: pressed ? c.neutral50 : c.background })}
      >
        <Text style={{ flex: 1, fontFamily: Fonts.bold, fontSize: 13, letterSpacing: -0.2, color: c.foreground }}>{q}</Text>
        <Feather name={open ? "minus" : "plus"} size={16} color={c.neutral400} />
      </Pressable>
      {open ? (
        <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.mutedForeground, paddingHorizontal: 24, paddingBottom: 20 }}>{a}</Text>
      ) : null}
    </View>
  );
}

/** Short FAQ on home; the full list lives on the Ayuda screen. */
export function HomeFaq() {
  const c = useColors();
  const router = useRouter();
  return (
    <View style={{ paddingTop: 32 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 16 }}>
        <SectionLabel>Preguntas Frecuentes</SectionLabel>
        <Pressable onPress={() => router.push("/ayuda")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.primary }}>Ver más</Text>
          <Feather name="arrow-right" size={13} color={c.primary} />
        </Pressable>
      </View>
      <View style={{ borderTopWidth: 1, borderColor: c.border }}>
        {HOME_FAQ.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </View>
    </View>
  );
}
