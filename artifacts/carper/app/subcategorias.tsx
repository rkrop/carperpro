import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState, Hairline, SectionLabel, Skeleton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useCategories, useSubcategories } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

export default function Subcategorias() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; name?: string }>();
  const categoryId = params.category;

  const { data: categories } = useCategories();
  const { data: subcategories, isLoading, isError, error } = useSubcategories(categoryId);

  const category = categoryId ? categories?.find((cat) => cat.id === categoryId) : undefined;
  const title = params.name || category?.name || "Subcategorías";

  const goToAll = () => router.push(`/resultados?category=${categoryId}`);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title={title} />

      <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground }}>
          {category ? `${category.count.toLocaleString("en-US")} refacciones en catálogo` : "Elige una subcategoría"}
        </Text>
      </View>

      {/* Ver todo — always available, even when there are no subcategories */}
      <Pressable
        onPress={goToAll}
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
          <Feather name="grid" size={20} color={c.foreground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>
            Todas las refacciones
          </Text>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 3 }}>Ver todo el catálogo</Text>
        </View>
        <Feather name="chevron-right" size={18} color={c.neutral400} />
      </Pressable>

      {isError ? (
        <EmptyState icon="alert-circle" title="Error al cargar" message={error instanceof Error ? error.message : "No se pudieron cargar las subcategorías."} />
      ) : isLoading ? (
        <View>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : !subcategories || subcategories.length === 0 ? null : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <SectionLabel style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 8 }}>Subcategorías</SectionLabel>
          {subcategories.map((sub) => (
            <Pressable
              key={sub.id}
              onPress={() => router.push(`/resultados?category=${categoryId}&subcategory=${sub.id}`)}
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
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 14, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>{sub.name}</Text>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 3 }}>
                  {sub.count.toLocaleString("en-US")} refacciones
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
