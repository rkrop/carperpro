import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { AccentButton, OutlineButton } from "@/components/CarperUI";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { PRODUCTS } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

export default function Escanear() {
  const c = useColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const [scanned, setScanned] = useState(false);

  const goToRandom = () => {
    if (handled.current) return;
    handled.current = true;
    setScanned(true);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const pick = PRODUCTS[Math.floor(Math.random() * 3)]; // resolves to a real catalog SKU
    setTimeout(() => router.replace(`/producto/${pick.id}`), 450);
  };

  const Overlay = () => (
    <>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 240, height: 240, borderWidth: scanned ? 2 : 1, borderColor: scanned ? c.success : c.primary }}>
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <View
              key={corner}
              style={{
                position: "absolute",
                width: 28,
                height: 28,
                borderColor: scanned ? c.success : c.background,
                borderTopWidth: corner[0] === "t" ? 3 : 0,
                borderBottomWidth: corner[0] === "b" ? 3 : 0,
                borderLeftWidth: corner[1] === "l" ? 3 : 0,
                borderRightWidth: corner[1] === "r" ? 3 : 0,
                top: corner[0] === "t" ? -1 : undefined,
                bottom: corner[0] === "b" ? -1 : undefined,
                left: corner[1] === "l" ? -1 : undefined,
                right: corner[1] === "r" ? -1 : undefined,
              }}
            />
          ))}
        </View>
        <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.background, marginTop: 24, textAlign: "center" }}>
          {scanned ? "Refacción detectada" : "Centra el código de barras"}
        </Text>
      </View>
      <View style={{ position: "absolute", bottom: 40, left: 24, right: 24 }}>
        <AccentButton label="Simular Escaneo" icon="zap" onPress={goToRandom} />
      </View>
    </>
  );

  // Web or permission not yet granted → fallback panel.
  if (Platform.OS === "web" || !permission || !permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.foreground }}>
        <ScreenHeader title="Escanear Refacción" action={{ icon: "x", onPress: () => router.back() }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <View style={{ width: 220, height: 220, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <Feather name="maximize" size={48} color={c.background} />
          </View>
          <Text style={{ fontFamily: Fonts.black, fontSize: 20, letterSpacing: -0.5, textTransform: "uppercase", color: c.background, textAlign: "center", marginBottom: 10 }}>
            Escanea el código
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.neutral400, textAlign: "center", lineHeight: 19, marginBottom: 28 }}>
            {Platform.OS === "web"
              ? "El escáner usa la cámara del equipo. Simula un escaneo para probar el flujo."
              : "Necesitamos acceso a tu cámara para leer el código de barras de la refacción."}
          </Text>
          <View style={{ alignSelf: "stretch", gap: 12 }}>
            {Platform.OS !== "web" && permission && !permission.granted ? (
              <AccentButton label="Permitir Cámara" icon="camera" onPress={requestPermission} />
            ) : null}
            <View style={{ borderColor: c.background }}>
              <Pressable
                onPress={goToRandom}
                style={({ pressed }) => ({ height: 56, borderWidth: 1, borderColor: c.background, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.7 : 1 })}
              >
                <Feather name="zap" size={16} color={c.background} />
                <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: c.background }}>Simular Escaneo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScreenHeader title="Escanear Refacción" action={{ icon: "x", onPress: () => router.back() }} />
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "qr"] }}
          onBarcodeScanned={scanned ? undefined : goToRandom}
        />
        <Overlay />
      </View>
    </View>
  );
}
