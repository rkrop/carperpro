import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts, isWeb, WEB_TOP_INSET } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export interface HeaderAction {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  tint?: string;
}

/** Editorial stack header: bordered back box, centered tracked title, optional action. */
export function ScreenHeader({
  title,
  onBack,
  action,
  showBack = true,
}: {
  title: string;
  onBack?: () => void;
  action?: HeaderAction;
  showBack?: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = (isWeb ? WEB_TOP_INSET : insets.top) + 12;

  return (
    <View
      style={{
        backgroundColor: c.background,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        paddingTop: topPad,
        paddingBottom: 14,
        paddingHorizontal: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="chevron-left" size={18} color={c.foreground} />
        </Pressable>
      ) : (
        <View style={{ width: 32 }} />
      )}

      <Text style={{ fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.foreground }}>
        {title}
      </Text>

      {action ? (
        <Pressable
          onPress={action.onPress}
          style={{ width: 32, height: 32, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name={action.icon} size={16} color={action.tint ?? c.foreground} />
        </Pressable>
      ) : (
        <View style={{ width: 32 }} />
      )}
    </View>
  );
}
