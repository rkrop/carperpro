import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { STORE } from "@/lib/store";

const APP_VERSION = "1.0.0";

function InfoRow({ icon, label, value, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed && onPress ? c.neutral50 : c.background })}
    >
      <Feather name={icon} size={18} color={c.foreground} />
      <Text style={{ flex: 1, fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: c.mutedForeground }}>{value}</Text>
      {onPress ? <Feather name="chevron-right" size={16} color={c.neutral400} /> : null}
    </Pressable>
  );
}

export default function Acerca() {
  const c = useColors();
  const router = useRouter();
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Acerca de Carper" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Brand block */}
        <View style={{ backgroundColor: c.foreground, paddingHorizontal: 24, paddingVertical: 36 }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 34, letterSpacing: -1.5, textTransform: "uppercase", color: c.background }}>Carper</Text>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: c.primary, marginTop: 4 }}>Autopartes</Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.neutral400, marginTop: 16 }}>
            Tu especialista en partes eléctricas para el automóvil: marchas, alternadores, sensores y fuel injection.
            Rápido, simple y eficiente.
          </Text>
        </View>

        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 28, marginBottom: 12 }}>La tienda</SectionLabel>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          <InfoRow icon="map-pin" label="Dirección" value={STORE.city} onPress={() => open(STORE.mapsUrl)} />
          <InfoRow icon="clock" label="Horario" value="Lun-Sáb" />
          <InfoRow icon="instagram" label="Instagram" value={`@${STORE.instagram}`} onPress={() => open(STORE.instagramUrl)} />
          <InfoRow icon="file-text" label="RFC" value={STORE.rfc} />
        </View>

        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 28, marginBottom: 12 }}>Aplicación</SectionLabel>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          <InfoRow icon="smartphone" label="Versión" value={`v${APP_VERSION}`} />
          <InfoRow icon="shield" label="Políticas y privacidad" value="Ver" onPress={() => router.push("/politicas")} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.neutral400, textAlign: "center" }}>
            {STORE.address}
          </Text>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.neutral400, textAlign: "center", marginTop: 6 }}>
            © {new Date().getFullYear()} {STORE.name}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
