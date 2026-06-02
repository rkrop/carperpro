import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { Order, useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { formatMXN } from "@/lib/format";
import { STORE } from "@/lib/store";
import { startCardCheckout, verifyPayment, type VerifiedOrder } from "@/lib/stripeCheckout";

type Entrega = "tienda" | "envio";
type Pago = "efectivo" | "tarjeta" | "spei";

const PAGOS: { id: Pago; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "efectivo", label: "Efectivo", sub: "Paga al recoger o al recibir", icon: "dollar-sign" },
  { id: "tarjeta", label: "Tarjeta", sub: "Crédito o débito", icon: "credit-card" },
  { id: "spei", label: "Transferencia SPEI", sub: "Depósito interbancario", icon: "repeat" },
];

function buildWhatsAppMessage(opts: {
  folio: string;
  items: { name: string; sku: string; qty: number; price: number }[];
  total: number;
  entrega: Entrega;
  address: string;
  pagoLabel: string;
  name: string;
  phone: string;
}): string {
  const lines: string[] = [];
  lines.push(`*Nuevo pedido — ${STORE.name}*`);
  lines.push(`Folio: ${opts.folio}`);
  lines.push("");
  lines.push("*Productos:*");
  for (const it of opts.items) {
    lines.push(`• ${it.qty} × ${it.name} (${it.sku}) — ${formatMXN(it.price * it.qty)}`);
  }
  lines.push("");
  lines.push(`*Total: ${formatMXN(opts.total)}* (IVA incluido)`);
  lines.push("");
  lines.push(
    opts.entrega === "tienda"
      ? "*Entrega:* Recoger en tienda"
      : `*Entrega:* Envío a domicilio\nDirección: ${opts.address}`,
  );
  lines.push(`*Pago:* ${opts.pagoLabel}`);
  lines.push("");
  lines.push(`*Cliente:* ${opts.name}`);
  lines.push(`*Teléfono:* ${opts.phone}`);
  return lines.join("\n");
}

function verifiedToOrder(v: VerifiedOrder): Order {
  return {
    id: v.folio,
    folio: v.folio,
    date: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
    total: v.total,
    lines: v.lines.map((l) => ({ id: l.id, name: l.name, sku: l.sku, qty: l.qty, price: l.price })),
    entrega: v.entrega === "envio" ? "envio" : "tienda",
    pago: v.pago,
  };
}

