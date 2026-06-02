import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts, isWeb, WEB_TOP_INSET } from "@/constants/fonts";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

/**
 * Brand top nav: wordmark + active sucursal + search field with scan trigger.
 * `editable=false` turns the field into a tappable shortcut into the search flow.
 */
export function SearchHeader({
  value,
  onChangeText,
  onSubmit,
  onVoice,
  editable = true,
  autoFocus = false,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  onSubmit?: () => void;
  onVoice?: () => void;
  editable?: boolean;
  autoFocus?: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sucursal } = useApp();
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 12;

  return (
    <View style={{ backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border, paddingTop: topPad, paddingBottom: 16, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontFamily: Fonts.black, fontSize: 24, letterSpacing: -1, textTransform: "uppercase", color: c.foreground }}>Carper.</Text>
        <Pressable onPress={() => router.push("/sucursal")} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="map-pin" size={12} color={c.mutedForeground} />
          <Text style={{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: c.mutedForeground }}>
            {sucursal.name.replace("Sucursal ", "")}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", borderWidth: 1, borderColor: c.border }}>
        <Pressable
          onPress={editable ? undefined : () => router.push("/(tabs)/buscar")}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}
        >
          <Feather name="search" size={16} color={c.neutral400} style={{ marginRight: 12 }} />
          {editable ? (
            <TextInput
              value={value}
              onChangeText={onChangeText}
              onSubmitEditing={onSubmit}
              autoFocus={autoFocus}
              placeholder="Buscar refacción..."
              placeholderTextColor={c.neutral400}
              returnKeyType="search"
              style={{ flex: 1, paddingVertical: 14, fontFamily: Fonts.medium, fontSize: 14, color: c.foreground }}
            />
          ) : (
            <Text style={{ flex: 1, paddingVertical: 14, fontFamily: Fonts.medium, fontSize: 14, color: c.neutral400 }}>
              Buscar refacción...
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={onVoice ?? (() => router.push("/(tabs)/buscar"))}
          style={({ pressed }) => ({
            width: 50,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 1,
            borderLeftColor: c.border,
            backgroundColor: pressed ? c.neutral200 : c.background,
          })}
        >
          <Feather name="mic" size={16} color={c.foreground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/escanear")}
          style={({ pressed }) => ({
            width: 50,
            alignItems: "center",
            justifyContent: "center",
            borderLeftWidth: 1,
            borderLeftColor: c.border,
            backgroundColor: pressed ? c.neutral200 : c.neutral100,
          })}
        >
          <Feather name="maximize" size={16} color={c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}
