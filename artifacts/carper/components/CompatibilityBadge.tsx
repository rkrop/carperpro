import { Feather } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import { Fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

/**
 * Signature compatibility marker — the one place green/accent earns its weight.
 * `subtle` renders the inline list-row variant; default renders the framed panel.
 */
export function CompatibilityBadge({ vehicle, subtle = false }: { vehicle: string; subtle?: boolean }) {
  const c = useColors();

  if (subtle) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name="check" size={11} color={c.primary} />
        <Text
          style={{
            fontFamily: Fonts.bold,
            fontSize: 10,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            color: c.primary,
          }}
          numberOfLines={1}
        >
          Compatible: {vehicle}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: c.primary,
        backgroundColor: c.primarySoft,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View style={{ width: 20, height: 20, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <Feather name="check" size={12} color={c.primaryForeground} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: Fonts.bold,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: c.primary,
        }}
      >
        Compatible con tu {vehicle}
      </Text>
    </View>
  );
}
