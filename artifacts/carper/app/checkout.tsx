import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { useCreateOrder } from "@/data/catalog";
import { Order, useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";

type Entrega = "tienda" | "envio";
type Pago = "tarjeta" | "oxxo" | "spei" | "recoleccion";

const PAGOS: { id: Pago; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "tarjeta", label: "Tarjeta", sub: "Crédito o débito", icon: "credit-card" },
  { id: "oxxo", label: "OXXO / Efectivo", sub: "Paga en tienda de conveniencia", icon: "dollar-sign" },
  { id: "spei", label: "Transferencia SPEI", sub: "Depósito interbancario", icon: "repeat" },
  { id: "recoleccion", label: "Pago en recolección", sub: "Paga al recoger en sucursal", icon: "shopping-bag" },
];

export default function Checkout() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { sucursal, addOrder } = useApp();
  const createOrder = useCreateOrder();
  const [step, setStep] = useState(0);
  const [entrega, setEntrega] = useState<Entrega>("tienda");
  const [pago, setPago] = useState<Pago | null>(null);
  const [address, setAddress] = useState("");
  const submitting = createOrder.isPending;
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  const steps = ["Entrega", "Pago", "Resumen"];
  const canNext = step === 0 ? entrega === "tienda" || address.trim().length > 5 : step === 1 ? pago !== null : true;

  const next = () => {
    if (!canNext) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (step < 2) setStep(step + 1);
    else confirm();
  };

  const confirm = async () => {
    const pagoLabel = PAGOS.find((x) => x.id === pago)?.label ?? "";
    try {
      const result = await createOrder.mutateAsync({
        data: {
          lines: cart.items.map((i) => ({ productId: i.id, sku: i.sku, name: i.name, qty: i.qty, price: i.price })),
          sucursalId: sucursal.id,
          entrega,
          pago: pagoLabel,
          total: cart.total,
        },
      });
      const order: Order = {
        id: String(result.id),
        folio: result.folio,
        date: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
        total: cart.total,
        lines: cart.items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, qty: i.qty, price: i.price })),
        entrega,
        sucursalId: sucursal.id,
        pago: pagoLabel,
      };
      addOrder(order);
      cart.clear();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/confirmacion?folio=${order.folio}`);
    } catch (err) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "No se pudo enviar el pedido. Intenta de nuevo.";
      Alert.alert("Error al confirmar", message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Finalizar Compra" onBack={() => (step > 0 ? setStep(step - 1) : router.back())} />

      {/* Stepper */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border }}>
        {steps.map((label, i) => (
          <View key={label} style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRightWidth: i < 2 ? 1 : 0, borderRightColor: c.border, backgroundColor: i === step ? c.foreground : c.background }}>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: i === step ? c.background : i < step ? c.primary : c.neutral400, marginBottom: 4 }}>0{i + 1}</Text>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: i === step ? c.background : c.foreground }}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>
        {step === 0 ? (
          <>
            <Text style={{ fontFamily: Fonts.black, fontSize: 22, letterSpacing: -0.8, textTransform: "uppercase", color: c.foreground, marginBottom: 20 }}>Método de Entrega</Text>
            <SelectCard active={entrega === "tienda"} icon="map-pin" title="Recoger en Sucursal" sub={`${sucursal.name} · ${sucursal.hours}`} onPress={() => setEntrega("tienda")} />
            <View style={{ height: 12 }} />
            <SelectCard active={entrega === "envio"} icon="truck" title="Envío a Domicilio" sub="2 a 4 días hábiles" onPress={() => setEntrega("envio")} />
            {entrega === "envio" ? (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 10 }}>Dirección de Envío</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Calle, número, colonia, CP"
                  placeholderTextColor={c.neutral400}
                  multiline
                  style={{ borderWidth: 1, borderColor: c.border, padding: 16, minHeight: 90, fontFamily: Fonts.medium, fontSize: 14, color: c.foreground, textAlignVertical: "top" }}
                />
              </View>
            ) : null}
          </>
        ) : step === 1 ? (
          <>
            <Text style={{ fontFamily: Fonts.black, fontSize: 22, letterSpacing: -0.8, textTransform: "uppercase", color: c.foreground, marginBottom: 20 }}>Método de Pago</Text>
            {PAGOS.map((p, i) => (
              <View key={p.id} style={{ marginBottom: i < PAGOS.length - 1 ? 12 : 0 }}>
                <SelectCard active={pago === p.id} icon={p.icon} title={p.label} sub={p.sub} onPress={() => setPago(p.id)} />
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={{ fontFamily: Fonts.black, fontSize: 22, letterSpacing: -0.8, textTransform: "uppercase", color: c.foreground, marginBottom: 20 }}>Resumen</Text>
            <View style={{ borderWidth: 1, borderColor: c.border }}>
              {cart.items.map((it, i) => {
                return (
                  <View key={it.id} style={{ flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: i < cart.items.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 11, textTransform: "uppercase", color: c.foreground }} numberOfLines={1}>{it.name}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: c.mutedForeground, marginTop: 2 }}>{it.qty} × {formatMXN(it.price)}</Text>
                    </View>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{formatMXN(it.price * it.qty)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: 20, gap: 8 }}>
              <Line label="Entrega" value={entrega === "tienda" ? sucursal.name : "Envío a domicilio"} c={c} />
              <Line label="Pago" value={PAGOS.find((x) => x.id === pago)?.label ?? "—"} c={c} />
              <Line label="Subtotal" value={formatMXN(cart.base)} c={c} />
              <Line label="IVA (16%)" value={formatMXN(cart.iva)} c={c} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={{ fontFamily: Fonts.black, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Total</Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 20, letterSpacing: -0.8, color: c.foreground }}>{formatMXN(cart.total)}</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, padding: 20, paddingBottom: bottomPad }}>
        <AccentButton
          label={step < 2 ? "Continuar" : "Confirmar Compra"}
          icon={step < 2 ? "arrow-right" : "check"}
          onPress={next}
          disabled={!canNext}
          loading={submitting}
        />
      </View>
    </View>
  );
}

function SelectCard({ active, icon, title, sub, onPress }: { active: boolean; icon: keyof typeof Feather.glyphMap; title: string; sub: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 16, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.background, padding: 18 }}>
      <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: active ? c.primary : c.border, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={18} color={active ? c.primary : c.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 13, letterSpacing: -0.2, textTransform: "uppercase", color: active ? c.primary : c.foreground }}>{title}</Text>
        <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.background, alignItems: "center", justifyContent: "center" }}>
        {active ? <Feather name="check" size={12} color={c.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

function Line({ label, value, c }: { label: string; value: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground, maxWidth: "55%", textAlign: "right" }} numberOfLines={1}>{value}</Text>
    </View>
  );
}