export default function Checkout() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { addOrder } = useApp();
  const [step, setStep] = useState(0);
  const [entrega, setEntrega] = useState<Entrega>("tienda");
  const [pago, setPago] = useState<Pago | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  // Web: after Stripe redirects back to this page, verify the pending order.
  const webReturnHandled = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "web" || webReturnHandled.current) return;
    let orderId: number | null = null;
    let status: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      status = params.get("status");
      const fromQuery = params.get("order");
      const fromStore = window.sessionStorage.getItem("carper_stripe_order");
      orderId = fromQuery ? Number(fromQuery) : fromStore ? Number(fromStore) : null;
    } catch {
      return;
    }
    if (!orderId || !Number.isFinite(orderId)) return;
    webReturnHandled.current = true;

    // Clean the URL so a refresh doesn't re-trigger verification.
    try {
      window.history.replaceState({}, "", window.location.pathname);
      window.sessionStorage.removeItem("carper_stripe_order");
    } catch {
      // best-effort
    }

    if (status === "cancel") {
      Alert.alert("Pago cancelado", "No se completó el pago con tarjeta. Puedes intentar de nuevo.");
      return;
    }

    setSubmitting(true);
    verifyPayment(orderId)
      .then((order) => {
        if (order && order.paymentStatus === "paid") {
          addOrder(verifiedToOrder(order));
          cart.clear();
          router.replace(`/confirmacion?folio=${order.folio}`);
        } else {
          Alert.alert("Pago pendiente", "Aún no confirmamos tu pago. Si ya pagaste, espera unos minutos.");
        }
      })
      .catch(() => {
        Alert.alert("Error", "No se pudo verificar el pago. Intenta de nuevo.");
      })
      .finally(() => setSubmitting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = ["Entrega", "Pago", "Resumen"];
  const canNext =
    step === 0
      ? entrega === "tienda" || address.trim().length > 5
      : step === 1
        ? pago !== null
        : name.trim().length > 1 && phone.trim().length >= 10 && cart.items.length > 0;

  const next = () => {
    if (!canNext) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    if (step < 2) setStep(step + 1);
    else confirm();
  };

  const confirm = async () => {
    if (submitting) return;
    if (cart.items.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de enviar tu pedido.", [
        { text: "Ver carrito", onPress: () => router.replace("/carrito") },
      ]);
      return;
    }
    setSubmitting(true);
    const pagoLabel = PAGOS.find((x) => x.id === pago)?.label ?? "";

    // Card payments go through Stripe; efectivo/spei keep the WhatsApp flow.
    if (pago === "tarjeta") {
      try {
        const result = await startCardCheckout({
          entrega,
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
          lines: cart.items.map((i) => ({ productId: i.id, qty: i.qty })),
        });
        if (result.mode === "native") {
          // Browser closed — verify authoritatively before confirming.
          const order = await verifyPayment(result.orderId);
          if (order && order.paymentStatus === "paid") {
            addOrder(verifiedToOrder(order));
            cart.clear();
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace(`/confirmacion?folio=${order.folio}`);
          } else {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Pago no completado", "No confirmamos tu pago con tarjeta. Si ya pagaste, espera unos minutos o intenta de nuevo.");
          }
        }
        // web-redirect: the page navigated to Stripe; verification runs on return.
      } catch (err) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const message = err instanceof Error ? err.message : "No se pudo iniciar el pago con tarjeta.";
        Alert.alert("Error de pago", message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const folio = `CAR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    try {
      const text = buildWhatsAppMessage({
        folio,
        items: cart.items.map((i) => ({ name: i.name, sku: i.sku, qty: i.qty, price: i.price })),
        total: cart.total,
        entrega,
        address: address.trim(),
        pagoLabel,
        name: name.trim(),
        phone: phone.trim(),
      });
      const encoded = encodeURIComponent(text);
      // Prefer the native WhatsApp app; fall back to the wa.me web link.
      const nativeUrl = `whatsapp://send?phone=${STORE.whatsapp}&text=${encoded}`;
      const webUrl = `https://wa.me/${STORE.whatsapp}?text=${encoded}`;
      let opened = false;
      try {
        if (await Linking.canOpenURL(nativeUrl)) {
          await Linking.openURL(nativeUrl);
          opened = true;
        }
      } catch {
        // fall through to the web link
      }
      if (!opened) await Linking.openURL(webUrl);

      const order: Order = {
        id: folio,
        folio,
        date: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }),
        total: cart.total,
        lines: cart.items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, qty: i.qty, price: i.price })),
        entrega,
        pago: pagoLabel,
      };
      addOrder(order);
      cart.clear();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/confirmacion?folio=${order.folio}`);
    } catch (err) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "No se pudo enviar el pedido. Intenta de nuevo.";
      Alert.alert("Error al enviar", message);
    } finally {
      setSubmitting(false);
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
            <SelectCard active={entrega === "tienda"} icon="map-pin" title="Recoger en Tienda" sub={`${STORE.name} · ${STORE.hours}`} onPress={() => setEntrega("tienda")} />
            <View style={{ height: 12 }} />
            <SelectCard active={entrega === "envio"} icon="truck" title="Envío a Domicilio" sub={`Gratis · ${STORE.delivery.eta} · ${STORE.delivery.zona}`} onPress={() => setEntrega("envio")} />
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

            {/* Customer contact */}
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 10 }}>Tus Datos</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nombre completo"
                placeholderTextColor={c.neutral400}
                style={{ borderWidth: 1, borderColor: c.border, padding: 16, fontFamily: Fonts.medium, fontSize: 14, color: c.foreground, marginBottom: 12 }}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Teléfono / WhatsApp"
                placeholderTextColor={c.neutral400}
                keyboardType="phone-pad"
                style={{ borderWidth: 1, borderColor: c.border, padding: 16, fontFamily: Fonts.medium, fontSize: 14, color: c.foreground }}
              />
            </View>

            <View style={{ marginTop: 20, gap: 8 }}>
              <Line label="Entrega" value={entrega === "tienda" ? "Recoger en tienda" : "Envío a domicilio"} c={c} />
              <Line label="Pago" value={PAGOS.find((x) => x.id === pago)?.label ?? "—"} c={c} />
              <Line label="Subtotal" value={formatMXN(cart.base)} c={c} />
              <Line label="IVA (16%)" value={formatMXN(cart.iva)} c={c} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border }}>
              <Text style={{ fontFamily: Fonts.black, fontSize: 16, letterSpacing: -0.3, textTransform: "uppercase", color: c.foreground }}>Total</Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 20, letterSpacing: -0.8, color: c.foreground }}>{formatMXN(cart.total)}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, borderWidth: 1, borderColor: c.border, padding: 14 }}>
              <Feather name={pago === "tarjeta" ? "credit-card" : "message-circle"} size={16} color={c.primary} />
              <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.3, color: c.mutedForeground }}>
                {pago === "tarjeta"
                  ? "Pagarás de forma segura con tarjeta. Al confirmar el pago coordinaremos la entrega contigo."
                  : "Tu pedido se enviará por WhatsApp a Carper Autopartes para confirmar disponibilidad y entrega."}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, padding: 20, paddingBottom: bottomPad }}>
        <AccentButton
          label={step < 2 ? "Continuar" : pago === "tarjeta" ? "Pagar con Tarjeta" : "Enviar Pedido por WhatsApp"}
          icon={step < 2 ? "arrow-right" : pago === "tarjeta" ? "credit-card" : "message-circle"}
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
