import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState, SectionLabel, Skeleton } from "@/components/CarperUI";
import { SearchHeader } from "@/components/SearchHeader";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { useCategories } from "@/data/catalog";
import { FEATURED_CATEGORIES } from "@/lib/categoryAssets";
import { useColors } from "@/hooks/useColors";

export default function Categorias() {
  const c = useColors();
  const router = useRouter();
  const { data: categories, isLoading, isError, error } = useCategories();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SearchHeader editable={false} />
      <View style={{ paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: c.border }}>
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
          {/* Destacadas — visual grid entry points */}
          <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <SectionLabel style={{ marginBottom: 18 }}>Destacadas</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {FEATURED_CATEGORIES.map((f) => (
                <Pressable
                  key={f.label}
                  onPress={() => router.push(f.href as never)}
                  style={({ pressed }) => ({ width: "48.5%", marginBottom: 14, borderWidth: 1, borderColor: pressed ? c.borderStrong : c.border, backgroundColor: c.background, overflow: "hidden" })}
                >
                  <View style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: c.neutral100 }}>
                    <Image source={f.image} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 11, minHeight: 46, justifyContent: "center", borderTopWidth: 1, borderTopColor: c.border }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 0.5, lineHeight: 14, textTransform: "uppercase", color: c.foreground }} numberOfLines={2}>
                      {f.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Full list */}
          <SectionLabel style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 8 }}>Todas las categorías</SectionLabel>

          {/* Todas las líneas — always available, browses the full catalog with no category filter */}
          <Pressable
            onPress={() => router.push("/resultados")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              paddingHorizontal: 24,
              paddingVertical: 26,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
              backgroundColor: pressed ? c.primary : c.background,
            })}
          >
            {({ pressed }) => (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 22, letterSpacing: -0.6, textTransform: "uppercase", color: pressed ? c.primaryForeground : c.foreground }}>
                    Todas las líneas
                  </Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: pressed ? c.primaryForeground : c.mutedForeground, marginTop: 5, opacity: pressed ? 0.85 : 1 }}>
                    Ver todo el catálogo
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={pressed ? c.primaryForeground : c.neutral400} />
              </>
            )}
          </Pressable>

          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => router.push(`/subcategorias?category=${cat.id}&name=${encodeURIComponent(cat.name)}`)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                paddingHorizontal: 24,
                paddingVertical: 26,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
                backgroundColor: pressed ? c.primary : c.background,
              })}
            >
              {({ pressed }) => (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 22, letterSpacing: -0.6, textTransform: "uppercase", color: pressed ? c.primaryForeground : c.foreground }}>
                      {cat.name}
                    </Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: pressed ? c.primaryForeground : c.mutedForeground, marginTop: 5, opacity: pressed ? 0.85 : 1 }}>
                      {cat.count.toLocaleString("en-US")} refacciones
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={pressed ? c.primaryForeground : c.neutral400} />
                </>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
