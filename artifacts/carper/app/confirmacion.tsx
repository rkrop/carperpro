import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, OutlineButton } from "@/components/CarperUI";
import { Fonts, isWeb, WEB_BOTTOM_INSET, WEB_TOP_INSET } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

export default function Confirmacion() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folio } = useLocalSearchParams<{ folio: string }>();
  const { orders, sucursal } = useApp();
  const order = orders.find((o) => o.folio === folio);
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 24;
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 24;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <View style={{ width: 72, height: 72, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
            <Feather name="check" size={36} color={c.primaryForeground} />
          </View>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary, marginBottom: 10 }}>Pedido Enviado</Text>
          <Text style={{ fontFamily: Fonts.black, fontSize: 30, letterSpacing: -1.5, textTransform: "uppercase", color: c.foreground, textAlign: "center", lineHeight: 32 }}>
            ¡Gracias por{"\n"}tu compra!
          </Text>
        </View>

        {order ? (
          <View style={{ borderWidth: 1, borderColor: c.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>Folio</Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, color: c.foreground }}>{order.folio}</Text>
            </View>
            <Detail label="Fecha" value={order.date} c={c} />
            <Detail label="Entrega" value={order.entrega === "tienda" ? "Recoger en tienda" : "Envío a domicilio"} c={c} />
            <Detail label="Pago" value={order.pago} c={c} />
            <Detail label="Artículos" value={`${order.lines.reduce((s, l) => s + l.qty, 0)}`} c={c} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 18, backgroundColor: c.neutral50 }}>
              <Text style={{ fontFamily: Fonts.black, fontSize: 14, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Total</Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 18, letterSpacing: -0.5, color: c.foreground }}>{formatMXN(order.total)}</Text>
            </View>
          </View>
        ) : folio ? (
          // The order is being looked up / synced from the server. Folio is the
          // proof the order exists; show it while the full record propagates.
          <View style={{ borderWidth: 1, borderColor: c.border, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>Folio</Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, color: c.foreground }}>{folio}</Text>
            </View>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: c.mutedForeground }}>
              Cargando detalle de tu pedido…
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24, borderWidth: 1, borderColor: c.border, padding: 16 }}>
          <Feather name="message-circle" size={16} color={c.primary} />
          <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase", color: c.mutedForeground }}>
            {order?.entrega === "tienda"
              ? `Te confirmaremos por WhatsApp cuando esté listo para recoger en ${sucursal.name}`
              : `Te contactaremos por WhatsApp para coordinar tu envío (${sucursal.delivery.eta})`}
          </Text>
        </View>

        <View style={{ marginTop: "auto", gap: 12, paddingTop: 40 }}>
          <AccentButton label="Seguir Comprando" icon="home" onPress={() => router.replace("/(tabs)")} />
          <OutlineButton label="Ver Mis Pedidos" onPress={() => router.replace("/(tabs)/cuenta")} />
        </View>
      </ScrollView>
    </View>
  );
}

function Detail({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, textTransform: "uppercase", color: c.foreground, maxWidth: "55%", textAlign: "right" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
