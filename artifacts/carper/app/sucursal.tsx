import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { STORE } from "@/lib/store";
import { useColors } from "@/hooks/useColors";

export default function StoreInfo() {
  const c = useColors();
  const router = useRouter();

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Nuestra Tienda" action={{ icon: "x", onPress: () => router.back() }} showBack={false} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Identity */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 28, letterSpacing: -1, textTransform: "uppercase", color: c.foreground }}>
            {STORE.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }} />
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.success }}>
              {STORE.hours}
            </Text>
          </View>
        </View>

        {/* Delivery banner */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.primarySoft }}>
          <Feather name="truck" size={20} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: -0.2, textTransform: "uppercase", color: c.primary }}>
              Envío gratis · {STORE.delivery.eta}
            </Text>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
              {STORE.delivery.zona} · o recoge en tienda
            </Text>
          </View>
        </View>

        {/* Contact actions */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 14 }}>
            Contacto
          </Text>
        </View>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          <ContactRow icon="message-circle" label="WhatsApp" value={STORE.phoneDisplay} onPress={() => open(`https://wa.me/${STORE.whatsapp}`)} c={c} />
          <ContactRow icon="phone" label="Llamar" value={STORE.phoneDisplay} onPress={() => open(`tel:${STORE.phone}`)} c={c} />
          <ContactRow icon="map-pin" label="Ubicación" value={STORE.address} onPress={() => open(STORE.mapsUrl)} c={c} />
          <ContactRow icon="mail" label="Correo" value={STORE.email} onPress={() => open(`mailto:${STORE.email}`)} c={c} />
          <ContactRow icon="instagram" label="Instagram" value={`@${STORE.instagram}`} onPress={() => open(STORE.instagramUrl)} c={c} />
        </View>

        {/* Legal */}
        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 10 }}>
            Datos fiscales
          </Text>
          <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.mutedForeground }}>RFC {STORE.rfc}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ContactRow({
  icon,
  label,
  value,
  onPress,
  c,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
    >
      <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={18} color={c.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 3 }}>{label}</Text>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.foreground }} numberOfLines={2}>{value}</Text>
      </View>
      <Feather name="arrow-up-right" size={18} color={c.neutral400} />
    </Pressable>
  );
}
