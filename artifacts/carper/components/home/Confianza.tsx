import { Feather } from "@expo/vector-icons";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { STORE } from "@/lib/store";
import { TRUST_STATS } from "@/lib/homeContent";

/** Trust strip: store stats + WhatsApp CTA. Closes the home page. */
export function Confianza() {
  const c = useColors();
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ backgroundColor: c.foreground, paddingHorizontal: 24, paddingVertical: 36 }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 6 }}>
        Sobre Carper
      </Text>
      <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -1, textTransform: "uppercase", color: c.background, marginBottom: 24 }}>
        Tu especialista eléctrico
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {TRUST_STATS.map((s, i) => (
          <View
            key={s.label}
            style={{
              width: "50%",
              paddingVertical: 18,
              paddingRight: i % 2 === 0 ? 16 : 0,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.15)",
            }}
          >
            <Feather name={s.icon as any} size={18} color={c.neutral400} />
            <Text style={{ fontFamily: Fonts.black, fontSize: 18, letterSpacing: -0.5, color: c.background, marginTop: 10 }}>{s.value}</Text>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.neutral400, marginTop: 2, lineHeight: 15 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent("Hola Carper, necesito ayuda para encontrar una refacción")}`)}
        style={({ pressed }) => ({
          marginTop: 28,
          height: 56,
          backgroundColor: pressed ? c.primaryPressed : c.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        })}
      >
        <Feather name="message-circle" size={16} color={c.primaryForeground} />
        <Text style={{ color: c.primaryForeground, fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Pregúntanos por WhatsApp
        </Text>
      </Pressable>

      <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.neutral400, marginTop: 18, lineHeight: 16 }}>
        {STORE.address}
      </Text>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.neutral400, marginTop: 4 }}>{STORE.hours}</Text>
    </View>
  );
}
