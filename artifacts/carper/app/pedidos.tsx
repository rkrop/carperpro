import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useApp, type OrderLine } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

export default function Pedidos() {
  const c = useColors();
  const router = useRouter();
  const { orders } = useApp();
  const cart = useCart();

  const reorder = (lines: OrderLine[]) => {
    lines.forEach((l) =>
      cart.add({ id: l.id, sku: l.sku, name: l.name, brand: "", price: l.price, image: null, categoryId: null }, l.qty),
    );
    router.push("/carrito");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader title={`Mis Pedidos · ${orders.length}`} />
      {orders.length === 0 ? (
        <EmptyState
          icon="package"
          title="Sin pedidos"
          message="Cuando hagas un pedido por WhatsApp, lo verás aquí para volver a pedirlo en un toque."
          actionLabel="Explorar Catálogo"
          onAction={() => router.replace("/(tabs)/categorias")}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={{ borderTopWidth: 1, borderColor: c.border }}>
            {orders.map((o) => {
              const firstName = o.lines[0]?.name;
              return (
                <View
                  key={o.id}
                  style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{o.folio}</Text>
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, color: c.foreground }}>{formatMXN(o.total)}</Text>
                  </View>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }} numberOfLines={1}>
                    {o.date} · {o.lines.length} {o.lines.length === 1 ? "artículo" : "artículos"} ·{" "}
                    {o.entrega === "envio" ? "Envío a domicilio" : "Recoger en tienda"}
                    {firstName ? ` · ${firstName}` : ""}
                  </Text>
                  <Pressable
                    onPress={() => reorder(o.lines)}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 14, borderWidth: 1, borderColor: c.primary, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? c.neutral50 : c.background })}
                  >
                    <Feather name="rotate-ccw" size={13} color={c.primary} />
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>Volver a pedir</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
