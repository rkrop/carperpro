import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AccentButton } from "@/components/CarperUI";
import { ProductRow } from "@/components/ProductRow";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Fonts } from "@/constants/fonts";
import { useScanIdentifyPart, type ScanIdentifyResult } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

// Strip a possible `data:image/...;base64,` prefix (web image-picker may include
// it) so the server receives raw base64.
function rawBase64(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "");
}

export default function Escanear() {
  const c = useColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const { identify, isPending } = useScanIdentifyPart();

  const [capturing, setCapturing] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanIdentifyResult | null>(null);

  const busy = capturing || isPending;

  async function runIdentify(base64: string, mimeType: string, uri: string) {
    setCapturedUri(uri);
    try {
      const res = await identify(rawBase64(base64), mimeType);
      setResult(res);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          res.recognized
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
    } catch {
      setResult({ recognized: false, label: "", query: "", products: [] });
    }
  }

  async function captureFromCamera() {
    if (!camRef.current || busy) return;
    setCapturing(true);
    try {
      const photo = await camRef.current.takePictureAsync({ base64: true, quality: 0.4 });
      if (photo?.base64) {
        await runIdentify(photo.base64, "image/jpeg", photo.uri);
      }
    } catch {
      // ignore capture errors; user can retry
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromLibrary() {
    if (busy) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.4,
    });
    if (picked.canceled || !picked.assets[0]?.base64) return;
    const asset = picked.assets[0];
    setCapturing(true);
    try {
      await runIdentify(asset.base64!, asset.mimeType ?? "image/jpeg", asset.uri);
    } finally {
      setCapturing(false);
    }
  }

  function reset() {
    setResult(null);
    setCapturedUri(null);
  }

  // ── Busy: identifying ──────────────────────────────────────────────
  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: c.foreground }}>
        <ScreenHeader title="Identificando" action={{ icon: "x", onPress: () => router.back() }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          {capturedUri ? (
            <Image
              source={{ uri: capturedUri }}
              style={{ width: 180, height: 180, borderRadius: 4, marginBottom: 28 }}
              resizeMode="cover"
            />
          ) : null}
          <ActivityIndicator color={c.primary} size="large" />
          <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: c.background, marginTop: 20, textAlign: "center" }}>
            Identificando refacción…
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.neutral400, marginTop: 8, textAlign: "center" }}>
            Analizando la foto y buscando en el catálogo
          </Text>
        </View>
      </View>
    );
  }

  // ── Results ────────────────────────────────────────────────────────
  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <ScreenHeader title="Resultado" action={{ icon: "x", onPress: () => router.back() }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 20 }}>
            {capturedUri ? (
              <Image source={{ uri: capturedUri }} style={{ width: 64, height: 64, borderRadius: 4 }} resizeMode="cover" />
            ) : null}
            <View style={{ flex: 1 }}>
              {result.recognized ? (
                <>
                  <Text style={{ fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: c.primary }}>
                    Detectamos
                  </Text>
                  <Text style={{ fontFamily: Fonts.black, fontSize: 20, letterSpacing: -0.5, color: c.text, marginTop: 2 }}>
                    {result.label}
                  </Text>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 12, color: c.neutral500, marginTop: 2 }}>
                    {result.products.length} refacción{result.products.length === 1 ? "" : "es"} que coincide{result.products.length === 1 ? "" : "n"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontFamily: Fonts.black, fontSize: 18, letterSpacing: -0.5, color: c.text }}>
                    Sin coincidencias
                  </Text>
                  <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.neutral500, marginTop: 4, lineHeight: 19 }}>
                    {result.label
                      ? `Parece una ${result.label.toLowerCase()}, pero no encontramos esa pieza en el catálogo.`
                      : "No pudimos identificar la refacción en la foto. Intenta con mejor luz y un primer plano."}
                  </Text>
                </>
              )}
            </View>
          </View>

          {result.recognized
            ? result.products.map((p) => <ProductRow key={p.id} product={p} />)
            : null}

          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
            {!result.recognized && result.query ? (
              <AccentButton
                label="Buscar manualmente"
                icon="search"
                onPress={() => router.replace(`/resultados?q=${encodeURIComponent(result.query)}`)}
              />
            ) : null}
            <Pressable
              onPress={reset}
              style={({ pressed }) => ({ height: 56, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <Feather name="camera" size={16} color={c.text} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: c.text }}>
                Escanear otra
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Web or permission not yet granted → upload-first fallback ──────
  if (Platform.OS === "web" || !permission || !permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.foreground }}>
        <ScreenHeader title="Escanear Refacción" action={{ icon: "x", onPress: () => router.back() }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <View style={{ width: 220, height: 220, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
            <Feather name="camera" size={48} color={c.background} />
          </View>
          <Text style={{ fontFamily: Fonts.black, fontSize: 20, letterSpacing: -0.5, textTransform: "uppercase", color: c.background, textAlign: "center", marginBottom: 10 }}>
            Identifica por foto
          </Text>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.neutral400, textAlign: "center", lineHeight: 19, marginBottom: 28 }}>
            {Platform.OS === "web"
              ? "Sube una foto de la pieza y la identificamos buscando refacciones que coincidan en el catálogo."
              : "Necesitamos acceso a tu cámara para tomar la foto de la refacción y identificarla."}
          </Text>
          <View style={{ alignSelf: "stretch", gap: 12 }}>
            {Platform.OS !== "web" && permission && !permission.granted ? (
              <AccentButton label="Permitir Cámara" icon="camera" onPress={requestPermission} />
            ) : null}
            <Pressable
              onPress={pickFromLibrary}
              style={({ pressed }) => ({ height: 56, borderWidth: 1, borderColor: c.background, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <Feather name="image" size={16} color={c.background} />
              <Text style={{ fontFamily: Fonts.bold, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: c.background }}>
                Subir foto
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Native camera capture ──────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScreenHeader title="Escanear Refacción" action={{ icon: "x", onPress: () => router.back() }} />
      <View style={{ flex: 1 }}>
        <CameraView ref={camRef} style={{ flex: 1 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
          <View style={{ width: 240, height: 240, borderWidth: 1, borderColor: c.primary }}>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <View
                key={corner}
                style={{
                  position: "absolute",
                  width: 28,
                  height: 28,
                  borderColor: c.background,
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
            Centra la refacción y toma la foto
          </Text>
        </View>
        <View style={{ position: "absolute", bottom: 40, left: 24, right: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <Pressable
            onPress={captureFromCamera}
            style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.background, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: c.primary }} />
          </Pressable>
          <Pressable
            onPress={pickFromLibrary}
            style={({ pressed }) => ({ position: "absolute", right: 0, width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
          >
            <Feather name="image" size={20} color={c.background} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
