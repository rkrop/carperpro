import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Chip, SectionLabel } from "@/components/CarperUI";
import { SearchHeader } from "@/components/SearchHeader";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { RECENT_SEARCHES } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

export default function Buscar() {
  const c = useColors();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (q: string) => {
    const term = q.trim();
    if (!term) return;
    router.push(`/resultados?q=${encodeURIComponent(term)}`);
  };

  const entries = [
    { icon: "hash" as const, title: "Por número de parte", sub: "Busca por SKU u OEM", action: () => submit(query || "sku") },
    { icon: "truck" as const, title: "Por vehículo", sub: "Marca · Modelo · Año · Motor", action: () => router.push("/buscar-vehiculo") },
    { icon: "maximize" as const, title: "Escanear refacción", sub: "Usa la cámara de tu equipo", action: () => router.push("/escanear") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SearchHeader value={query} onChangeText={setQuery} onSubmit={() => submit(query)} autoFocus />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <SectionLabel style={{ marginBottom: 16 }}>Cómo Buscar</SectionLabel>
          <View style={{ borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border }}>
            {entries.map((e) => (
              <Pressable
                key={e.title}
                onPress={e.action}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, padding: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
              >
                <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                  <Feather name={e.icon} size={18} color={c.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 13, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>{e.title}</Text>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>{e.sub}</Text>
                </View>
                <Feather name="arrow-up-right" size={18} color={c.neutral400} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 36 }}>
          <SectionLabel style={{ marginBottom: 16 }}>Búsquedas Recientes</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {RECENT_SEARCHES.map((s) => (
              <Chip key={s} label={s} onPress={() => submit(s)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
