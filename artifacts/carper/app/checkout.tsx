import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import {
  getGetMeQueryKey,
  getListAddressesQueryKey,
  getPostalCode,
  useCreateOrder,
  useGetMe,
  useListAddresses,
} from "@workspace/api-client-react";
import type { ShippingAddressInput } from "@/lib/stripeCheckout";

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
  referencias: string;
  mapsUrl: string;
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
  if (opts.entrega === "tienda") {
    lines.push("*Entrega:* Recoger en tienda");
  } else {
    lines.push("*Entrega:* Envío a domicilio");
    lines.push(`Dirección: ${opts.address}`);
    if (opts.referencias) lines.push(`Referencias: ${opts.referencias}`);
    if (opts.mapsUrl) lines.push(`📍 Ubicación: ${opts.mapsUrl}`);
  }
  lines.push(`*Pago:* ${opts.pagoLabel}`);
  lines.push("");
  lines.push(`*Cliente:* ${opts.name}`);
  lines.push(`*Teléfono:* ${opts.phone}`);
  return lines.join("\n");
}

// A cancelled order means a part sold out during the payment window. If the
// refund went through automatically we say so; otherwise we tell the buyer the
// store will reach out (staff follows up via the WhatsApp number on file).
function soldOutMessage(order: VerifiedOrder): string {
  return order.paymentStatus === "refunded"
    ? "Uno o más productos se agotaron justo antes de completar tu compra. Tu pago fue reembolsado automáticamente a tu tarjeta."
    : "Uno o más productos se agotaron justo antes de completar tu compra. Cancelamos el pedido y procesaremos tu reembolso; te contactaremos para confirmarlo.";
}

// A paid order is only truly done once it has been queued/sent to the ERP.
// "awaiting_payment"/"fulfilling" mean we're still re-confirming stock.
function isFulfilled(order: VerifiedOrder): boolean {
  return order.status === "pending" || order.status === "sent";
}

const VERIFYING_MESSAGE =
  "Recibimos tu pago. Estamos confirmando la disponibilidad final con la tienda y te avisaremos en breve.";

// Shape of the 409 body POST /orders returns when a cash/SPEI order asks for
// more units than are available.
interface StockShortfallItem {
  productId: string;
  sku: string;
  name: string;
  requested: number;
  available: number;
}

