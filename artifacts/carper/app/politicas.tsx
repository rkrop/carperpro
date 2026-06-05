import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { POLICIES, POLICIES_UPDATED, type PolicyDoc } from "@/lib/policies";

/** Per-document icon (Feather names; the web copy maps the same ids to lucide). */
const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  "aviso-privacidad": "lock",
  terminos: "file-text",
  envios: "truck",
  devoluciones: "refresh-ccw",
  pagos: "credit-card",
  cookies: "info",
};

function PolicyRow({ doc, onPress }: { doc: PolicyDoc; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 24,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: pressed ? c.neutral50 : c.background,
      })}
    >
      <Feather name={ICONS[doc.id] ?? "file-text"} size={18} color={c.foreground} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>
          {doc.title}
        </Text>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 11, lineHeight: 16, color: c.mutedForeground, marginTop: 4 }}>
          {doc.summary}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={c.neutral400} />
    </Pressable>
  );
}

function PolicyDetail({ doc }: { doc: PolicyDoc }) {
  const c = useColors();
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ backgroundColor: c.foreground, paddingHorizontal: 24, paddingVertical: 28 }}>
        <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -0.8, textTransform: "uppercase", color: c.background }}>
          {doc.title}
        </Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.neutral400, marginTop: 10 }}>
          Última actualización: {POLICIES_UPDATED}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        {doc.sections.map((s, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 13, letterSpacing: 0.3, color: c.foreground, marginBottom: 10 }}>
              {s.heading}
            </Text>
            {s.paragraphs?.map((p, j) => (
              <Text
                key={`p${j}`}
                style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 21, color: c.mutedForeground, marginBottom: 8 }}
              >
                {p}
              </Text>
            ))}
            {s.bullets?.map((b, j) => (
              <View key={`b${j}`} style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 13, lineHeight: 21, color: c.primary }}>•</Text>
                <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 21, color: c.mutedForeground }}>
                  {b}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function Politicas() {
  const c = useColors();
  const router = useRouter();
  const [selected, setSelected] = useState<PolicyDoc | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader
        title="Políticas"
        onBack={() => (selected ? setSelected(null) : router.back())}
      />
      {selected ? (
        <PolicyDetail doc={selected} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ backgroundColor: c.foreground, paddingHorizontal: 24, paddingVertical: 32 }}>
            <Text style={{ fontFamily: Fonts.black, fontSize: 28, letterSpacing: -1, textTransform: "uppercase", color: c.background }}>
              Políticas y privacidad
            </Text>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.neutral400, marginTop: 12 }}>
              Conozca cómo protegemos sus datos y las condiciones de compra, envío, pagos y garantías de Carper Autopartes.
            </Text>
          </View>

          <SectionLabel style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 12 }}>Documentos</SectionLabel>
          <View style={{ borderTopWidth: 1, borderColor: c.border }}>
            {POLICIES.map((doc) => (
              <PolicyRow key={doc.id} doc={doc} onPress={() => setSelected(doc)} />
            ))}
          </View>

          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.neutral400, textAlign: "center", marginTop: 24, paddingHorizontal: 24 }}>
            Última actualización: {POLICIES_UPDATED}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
