import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccentButton } from "@/components/CarperUI";
import { Fonts, WEB_BOTTOM_INSET, WEB_TOP_INSET, isWeb } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";
import { useOnboarding } from "@/lib/onboarding";

interface Slide {
  image: number;
  kicker: string;
  title: string;
  subtitle: string;
}

// The three selling points shown before entering the app. Realistic AI promo
// imagery up top; punchy es-MX copy below (titles render uppercase).
const SLIDES: Slide[] = [
  {
    image: require("../assets/images/onboarding/click.png"),
    kicker: "Compra fácil",
    title: "Compras desde un click",
    subtitle:
      "Encuentra y pide tus refacciones en segundos. Sin filas, sin llamadas.",
  },
  {
    image: require("../assets/images/onboarding/pocket.png"),
    kicker: "Catálogo completo",
    title: "Tu refaccionaria en tu bolsillo",
    subtitle:
      "Miles de piezas con precio y existencia en tiempo real, donde estés.",
  },
  {
    image: require("../assets/images/onboarding/ai-search.png"),
    kicker: "Tecnología a tu favor",
    title: "Búsquedas inteligentes con IA",
    subtitle:
      "Toma una foto o describe la pieza y la IA encuentra la correcta por ti.",
  },
];

export default function Bienvenida() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { markSeen } = useOnboarding();

  const [index, setIndex] = React.useState(0);
  const [region, setRegion] = React.useState({ w: 0, h: 0 });
  const scrollRef = React.useRef<ScrollView>(null);

  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 10;
  const bottomPad = (isWeb ? WEB_BOTTOM_INSET : insets.bottom) + 16;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = region.w || W;
    const next = Math.round(e.nativeEvent.contentOffset.x / w);
    if (next !== index) setIndex(next);
  };

  const goTo = (i: number) => {
    const w = region.w || W;
    scrollRef.current?.scrollTo({ x: i * w, animated: true });
    setIndex(i);
  };

  const goSignUp = async () => {
    await markSeen();
    router.push("/(auth)/sign-up");
  };

  const goSignIn = async () => {
    await markSeen();
    router.push("/(auth)/sign-in");
  };

  const goGuest = async () => {
    await markSeen();
    router.replace("/(tabs)");
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      <StatusBar style="light" />

      {/* Image pager region */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) =>
          setRegion({
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          })
        }
      >
        {region.h > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            scrollEventThrottle={16}
          >
            {SLIDES.map((slide, i) => (
              <View key={i} style={{ width: region.w, height: region.h }}>
                <Image
                  source={slide.image}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
                {/* Top scrim keeps the brand + skip legible over bright photos */}
                <LinearGradient
                  colors={["rgba(10,10,10,0.6)", "rgba(10,10,10,0)"]}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180, pointerEvents: "none" }}
                />
                {/* Bottom scrim carries the headline copy */}
                <LinearGradient
                  colors={["rgba(10,10,10,0)", "rgba(10,10,10,0.55)", "rgba(10,10,10,0.95)"]}
                  locations={[0, 0.45, 1]}
                  style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: region.h * 0.62, pointerEvents: "none" }}
                />

                <View
                  style={{
                    position: "absolute",
                    left: 24,
                    right: 24,
                    bottom: 28,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <View style={{ width: 18, height: 2, backgroundColor: c.primary }} />
                    <Text
                      style={{
                        fontFamily: Fonts.bold,
                        fontSize: 10,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        color: "#ffffff",
                      }}
                    >
                      {slide.kicker}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: Fonts.black,
                      fontSize: 38,
                      lineHeight: 38,
                      letterSpacing: -1.6,
                      textTransform: "uppercase",
                      color: "#ffffff",
                    }}
                  >
                    {slide.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: Fonts.medium,
                      fontSize: 15,
                      lineHeight: 22,
                      color: "rgba(255,255,255,0.82)",
                      marginTop: 14,
                      maxWidth: 360,
                    }}
                  >
                    {slide.subtitle}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* Brand + skip overlay */}
        <View
          style={{
            position: "absolute",
            top: topPad,
            left: 24,
            right: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            pointerEvents: "box-none",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text
              style={{
                fontFamily: Fonts.black,
                fontSize: 20,
                letterSpacing: -0.8,
                textTransform: "uppercase",
                color: "#ffffff",
              }}
            >
              Carper
            </Text>
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 8,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Autopartes
            </Text>
          </View>
          <Pressable onPress={goGuest} hitSlop={10}>
            <Text
              style={{
                fontFamily: Fonts.bold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Saltar
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Footer: progress dots + actions */}
      <View
        style={{
          backgroundColor: c.background,
          paddingHorizontal: 24,
          paddingTop: 22,
          paddingBottom: bottomPad,
        }}
      >
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 22 }}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
              <View
                style={{
                  width: i === index ? 22 : 7,
                  height: 3,
                  backgroundColor: i === index ? c.primary : c.neutral300,
                }}
              />
            </Pressable>
          ))}
        </View>

        {isLast ? (
          <AccentButton label="Crear cuenta" icon="arrow-right" onPress={goSignUp} />
        ) : (
          <AccentButton label="Siguiente" icon="arrow-right" onPress={() => goTo(index + 1)} />
        )}

        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 18, gap: 6 }}>
          <Text style={{ fontFamily: Fonts.medium, fontSize: 13, color: c.mutedForeground }}>
            ¿Ya tienes cuenta?
          </Text>
          <Pressable onPress={goSignIn} hitSlop={8}>
            <Text style={{ fontFamily: Fonts.bold, fontSize: 13, color: c.primary }}>
              Iniciar sesión
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={goGuest} hitSlop={8} style={{ marginTop: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.neutral400 }}>
            Explorar sin cuenta
          </Text>
          <Feather name="chevron-right" size={14} color={c.neutral400} />
        </Pressable>
      </View>
    </View>
  );
}