// When createOrder rejects, detect the stock shortfall (HTTP 409) and build an
// itemized message. The generated client throws an ApiError carrying `status`
// and the parsed `data` body, so we duck-type rather than import the class.
// Matches the card/Stripe shortfall wording ("Algunos productos ya no están
// disponibles… Actualiza tu carrito e inténtalo de nuevo") and adds the
// per-product "solo quedan X" detail.
function stockShortfallMessage(err: unknown): string | null {
  const e = err as { status?: number; data?: { items?: StockShortfallItem[] } } | null;
  if (!e || e.status !== 409) return null;
  const items = e.data?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const detail = items
    .map((it) => `• ${it.name}: solo quedan ${it.available}`)
    .join("\n");
  return (
    "Algunos productos ya no están disponibles en la cantidad solicitada:\n\n" +
    `${detail}\n\n` +
    "Actualiza tu carrito e inténtalo de nuevo."
  );
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
  const createOrder = useCreateOrder();
  const [step, setStep] = useState(0);
  const [entrega, setEntrega] = useState<Entrega>("tienda");
  const [pago, setPago] = useState<Pago | null>(null);
  // Structured home-delivery address.
  const [calle, setCalle] = useState("");
  const [numExt, setNumExt] = useState("");
  const [numInt, setNumInt] = useState("");
  const [cp, setCp] = useState("");
  const [colonia, setColonia] = useState("");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [referencias, setReferencias] = useState("");
  const [colonias, setColonias] = useState<string[]>([]);
  const [cpLoading, setCpLoading] = useState(false);
  // GPS coords from the device; cpCentroid is the approximate CP location used
  // as a fallback for the driver's map link when GPS isn't shared.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cpCentroid, setCpCentroid] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  // Prefill from the signed-in user's saved default address + profile. Only
  // fills blank fields so it never clobbers what the shopper is typing.
  const { isSignedIn } = useAuth();
  const addressesQuery = useListAddresses({
    query: { queryKey: getListAddressesQueryKey(), enabled: !!isSignedIn },
  });
  const meQuery = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn } });
  // Each source prefills independently the moment its own query settles, so a
  // slower /me/addresses can't be skipped by a faster /me (and vice versa). We
  // never auto-switch the delivery mode — the fields just sit ready in case the
  // shopper picks "envío" — and we only fill blanks so typing is never clobbered.
  const addrPrefilledRef = useRef(false);
  const profilePrefilledRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn) return;
    if (!addrPrefilledRef.current && addressesQuery.data) {
      addrPrefilledRef.current = true;
      const def = addressesQuery.data.find((a) => a.isDefault) ?? addressesQuery.data[0];
      if (def) {
        const a = def.address;
        setCalle((v) => v || a.calle);
        setNumExt((v) => v || a.numExterior);
        setNumInt((v) => v || a.numInterior || "");
        setCp((v) => v || a.cp);
        setColonia((v) => v || a.colonia);
        setEstado((v) => v || a.estado || "");
        setMunicipio((v) => v || a.municipio || "");
        setReferencias((v) => v || a.referencias || "");
      }
    }
    if (!profilePrefilledRef.current && meQuery.data) {
      profilePrefilledRef.current = true;
      const me = meQuery.data;
      if (me.name) setName((v) => v || me.name || "");
      if (me.phone) setPhone((v) => v || me.phone || "");
    }
  }, [isSignedIn, addressesQuery.data, meQuery.data]);

  // Look up colonias + estado + centroid for a 5-digit CP (free, server-proxied).
  // A monotonic request id guards against out-of-order responses: a slower reply
  // for an old CP must never overwrite state for a newer one.
  const cpReqId = useRef(0);
  const lookupCp = async (raw: string) => {
    const clean = raw.replace(/\D/g, "").slice(0, 5);
    setCp(clean);
    // Any CP edit invalidates previously derived geo context so the map pin and
    // estado/municipio never silently mismatch the current CP.
    const reqId = ++cpReqId.current;
    setColonias([]);
    setEstado("");
    setMunicipio("");
    setCpCentroid(null);
    if (clean.length !== 5) {
      setCpLoading(false);
      return;
    }
    setCpLoading(true);
    try {
      const data = await getPostalCode(clean);
      if (reqId !== cpReqId.current) return; // a newer CP edit superseded this one
      setColonias(data.colonias ?? []);
      if (data.estado) setEstado(data.estado);
      if (data.municipio) setMunicipio(data.municipio);
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        setCpCentroid({ lat: data.lat, lng: data.lng });
      }
      // Auto-select when the CP maps to a single colonia.
      if ((data.colonias?.length ?? 0) === 1) setColonia(data.colonias[0]);
    } catch {
      if (reqId === cpReqId.current) setColonias([]);
    } finally {
      if (reqId === cpReqId.current) setCpLoading(false);
    }
  };

  // Capture the device GPS and (best-effort) prefill empty address fields.
  const useMyLocation = async () => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso de ubicación",
          "Activa el permiso de ubicación para compartir tu posición exacta con el repartidor.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(ll);
      if (Platform.OS !== "web") Haptics.selectionAsync();
      // Reverse geocode is best-effort (unsupported on web) — never blocks.
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: ll.lat, longitude: ll.lng });
        const g = geo[0];
        if (g) {
          if (!calle.trim() && g.street) setCalle(g.street);
          if (!numExt.trim() && g.streetNumber) setNumExt(g.streetNumber);
          if (!colonia.trim() && (g.district || g.subregion)) {
            setColonia(g.district || g.subregion || "");
          }
          if (!estado.trim() && g.region) setEstado(g.region);
          if (!municipio.trim() && g.city) setMunicipio(g.city);
          if (cp.trim().length !== 5 && g.postalCode) lookupCp(g.postalCode);
        }
      } catch {
        // reverse geocode unavailable — coords alone still give a precise pin.
      }
    } catch {
      Alert.alert(
        "Ubicación",
        "No pudimos obtener tu ubicación. Intenta de nuevo o escribe tu dirección manualmente.",
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const pin = coords ?? cpCentroid;
  const addressLine = (): string =>
    [
      `${calle.trim()} ${numExt.trim()}${numInt.trim() ? ` int ${numInt.trim()}` : ""}`.trim(),
      colonia.trim() ? `Col. ${colonia.trim()}` : "",
      cp.trim() ? `CP ${cp.trim()}` : "",
      municipio.trim(),
      estado.trim(),
    ]
      .filter(Boolean)
      .join(", ");
  const buildMapsUrl = (): string => {
    if (pin) return `https://maps.google.com/?q=${pin.lat},${pin.lng}`;
    const q = addressLine();
    return q ? `https://maps.google.com/?q=${encodeURIComponent(`${q}, México`)}` : "";
  };
  const buildShippingAddress = (): ShippingAddressInput => ({
    calle: calle.trim(),
    numExterior: numExt.trim(),
    numInterior: numInt.trim() || undefined,
    colonia: colonia.trim(),
    cp: cp.trim(),
    municipio: municipio.trim() || undefined,
    estado: estado.trim() || undefined,
    referencias: referencias.trim() || undefined,
    lat: pin?.lat,
    lng: pin?.lng,
    mapsUrl: buildMapsUrl() || undefined,
  });

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
        if (order && order.status === "cancelled") {
          // Sold out during payment — never treat as a successful purchase, even
          // if paymentStatus is still "paid" (refund pending).
          cart.clear();
          Alert.alert("Producto agotado", soldOutMessage(order));
        } else if (order && order.paymentStatus === "paid" && isFulfilled(order)) {
          addOrder(verifiedToOrder(order));
          cart.clear();
          router.replace(`/confirmacion?folio=${order.folio}`);
        } else if (order && order.paymentStatus === "paid") {
          // Paid but stock not yet re-confirmed (ERP unreachable post-payment):
          // don't show "confirmed" — fulfillment is still being verified.
          cart.clear();
          Alert.alert("Pago recibido", VERIFYING_MESSAGE);
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
  const envioReady =
    calle.trim().length > 1 &&
    numExt.trim().length > 0 &&
    /^\d{5}$/.test(cp.trim()) &&
    colonia.trim().length > 1;
  const canNext =
    step === 0
      ? entrega === "tienda" || envioReady
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
          shippingAddress: entrega === "envio" ? buildShippingAddress() : undefined,
        });
        if (result.mode === "native") {
          // Browser closed — verify authoritatively before confirming.
          const order = await verifyPayment(result.orderId);
          if (order && order.status === "cancelled") {
            // Sold out during payment — never treat as a successful purchase,
            // even if paymentStatus is still "paid" (refund pending).
            cart.clear();
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Producto agotado", soldOutMessage(order));
          } else if (order && order.paymentStatus === "paid" && isFulfilled(order)) {
            addOrder(verifiedToOrder(order));
            cart.clear();
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace(`/confirmacion?folio=${order.folio}`);
          } else if (order && order.paymentStatus === "paid") {
            // Paid but stock not yet re-confirmed (ERP unreachable post-payment).
            cart.clear();
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("Pago recibido", VERIFYING_MESSAGE);
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

    // Cash / SPEI (WhatsApp): submit the order to the server FIRST so its stock
    // guard can reject over-ordered lines before we open WhatsApp. A 409 carries
    // the affected products and their available counts; surface that itemized
    // message and route the shopper back to fix their cart.
    let folio: string;
    try {
      const created = await createOrder.mutateAsync({
        data: {
          lines: cart.items.map((i) => ({
            productId: i.id,
            sku: i.sku,
            name: i.name,
            qty: i.qty,
            price: i.price,
          })),
          sucursalId: STORE.id,
          entrega,
          pago: pago ?? "efectivo",
          total: cart.total,
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
          shippingAddress: entrega === "envio" ? buildShippingAddress() : undefined,
        },
      });
      folio = created.folio;
    } catch (err) {
      setSubmitting(false);
      const shortfall = stockShortfallMessage(err);
      if (shortfall) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Revisa tu carrito", shortfall, [
          { text: "Ver carrito", onPress: () => router.replace("/carrito") },
        ]);
        return;
      }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "No se pudo enviar el pedido. Intenta de nuevo.";
      Alert.alert("Error al enviar", message);
      return;
    }

    try {
      const text = buildWhatsAppMessage({
        folio,
        items: cart.items.map((i) => ({ name: i.name, sku: i.sku, qty: i.qty, price: i.price })),
        total: cart.total,
        entrega,
        address: addressLine(),
        referencias: referencias.trim(),
        mapsUrl: buildMapsUrl(),
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
              <View style={{ marginTop: 20, gap: 14 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>Dirección de Envío</Text>

                {/* GPS — share an exact pin with the driver */}
                <Pressable
                  onPress={useMyLocation}
                  disabled={gpsLoading}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: coords ? c.primary : c.border, backgroundColor: coords ? c.primarySoft : c.background, padding: 16 }}
                >
                  <View style={{ width: 40, height: 40, borderWidth: 1, borderColor: coords ? c.primary : c.border, alignItems: "center", justifyContent: "center" }}>
                    <Feather name="navigation" size={18} color={coords ? c.primary : c.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 13, letterSpacing: -0.2, textTransform: "uppercase", color: coords ? c.primary : c.foreground }}>
                      {coords ? "Ubicación capturada" : "Usar mi ubicación actual"}
                    </Text>
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                      {coords ? "El repartidor recibirá un mapa exacto" : "Comparte tu GPS para una entrega precisa"}
                    </Text>
                  </View>
                  {gpsLoading ? (
                    <ActivityIndicator color={c.primary} />
                  ) : coords ? (
                    <Feather name="check-circle" size={18} color={c.primary} />
                  ) : (
                    <Feather name="chevron-right" size={18} color={c.neutral400} />
                  )}
                </Pressable>

                <FormInput label="Calle" value={calle} onChangeText={setCalle} placeholder="Ej. Av. Constitución" c={c} />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FormInput label="Núm. exterior" value={numExt} onChangeText={setNumExt} placeholder="123" keyboardType="numbers-and-punctuation" c={c} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormInput label="Interior (opcional)" value={numInt} onChangeText={setNumInt} placeholder="Depto 4" c={c} />
                  </View>
                </View>

                <View>
                  <FormInput label="Código postal" value={cp} onChangeText={lookupCp} placeholder="64000" keyboardType="number-pad" maxLength={5} c={c} />
                  {cpLoading ? (
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 6 }}>Buscando colonias…</Text>
                  ) : estado ? (
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground, marginTop: 6 }}>
                      {municipio ? `${municipio}, ` : ""}{estado}
                    </Text>
                  ) : null}
                </View>

                {colonias.length > 0 ? (
                  <View>
                    <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>Elige tu colonia</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {colonias.map((col) => (
                        <Chip key={col} label={col} active={colonia === col} onPress={() => setColonia(col)} c={c} />
                      ))}
                    </View>
                  </View>
                ) : null}

                <FormInput label="Colonia" value={colonia} onChangeText={setColonia} placeholder="Colonia" c={c} />

                <FormInput
                  label="Referencias"
                  value={referencias}
                  onChangeText={setReferencias}
                  placeholder="Entre calles, color de fachada, indicaciones para llegar…"
                  multiline
                  c={c}
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

            {entrega === "envio" ? (
              <View style={{ marginTop: 20, borderWidth: 1, borderColor: c.border, padding: 16, gap: 6 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400 }}>Enviar a</Text>
                <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.foreground }}>{addressLine()}</Text>
                {referencias.trim() ? (
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.mutedForeground }}>Ref: {referencias.trim()}</Text>
                ) : null}
                {coords ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Feather name="navigation" size={12} color={c.primary} />
                    <Text style={{ fontFamily: Fonts.medium, fontSize: 11, color: c.primary }}>Ubicación GPS adjunta</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

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

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  c,
  multiline,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  c: ReturnType<typeof useColors>;
  multiline?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  maxLength?: number;
}) {
  return (
    <View>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 8 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.neutral400}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={{ borderWidth: 1, borderColor: c.border, padding: 16, minHeight: multiline ? 80 : undefined, fontFamily: Fonts.medium, fontSize: 14, color: c.foreground, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

function Chip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.background, paddingHorizontal: 14, paddingVertical: 9 }}>
      <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: active ? c.primary : c.foreground }}>{label}</Text>
    </Pressable>
  );
}
