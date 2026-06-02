import { Feather } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Switch, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useApp, type NotifPrefs } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const ROWS: { key: keyof NotifPrefs; icon: keyof typeof Feather.glyphMap; label: string; help: string }[] = [
  { key: "ofertas", icon: "tag", label: "Ofertas y promociones", help: "Descuentos, oferta del día y campañas de temporada." },
  { key: "pedidos", icon: "package", label: "Estado de pedidos", help: "Avisos cuando tu pedido se confirma o está listo." },
  { key: "reabasto", icon: "refresh-cw", label: "Reabasto de piezas", help: "Te avisamos cuando llega una pieza para tu vehículo." },
  { key: "novedades", icon: "bell", label: "Novedades de Carper", help: "Nuevas marcas, servicios y noticias de la tienda." },
];

export default function Notificaciones() {
  const c = useColors();
  const { notifPrefs, setNotifPref } = useApp();

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Notificaciones" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 19, color: c.mutedForeground }}>
            Elige qué avisos quieres recibir. Tus preferencias se guardan en este dispositivo.
          </Text>
        </View>

        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 12 }}>Preferencias</SectionLabel>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          {ROWS.map((r) => (
            <View
              key={r.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}
            >
              <Feather name={r.icon} size={18} color={c.foreground} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>{r.label}</Text>
                <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 3, lineHeight: 15 }}>{r.help}</Text>
              </View>
              <Switch
                value={notifPrefs[r.key]}
                onValueChange={(v) => setNotifPref(r.key, v)}
                trackColor={{ false: c.neutral300, true: c.primary }}
                thumbColor={c.background}
                ios_backgroundColor={c.neutral300}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
