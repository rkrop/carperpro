import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState, Skeleton } from "@/components/CarperUI";
import { Fonts, isWeb, TAB_BAR_HEIGHT, WEB_TOP_INSET } from "@/constants/fonts";
import { useCategories } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

export default function Categorias() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 16;
  const { data: categories, isLoading, isError, error } = useCategories();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: topPad, paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>
          Catálogo completo
        </Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 32, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground }}>Categorías</Text>
      </View>

      {isError ? (
        <EmptyState icon="alert-circle" title="Error al cargar" message={error instanceof Error ? error.message : "No se pudieron cargar las categorías."} />
      ) : isLoading ? (
        <View>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Skeleton width={44} height={44} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="35%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : !categories || categories.length === 0 ? (
        <EmptyState icon="grid" title="Sin categorías" message="Aún no hay categorías en el catálogo." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => router.push(`/resultados?category=${cat.id}`)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                paddingHorizontal: 24,
                paddingVertical: 20,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
                backgroundColor: pressed ? c.neutral50 : c.background,
              })}
            >
              <View style={{ width: 44, height: 44, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name={cat.icon as any} size={22} color={c.foreground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>{cat.name}</Text>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 3 }}>
                  {cat.count.toLocaleString("en-US")} refacciones
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={c.neutral400} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
