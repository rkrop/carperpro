import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useCallback } from "react";
import { Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";

import { Chip, Hairline, SectionLabel } from "@/components/CarperUI";
import { SearchHeader } from "@/components/SearchHeader";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { RECENT_SEARCHES } from "@/data/catalog";
import { useProducts } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

// Simple debounce hook
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Buscar() {
  const c = useColors();
  const router = useRouter();
  const { sucursal } = useApp();
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);

  const debouncedQ = useDebounce(query.trim(), 300);
  const showSuggestions = debouncedQ.length >= 2;

  const { data: suggestData, isLoading: suggestLoading } = useProducts(
    showSuggestions ? { q: debouncedQ, sucursalId: sucursal.id || undefined, limit: 6 } : undefined,
  );
  const suggestions = suggestData?.items ?? [];

  const submit = useCallback((q: string) => {
    const term = q.trim();
    if (!term) return;
    router.push(`/resultados?q=${encodeURIComponent(term)}`);
  }, [router]);

  const startVoice = () => {
    setListening(true);
    setTimeout(() => { setListening(false); submit("marcha tsuru"); }, 1500);
  };

  const entries = [
    { icon: "message-circle" as const, title: "Asistente de piezas", sub: "Describe tu auto y la falla", action: () => router.push("/asistente") },
    { icon: "hash" as const, title: "Por número de parte", sub: "Busca por SKU u OEM", action: () => submit(query || "sku") },
    { icon: "truck" as const, title: "Por vehículo", sub: "Marca · Modelo · Año · Motor", action: () => router.push("/buscar-vehiculo") },
    { icon: "maximize" as const, title: "Escanear refacción", sub: "Usa la cámara de tu equipo", action: () => router.push("/escanear") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SearchHeader value={query} onChangeText={setQuery} onSubmit={() => submit(query)} onVoice={startVoice} autoFocus />

      {/* Live suggestions while typing */}
      {showSuggestions ? (
        <View style={{ flex: 1 }}>
          {suggestLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={c.foreground} />
            </View>
          ) : suggestions.length === 0 ? (
            <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: c.mutedForeground }}>
                Sin resultados para "{debouncedQ}"
              </Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
              <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 10 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.mutedForeground }}>
                  {suggestData?.total ?? 0} resultados · mostrando {suggestions.length}
                </Text>
              </View>
              <View style={{ borderTopWidth: 1, borderColor: c.border }}>
                {suggestions.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/producto/${p.id}`)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingHorizontal: 24,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                      backgroundColor: pressed ? c.neutral50 : c.background,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: -0.2, color: c.foreground }} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 2 }}>
                        {p.sku} · {p.brand}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: c.foreground }}>
                      ${p.price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </Text>
                    <Feather name="arrow-right" size={14} color={c.neutral400} />
                  </Pressable>
                ))}
              </View>
              {/* Show all results button */}
              <Pressable
                onPress={() => submit(debouncedQ)}
                style={({ pressed }) => ({
                  marginHorizontal: 24,
                  marginTop: 16,
                  height: 48,
                  backgroundColor: pressed ? c.neutral100 : c.neutral50,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                })}
              >
                <Feather name="search" size={14} color={c.foreground} />
                <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.foreground }}>
                  Ver todos los resultados
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 24 }}>
              <Feather name="info" size={14} color={c.primary} />
              <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 11, lineHeight: 16, color: c.mutedForeground }}>
                Escribe la marca y modelo de tu auto, el número de parte o el nombre de la refacción para ver resultados.
              </Text>
            </View>
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
      )}

      {listening ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 24 }}>
          <View style={{ width: 96, height: 96, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
            <Feather name="mic" size={38} color={c.primaryForeground} />
          </View>
          <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -0.5, textTransform: "uppercase", color: c.foreground }}>Escuchando…</Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0.5, textAlign: "center", color: c.mutedForeground }}>
            Di el nombre o número de la refacción
          </Text>
        </View>
      ) : null}
    </View>
  );
}
