import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { SearchHeader } from "@/components/SearchHeader";
import { Colecciones } from "@/components/home/Colecciones";
import { Confianza } from "@/components/home/Confianza";
import { ConsejosTaller } from "@/components/home/ConsejosTaller";
import { DealOfDay } from "@/components/home/DealOfDay";
import { DiagnosticoRapido } from "@/components/home/DiagnosticoRapido";
import { HomeBlog } from "@/components/home/HomeBlog";
import { HomeFaq } from "@/components/home/HomeFaq";
import { NuestrasMarcas } from "@/components/home/NuestrasMarcas";
import { Fonts, TAB_BAR_HEIGHT } from "@/constants/fonts";
import { useDeals } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const QUICK_ACTIONS: { label: string; icon: keyof typeof Feather.glyphMap; href: string }[] = [
  { label: "Mis\nPedidos", icon: "package", href: "/pedidos" },
  { label: "Favoritos", icon: "heart", href: "/favoritos" },
  { label: "Escanear\nRefacción", icon: "maximize", href: "/escanear" },
  { label: "Buscar por\nVehículo", icon: "truck", href: "/buscar-vehiculo" },
];

export default function Inicio() {
  const c = useColors();
  const router = useRouter();
  const { sucursal } = useApp();
  const sucursalId = sucursal.id || undefined;
  const { data: deals } = useDeals(sucursalId);
  const dealOfDay = deals?.dealOfDay ?? null;

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

        {/* Asistente de piezas — conversational part finder */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <Pressable
            onPress={() => router.push("/asistente")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              borderWidth: 1,
              borderColor: c.primary,
              padding: 18,
              backgroundColor: pressed ? c.neutral50 : c.background,
            })}
          >
            <View style={{ width: 44, height: 44, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
              <Feather name="message-circle" size={20} color={c.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.black, fontSize: 14, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>
                Asistente de Piezas
              </Text>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15, color: c.mutedForeground, marginTop: 2 }}>
                Dinos tu auto y la falla. Te decimos qué refacción necesitas.
              </Text>
            </View>
            <Feather name="arrow-up-right" size={20} color={c.primary} />
          </Pressable>
        </View>

        {/* Quick actions — 2x2 grid */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 28 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border }}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.href as never)}
                style={({ pressed }) => ({
                  width: "50%",
                  height: 100,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: c.border,
                  backgroundColor: pressed ? c.neutral50 : c.background,
                })}
              >
                <Feather name={a.icon} size={24} color={c.foreground} />
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground, textAlign: "center" }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Diagnóstico rápido — symptom shortcuts */}
        <DiagnosticoRapido />

        {/* Deal of day */}
        {dealOfDay ? <DealOfDay product={dealOfDay} /> : null}

        {/* Colecciones destacadas — curated campaigns */}
        <Colecciones />

        {/* Consejos del taller — editorial tips */}
        <ConsejosTaller />

        {/* Blog & Comunidad — news, tips, testimonials */}
        <HomeBlog />

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
