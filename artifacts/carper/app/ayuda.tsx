import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { STORE } from "@/lib/store";

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Cómo hago un pedido?",
    a: "Agrega las refacciones al carrito y confirma. Tu pedido se envía por WhatsApp a la tienda, donde confirmamos existencia, precio y forma de entrega.",
  },
  {
    q: "¿Tienen entrega a domicilio?",
    a: `Sí. Entregamos en ${STORE.delivery.zona.toLowerCase()} en aproximadamente ${STORE.delivery.eta}. También puedes recoger en la tienda.`,
  },
  {
    q: "¿Cómo sé si una pieza sirve para mi auto?",
    a: "Guarda tu vehículo en tu cuenta y la app te marca las refacciones compatibles. Si tienes duda, escríbenos por WhatsApp con tu número de serie (VIN).",
  },
  {
    q: "¿Manejan garantía?",
    a: "Sí. Las refacciones eléctricas remanufacturadas y de marca cuentan con garantía. Conserva tu nota y contáctanos si tienes algún problema.",
  },
  {
    q: "¿Puedo pedir factura?",
    a: "Claro. Solicítala al confirmar tu pedido por WhatsApp y compártenos tus datos fiscales.",
  },
];

function ContactRow({ icon, label, value, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.neutral50 : c.background })}
    >
      <Feather name={icon} size={18} color={c.foreground} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>{label}</Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.mutedForeground, marginTop: 3 }}>{value}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={c.neutral400} />
    </Pressable>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 18, backgroundColor: pressed ? c.neutral50 : c.background })}
      >
        <Text style={{ flex: 1, fontFamily: Fonts.bold, fontSize: 13, letterSpacing: -0.2, color: c.foreground }}>{q}</Text>
        <Feather name={open ? "minus" : "plus"} size={16} color={c.neutral400} />
      </Pressable>
      {open ? (
        <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.mutedForeground, paddingHorizontal: 24, paddingBottom: 20 }}>{a}</Text>
      ) : null}
    </View>
  );
}

export default function Ayuda() {
  const c = useColors();
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Ayuda y Soporte" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 4 }}>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 19, color: c.mutedForeground }}>
            ¿Necesitas ayuda con una refacción o tu pedido? Escríbenos, con gusto te atendemos.
          </Text>
        </View>

        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 24, marginBottom: 12 }}>Contáctanos</SectionLabel>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          <ContactRow
            icon="message-circle"
            label="WhatsApp"
            value={STORE.phoneDisplay}
            onPress={() => open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent("Hola Carper, necesito ayuda con")}`)}
          />
          <ContactRow icon="phone" label="Llamar" value={STORE.phoneDisplay} onPress={() => open(`tel:${STORE.phone}`)} />
          <ContactRow icon="mail" label="Correo" value={STORE.email} onPress={() => open(`mailto:${STORE.email}`)} />
          <ContactRow icon="map-pin" label="Visítanos" value={STORE.city} onPress={() => open(STORE.mapsUrl)} />
        </View>

        <SectionLabel style={{ paddingHorizontal: 24, marginTop: 28, marginBottom: 12 }}>Preguntas frecuentes</SectionLabel>
        <View style={{ borderTopWidth: 1, borderColor: c.border }}>
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
