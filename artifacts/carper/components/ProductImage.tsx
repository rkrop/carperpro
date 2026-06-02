import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Image, ImageSourcePropType, StyleProp, View, ViewStyle } from "react-native";

import { useCategoryIcon } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

/**
 * Renders the product photo when present, otherwise a clean line-icon
 * placeholder keyed off the product's category. Photos use `mix-blend`-style
 * white trimming via `contain` on a white field.
 */
export function ProductImage({
  image,
  categoryId,
  pad = 8,
  iconSize = 28,
  style,
}: {
  image: ImageSourcePropType | null;
  categoryId: string | null;
  pad?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const icon = useCategoryIcon(categoryId);

  if (image) {
    return (
      <View style={[{ backgroundColor: c.background, padding: pad }, style]}>
        <Image source={image} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: c.neutral50, alignItems: "center", justifyContent: "center" }, style]}>
      <MaterialCommunityIcons name={icon as any} size={iconSize} color={c.neutral300} />
    </View>
  );
}
