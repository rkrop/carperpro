import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { ProductCardMini } from "@/components/ProductRow";
import { SearchHeader } from "@/components/SearchHeader";
import { Colecciones } from "@/components/home/Colecciones";
import { Confianza } from "@/components/home/Confianza";
import { ConsejosTaller } from "@/components/home/ConsejosTaller";
import { DealOfDay } from "@/components/home/DealOfDay";
import { DiagnosticoRapido } from "@/components/home/DiagnosticoRapido";
import { HomeFaq } from "@/components/home/HomeFaq";
import { MasBuscados } from "@/components/home/MasBuscados";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { useCategories, useDeals } from "@/data/catalog";
import { useApp, vehicleLabel, vehicleSub } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Inicio() {
  const c = useColors();
  const router = useRouter();
  const { vehicle, recent, sucursal } = useApp();
  const sucursalId = sucursal.id || undefined;
  const { data: categories } = useCategories();
  const { data: deals } = useDeals(sucursalId);
  const dealOfDay = deals?.dealOfDay ?? null;
  const recentProducts = recent.slice(0, 6);
  const popularCats = categories?.slice(0, 9) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <SearchHeader editable={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        {/* Hero */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 36, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 40, lineHeight: 38, letterSpacing: -2, textTransform: "uppercase", color: c.foreground }}>
            Rápido.{"\n"}Simple.{"\n"}Eficiente.
          </Text>

          <Pressable
            onPress={() => router.push("/buscar-vehiculo")}
            style={{ borderWidth: 1, borderColor: c.border, padding: 20, marginTop: 28 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Feather name="truck" size={16} color={c.neutral400} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.mutedForeground }}>
                Mi Vehículo
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <View>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 15, letterSpacing: -0.2, textTransform: "uppercase", color: c.foreground }}>
                  {vehicleLabel(vehicle)}
                </Text>
                <Text style={{ fontFamily: Fonts.medium, fontSize: 11, textTransform: "uppercase", color: c.mutedForeground, marginTop: 2 }}>
                  {vehicleSub(vehicle)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={c.neutral400} />
            </View>
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 28 }}>
          <View style={{ flexDirection: "row", borderWidth: 1, borderColor: c.border }}>
            <Pressable
              onPress={() => router.push("/escanear")}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 22, gap: 12, backgroundColor: pressed ? c.neutral50 : c.background })}
            >
              <Feather name="maximize" size={24} color={c.foreground} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground, textAlign: "center" }}>
                Escanear{"\n"}Refacción
              </Text>
            </Pressable>
            <View style={{ width: 1, backgroundColor: c.border }} />
            <Pressable
              onPress={() => router.push("/buscar-vehiculo")}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 22, gap: 12, backgroundColor: pressed ? c.neutral50 : c.background })}
            >
              <Feather name="truck" size={24} color={c.foreground} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground, textAlign: "center" }}>
                Buscar por{"\n"}Vehículo
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Diagnóstico rápido — symptom shortcuts */}
        <DiagnosticoRapido />

        {/* Deal of day */}
        {dealOfDay ? <DealOfDay product={dealOfDay} /> : null}

        {/* Más buscados — real catalog products */}
        <MasBuscados />

        {/* Categories */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 32, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <SectionLabel style={{ marginBottom: 20 }}>Categorías Populares</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border }}>
            {popularCats.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/resultados?category=${cat.id}`)}
                style={({ pressed }) => ({ width: "33.333%", aspectRatio: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", gap: 8, padding: 8, backgroundColor: pressed ? c.neutral50 : c.background })}
              >
                <MaterialCommunityIcons name={cat.icon as any} size={22} color={c.foreground} />
                <Text style={{ fontFamily: Fonts.bold, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: c.foreground, textAlign: "center" }} numberOfLines={2}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Colecciones destacadas — curated campaigns */}
        <Colecciones />

        {/* Recently viewed */}
        {recentProducts.length > 0 ? (
          <View style={{ paddingVertical: 32 }}>
            <SectionLabel style={{ marginBottom: 20, paddingHorizontal: 24 }}>Vistos Recientemente</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
              {recentProducts.map((p) => (
                <ProductCardMini key={p.id} product={p} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Consejos del taller — editorial tips */}
        <ConsejosTaller />

        {/* Preguntas frecuentes */}
        <HomeFaq />

        {/* Confianza / Sobre Carper — trust strip */}
        <Confianza />
      </ScrollView>
    </View>
  );
}
