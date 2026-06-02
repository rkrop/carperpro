import { Feather } from "@expo/vector-icons";
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
import { NuestrasMarcas } from "@/components/home/NuestrasMarcas";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { useDeals } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function Inicio() {
  const c = useColors();
  const router = useRouter();
  const { recent, sucursal } = useApp();
  const sucursalId = sucursal.id || undefined;
  const { data: deals } = useDeals(sucursalId);
  const dealOfDay = deals?.dealOfDay ?? null;
  const recentProducts = recent.slice(0, 6);

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <SearchHeader editable={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        {/* Hero */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 36, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 40, lineHeight: 38, letterSpacing: -2, textTransform: "uppercase", color: c.foreground }}>
            Rápido.{"\n"}Simple.{"\n"}Eficiente.
          </Text>
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

        {/* Nuestras marcas — credibility wall */}
        <NuestrasMarcas />

        {/* Preguntas frecuentes */}
        <HomeFaq />

        {/* Confianza / Sobre Carper — trust strip */}
        <Confianza />
      </ScrollView>
    </View>
  );
}
