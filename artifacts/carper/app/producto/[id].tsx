import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton, EmptyState, Hairline, Skeleton } from "@/components/CarperUI";
import { ProductImage } from "@/components/ProductImage";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts, isWeb, WEB_BOTTOM_INSET } from "@/constants/fonts";
import { useProduct } from "@/data/catalog";
import { useApp } from "@/context/AppContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";
import { discountPct, formatMXN, stockStatus } from "@/lib/format";
import { subscribeRestock } from "@/lib/push";
import { STORE } from "@/lib/store";

// WhatsApp brand green — recognizable across the light/dark theme.
const WHATSAPP_GREEN = "#25D366";
const WHATSAPP_GREEN_PRESSED = "#1DA851";

export default function Producto() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sucursal } = useApp();
  const { data: product, isLoading, isError, error } = useProduct(id, sucursal.id || undefined);
  const cart = useCart();
  const { addRecent, toggleFavorite, isFavorite } = useApp();
  const [added, setAdded] = useState(false);
  // Back-in-stock subscription state for the out-of-stock CTA.
  const [restockState, setRestockState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (product) addRecent(product);
  }, [product?.id]);

  // Self-heal stale cart lines: if this part is in the cart at a higher qty than
  // the current known stock (e.g. stock dropped since it was added), clamp it
  // down. null stock = unknown = no cap.
  useEffect(() => {
    if (!product || product.stock == null) return;
    const line = cart.items.find((i) => i.id === product.id);
    if (line && line.qty > product.stock) cart.setQty(product.id, product.stock);
  }, [product?.id, product?.stock]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
        <ScreenHeader title="Detalle de Refacción" />
        <View style={{ width: "100%", aspectRatio: 1, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }} />
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton width="30%" height={12} />
          <Skeleton width="90%" height={26} />
          <Skeleton width="50%" height={36} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ScreenHeader title="Detalle" />
        <EmptyState
          icon="alert-circle"
          title={isError ? "Error al cargar" : "No encontrado"}
          message={isError ? (error instanceof Error ? error.message : "No se pudo cargar la refacción.") : "Esta refacción no está disponible."}
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const status = stockStatus(product.stock);
  const agotado = status === "agotado";
  const fav = isFavorite(product.id);
  const off = product.originalPrice ? discountPct(product.price, product.originalPrice) : 0;
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  // How many of this part are already in the cart, and whether we've hit the
  // known available count (null stock = unknown = no cap).
  const inCart = cart.items.find((i) => i.id === product.id)?.qty ?? 0;
  // Confirmed-0 stock is handled by the Agotado state, not the cap.
  const atCap = product.stock != null && product.stock > 0 && inCart >= product.stock;

  const onAdd = () => {
    if (atCap) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    cart.add(product);
    setAdded(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // "Avísame cuando vuelva a haber": subscribe this device to a back-in-stock
  // push for the out-of-stock part. We push only (no SMS) for restock alerts.
  const onNotifyRestock = async () => {
    if (!product || restockState !== "idle") return;
    setRestockState("loading");
    try {
      await subscribeRestock(product.id);
      setRestockState("done");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setRestockState("idle");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const message = err instanceof Error ? err.message : "No se pudo registrar el aviso.";
      Alert.alert("Aviso no registrado", message);
    }
  };

  // Contact an advisor about this part (e.g. to confirm availability when it's
  // out of stock). Prefills the WhatsApp message with the product name + SKU.
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  const consultarWhatsApp = () => {
    const msg = `Hola Carper, me interesa esta refacción: ${product.name} (SKU ${product.sku}). ¿Tienen disponibilidad?`;
    open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`);
  };
  const llamar = () => open(`tel:${STORE.phone}`);

  const statusColor =
    status === "alto"
      ? c.success
      : status === "bajo"
        ? c.primary
        : c.neutral400;
  const statusLabel =
    status === "alto"
      ? `${product.stock} en existencia`
      : status === "bajo"
        ? `Últimas ${product.stock} piezas`
        : status === "consultar"
          ? "Consultar disponibilidad"
          : "Agotado";

  return (
    <View style={{ flex: 1, backgroundColor: c.neutral50 }}>
      <ScreenHeader
        title="Detalle de Refacción"
        action={{ icon: "heart", onPress: () => toggleFavorite(product), tint: fav ? c.primary : c.foreground }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Full-bleed image */}
        <View style={{ width: "100%", aspectRatio: 1, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, position: "relative" }}>
          <ProductImage image={product.image} categoryId={product.categoryId} style={{ flex: 1 }} pad={40} iconSize={64} />
          <View style={{ position: "absolute", bottom: 16, left: 16, backgroundColor: c.foreground, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: c.background, fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{product.brand}</Text>
          </View>
          {off > 0 ? (
            <View style={{ position: "absolute", top: 16, right: 16, backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: c.primaryForeground, fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5 }}>-{off}%</Text>
            </View>
          ) : null}
        </View>

        {/* Meta */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <View style={{ backgroundColor: c.neutral100, paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>SKU {product.sku}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: statusColor }}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={{ fontFamily: Fonts.black, fontSize: 26, lineHeight: 28, letterSpacing: -1, textTransform: "uppercase", color: c.foreground, marginBottom: 24 }}>
            {product.name}
          </Text>

          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 6 }}>Precio Unitario</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 36, letterSpacing: -2, color: c.foreground }}>{formatMXN(product.price)}</Text>
            {product.originalPrice ? (
              <Text style={{ fontFamily: Fonts.mono, fontSize: 15, color: c.neutral400, textDecorationLine: "line-through" }}>{formatMXN(product.originalPrice)}</Text>
            ) : null}
          </View>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: c.mutedForeground, marginTop: 6 }}>IVA incluido</Text>
        </View>

        {/* Ask an advisor about availability via WhatsApp. Hidden when out of
            stock — the sticky CTA already surfaces WhatsApp + call there. */}
        {!agotado ? (
          <Pressable
            onPress={consultarWhatsApp}
            style={({ pressed }) => ({
              backgroundColor: c.background,
              paddingHorizontal: 24,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: WHATSAPP_GREEN, alignItems: "center", justifyContent: "center" }}>
              <Feather name="message-circle" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: c.foreground }}>Consultar por WhatsApp</Text>
              <Text style={{ fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15, color: c.mutedForeground, marginTop: 2 }}>¿Dudas de disponibilidad? Escríbele a un asesor.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.neutral400} />
          </Pressable>
        ) : null}

        {/* OEM / equivalents (optional — disappears when absent) */}
        {product.oem?.length || product.equivalents?.length ? (
          <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 14 }}>Equivalencias</Text>
            {product.oem?.length ? (
              <View style={{ marginBottom: product.equivalents?.length ? 16 : 0 }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.mutedForeground, marginBottom: 8 }}>Códigos OEM</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {product.oem.map((code) => (
                    <View key={code} style={{ borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{code}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {product.equivalents?.length ? (
              <View>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: c.mutedForeground, marginBottom: 8 }}>Números equivalentes</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {product.equivalents.map((code) => (
                    <View key={code} style={{ borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: c.foreground }}>{code}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Specs (only when the ERP provides them) */}
        {product.specs.length ? (
          <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 16 }}>Especificaciones Técnicas</Text>
            <Hairline />
            {product.specs.map((s) => (
              <View key={s.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground }}>{s.label}</Text>
                <Text style={{ fontFamily: Fonts.medium, fontSize: 11, textTransform: "uppercase", color: c.mutedForeground }}>{s.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Description from ERP — vehicle applications, OEM codes and notes live here */}
        <View style={{ backgroundColor: c.background, paddingHorizontal: 24, paddingVertical: 28 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.neutral400, marginBottom: 12 }}>Descripción</Text>
          {product.descripcion ? (
            <Text style={{ fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20, color: c.foreground }}>
              {product.descripcion}
            </Text>
          ) : (
            <Text style={{ fontFamily: Fonts.medium, fontSize: 12, lineHeight: 18, color: c.mutedForeground }}>
              Sin descripción adicional para esta refacción.
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, borderWidth: 1, borderColor: c.border, padding: 14 }}>
            <Feather name="search" size={14} color={c.neutral400} />
            <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 11, lineHeight: 16, color: c.mutedForeground }}>
              ¿Buscas para tu auto? Escribe la marca y modelo en el buscador para ver más opciones.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.border, padding: 20, paddingBottom: bottomPad }}>
        {added ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, height: 56, borderWidth: 1, borderColor: c.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
              <Feather name="check" size={16} color={c.success} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.success }}>Agregado</Text>
            </View>
            <View style={{ flex: 1 }}>
              <AccentButton label="Ver Carrito" icon="shopping-cart" onPress={() => router.push("/carrito")} />
            </View>
          </View>
        ) : atCap ? (
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, height: 56, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground, textAlign: "center" }}>
                {`Máximo disponible (${product.stock})`}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <AccentButton label="Ver Carrito" icon="shopping-cart" onPress={() => router.push("/carrito")} />
            </View>
          </View>
        ) : agotado ? (
          // Defensive: the /products/:id route applies sellableProduct(), so a
          // confirmed-0-stock part normally 404s before reaching here. Kept as a
          // fallback (e.g. stock dropping to 0 mid-view) so the shopper can still
          // reach an advisor by message or call instead of a dead "Agotado".
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15, color: c.mutedForeground, textAlign: "center" }}>
              Sin existencia en este momento. Consulta disponibilidad con un asesor.
            </Text>
            <Pressable
              onPress={onNotifyRestock}
              disabled={restockState !== "idle"}
              style={({ pressed }) => ({
                height: 56,
                borderWidth: 1,
                borderColor: restockState === "done" ? c.success : c.foreground,
                backgroundColor: restockState === "done" ? c.background : pressed ? c.neutral900 : c.foreground,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: restockState === "loading" ? 0.7 : 1,
              })}
            >
              <Feather
                name={restockState === "done" ? "check" : "bell"}
                size={16}
                color={restockState === "done" ? c.success : c.background}
              />
              <Text
                style={{
                  color: restockState === "done" ? c.success : c.background,
                  fontFamily: Fonts.bold,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {restockState === "loading"
                  ? "Registrando…"
                  : restockState === "done"
                    ? "Te avisaremos"
                    : "Avísame cuando vuelva a haber"}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={consultarWhatsApp}
                style={({ pressed }) => ({ flex: 1, height: 56, backgroundColor: pressed ? WHATSAPP_GREEN_PRESSED : WHATSAPP_GREEN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 })}
              >
                <Feather name="message-circle" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>WhatsApp</Text>
              </Pressable>
              <Pressable
                onPress={llamar}
                style={({ pressed }) => ({ flex: 1, height: 56, borderWidth: 1, borderColor: c.foreground, backgroundColor: pressed ? c.neutral100 : c.background, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 })}
              >
                <Feather name="phone" size={16} color={c.foreground} />
                <Text style={{ color: c.foreground, fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>Llamar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <AccentButton label="Agregar al Carrito" icon="shopping-cart" onPress={onAdd} />
        )}
      </View>
    </View>
  );
}
