import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

/** Tiny uppercase tracked label used for section headers and meta. */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={style}>
      <Text
        style={{
          fontFamily: Fonts.bold,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: c.neutral400,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Full-width electric-blue primary action. */
export function AccentButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  height = 56,
  style,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const handle = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };
  return (
    <Pressable
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height,
          backgroundColor: disabled ? c.neutral300 : pressed ? c.primaryPressed : c.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.primaryForeground} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={c.primaryForeground} /> : null}
          <Text
            style={{
              color: c.primaryForeground,
              fontFamily: Fonts.bold,
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Outlined secondary action (monochrome). */
export function OutlineButton({
  label,
  icon,
  onPress,
  height = 56,
  style,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          backgroundColor: pressed ? c.neutral100 : c.background,
          borderWidth: 1,
          borderColor: c.borderStrong,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={c.foreground} /> : null}
      <Text
        style={{
          color: c.foreground,
          fontFamily: Fonts.bold,
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Selectable pill chip (used for brand filters, recent searches). */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync();
        onPress?.();
      }}
      style={{
        height: 34,
        paddingHorizontal: 16,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: active ? c.borderStrong : c.border,
        backgroundColor: active ? c.borderStrong : c.background,
      }}
    >
      <Text
        style={{
          fontFamily: Fonts.bold,
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: active ? c.background : c.foreground,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A bordered square icon container (line-icon "tile"). */
export function IconBox({
  children,
  size = 32,
  active,
}: {
  children: React.ReactNode;
  size?: number;
  active?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/** Hairline divider. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

/** Shimmer skeleton block. */
export function Skeleton({ width, height, style }: { width?: number | string; height?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width: width as any, height: height ?? 16, backgroundColor: c.neutral100, opacity }, style]}
    />
  );
}

/** Empty / no-results state — line icon + message, optional action. */
export function EmptyState({
  icon = "search",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Feather name={icon} size={22} color={c.neutral400} strokeWidth={1} />
      </View>
      <Text
        style={{
          fontFamily: Fonts.black,
          fontSize: 16,
          letterSpacing: -0.3,
          textTransform: "uppercase",
          color: c.foreground,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            fontFamily: Fonts.medium,
            fontSize: 13,
            color: c.mutedForeground,
            textAlign: "center",
            marginTop: 8,
            lineHeight: 19,
          }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: 24, alignSelf: "stretch" }}>
          <OutlineButton label={actionLabel} onPress={onAction} height={48} />
        </View>
      ) : null}
    </View>
  );
}

/** Stock status indicator. */
export function StockPill({ status }: { status: "alto" | "bajo" | "agotado" }) {
  const c = useColors();
  const map = {
    alto: { color: c.success, label: "En existencia" },
    bajo: { color: c.primary, label: "Últimas piezas" },
    agotado: { color: c.neutral400, label: "Agotado" },
  } as const;
  const cur = map[status];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cur.color }} />
      <Text
        style={{
          fontFamily: Fonts.bold,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: cur.color,
        }}
      >
        {cur.label}
      </Text>
    </View>
  );
}
