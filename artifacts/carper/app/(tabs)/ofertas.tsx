import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductImage } from "@/components/ProductImage";
import { SectionLabel } from "@/components/CarperUI";
import { Fonts, isWeb, TAB_BAR_HEIGHT, WEB_TOP_INSET } from "@/constants/fonts";
import { useApp, vehicleLabel } from "@/context/AppContext";
import { useDeals } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";
import { CAMPAIGNS, type Campaign } from "@/lib/campaigns";
import { discountPct, formatMXN } from "@/lib/format";

const DEAL_BG = require("@/assets/images/ofertas/02-deldia.png");

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs);
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r <= 1000 ? targetMs : r - 1000)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const c = useColors();
  const router = useRouter();
  const { vehicle } = useApp();

  const subtitle =
    campaign.kind === "restock" && vehicle
      ? `Te avisamos cuando llega para tu ${vehicleLabel(vehicle)}.`
      : campaign.subtitle;

  return (
    <Pressable
      onPress={() => router.push(`/resultados?q=${encodeURIComponent(campaign.query)}`)}
      style={({ pressed }) => ({ backgroundColor: c.background, marginBottom: 12, opacity: pressed ? 0.92 : 1 })}
    >
      <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: c.neutral100 }}>
        <Image source={campaign.image} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        <View style={{ position: "absolute", top: 0, left: 0, backgroundColor: c.foreground, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>{campaign.tag}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 16, lineHeight: 19, letterSpacing: -0.5, textTransform: "uppercase", color: c.foreground }}>
            {campaign.title}
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17, color: c.mutedForeground, marginTop: 6 }}>{subtitle}</Text>
        </View>
        <Feather name={campaign.kind === "restock" ? "bell" : "arrow-right"} size={18} color={c.primary} />
      </View>
    </Pressable>
  );
}

export default function Ofertas() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const countdown = useCountdown(4 * 3_600_000 + 12 * 60_000 + 59 * 1000);
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 16;
  const { sucursal } = useApp();
  const { data: deals } = useDeals(sucursal.id || undefined);
  const dealOfDay = deals?.dealOfDay ?? null;
  const dealOff = dealOfDay?.originalPrice ? discountPct(dealOfDay.price, dealOfDay.originalPrice) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <View style={{ paddingTop: topPad, paddingBottom: 20, paddingHorizontal: 24, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 8 }}>
          Tu especialista eléctrico
        </Text>
        <Text style={{ fontFamily: Fonts.black, fontSize: 32, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground }}>Ofertas</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24 }}>
        {/* Live deal of the day (rotating discounted product from the catalog) */}
        {dealOfDay ? (
          <Pressable onPress={() => router.push(`/producto/${dealOfDay.id}`)} style={{ backgroundColor: c.foreground }}>
            <ImageBackground source={DEAL_BG} resizeMode="cover" style={{ padding: 24 }} imageStyle={{ opacity: 0.22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <Feather name="zap" size={12} color={c.primary} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>Oferta del Día</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 20 }}>
              <View style={{ width: 110, height: 110, backgroundColor: c.background }}>
                <ProductImage image={dealOfDay.image} categoryId={dealOfDay.categoryId} style={{ flex: 1 }} pad={10} />
              </View>
              <View style={{ flex: 1, justifyContent: "space-between" }}>
                <Text style={{ fontFamily: Fonts.black, fontSize: 18, lineHeight: 20, letterSpacing: -0.5, textTransform: "uppercase", color: c.background }}>
                  {dealOfDay.name}
                </Text>
                <View>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.neutral400, textDecorationLine: "line-through" }}>
                    {dealOfDay.originalPrice ? formatMXN(dealOfDay.originalPrice) : ""}
                  </Text>
                  <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, letterSpacing: -1, color: c.primary }}>{formatMXN(dealOfDay.price)}</Text>
                </View>
              </View>
            </View>
            {dealOff > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", paddingTop: 16 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 24, letterSpacing: -1, color: c.primary }}>-{dealOff}%</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 3 }}>Termina en</Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 15, color: c.background }}>{countdown}</Text>
                </View>
              </View>
            ) : null}
            </ImageBackground>
          </Pressable>
        ) : null}

        {/* Curated campaigns */}
        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 14 }}>Colecciones destacadas</SectionLabel>
        <View>
          {CAMPAIGNS.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
