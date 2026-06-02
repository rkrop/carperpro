import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState, Skeleton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { Sucursal, useSucursales } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SucursalSelector() {
  const c = useColors();
  const router = useRouter();
  const { sucursal, setSucursal } = useApp();
  const { data: sucursales, isLoading, isError, error } = useSucursales();

  const pick = (s: Sucursal) => {
    setSucursal(s);
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Elegir Sucursal" action={{ icon: "x", onPress: () => router.back() }} showBack={false} />
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>
          La disponibilidad de refacciones varía por sucursal
        </Text>
      </View>

      {isError ? (
        <EmptyState icon="alert-circle" title="Error al cargar" message={error instanceof Error ? error.message : "No se pudieron cargar las sucursales."} />
      ) : isLoading ? (
        <View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 16, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Skeleton width={44} height={44} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : !sucursales || sucursales.length === 0 ? (
        <EmptyState icon="map-pin" title="Sin sucursales" message="No hay sucursales disponibles." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {sucursales.map((s) => {
            const active = s.id === sucursal.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => pick(s)}
                style={({ pressed }) => ({ flexDirection: "row", gap: 16, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : active ? c.primarySoft : c.background })}
              >
                <View style={{ width: 44, height: 44, borderWidth: 1, borderColor: active ? c.primary : c.border, alignItems: "center", justifyContent: "center" }}>
                  <Feather name="map-pin" size={18} color={active ? c.primary : c.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: active ? c.primary : c.foreground }}>{s.name}</Text>
                  {s.address ? <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 3 }}>{s.address}</Text> : null}
                  {s.hours ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.success }} />
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: c.success }}>Abierto · {s.hours}</Text>
                    </View>
                  ) : null}
                </View>
                {active ? <Feather name="check" size={20} color={c.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
