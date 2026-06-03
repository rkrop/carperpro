import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, EmptyState } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { useApp, type OrderLine } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

const IVA_RATE = 0.16;

export default function PedidoDetalle() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { folio } = useLocalSearchParams<{ folio: string }>();
  const { orders } = useApp();
  const cart = useCart();
  const order = orders.find((o) => o.folio === folio);
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  const reorder = (lines: OrderLine[]) => {
    lines.forEach((l) =>
      cart.add({ id: l.id, sku: l.sku, name: l.name, brand: "", price: l.price, image: null, categoryId: null, stock: null }, l.qty),
    );
    router.push("/carrito");
  };

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
        <ScreenHeader title="Detalle del Pedido" />
        <EmptyState
          icon="package"
          title="Pedido no encontrado"
          message="No pudimos encontrar este pedido. Vuelve a Mis Pedidos para verlo."
          actionLabel="Mis Pedidos"
          onAction={() => router.replace("/pedidos")}
        />
      </View>
    );
  }

  const base = order.total / (1 + IVA_RATE);
  const iva = order.total - base;
  const totalUnits = order.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title="Detalle del Pedido" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>
        {/* Header: folio + meta */}
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>Folio</Text>
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, color: c.foreground }}>{order.folio}</Text>
          </View>
          <Detail label="Fecha" value={order.date} c={c} />
          <Detail
            label="Entrega"
            value={order.entrega === "tienda" ? "Recoger en tienda" : "Envío a domicilio"}
            c={c}
          />
          <Detail label="Pago" value={order.pago} c={c} last />
        </View>

        {/* Items */}
        <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginTop: 28, marginBottom: 12 }}>
          Artículos · {totalUnits}
        </Text>
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
          {order.lines.map((l, i) => (
            <View
              key={l.id}
              style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: i < order.lines.length - 1 ? 1 : 0, borderBottomColor: c.border }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 11, textTransform: "uppercase", color: c.foreground }} numberOfLines={2}>{l.name}</Text>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 4 }}>{l.sku}</Text>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 2 }}>{l.qty} × {formatMXN(l.price)}</Text>
              </View>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{formatMXN(l.price * l.qty)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ marginTop: 24, gap: 8 }}>
          <Line label="Subtotal" value={formatMXN(base)} c={c} />
          <Line label="IVA (16%)" value={formatMXN(iva)} c={c} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
          <Text style={{ fontFamily: Fonts.black, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Total</Text>
          <Text style={{ fontFamily: Fonts.monoBold, fontSize: 20, letterSpacing: -0.8, color: c.foreground }}>{formatMXN(order.total)}</Text>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, padding: 20, paddingBottom: bottomPad }}>
        <AccentButton label="Volver a Pedir" icon="rotate-ccw" onPress={() => reorder(order.lines)} />
      </View>
    </View>
  );
}

function Detail({ label, value, c, last }: { label: string; value: string; c: ReturnType<typeof useColors>; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 18, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, textTransform: "uppercase", color: c.foreground, maxWidth: "55%", textAlign: "right" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Line({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{value}</Text>
    </View>
  );
}
