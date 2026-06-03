import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ImageSourcePropType, StyleProp, View, ViewStyle } from "react-native";

import { useCategoryIcon } from "@/data/catalog";
import { useColors } from "@/hooks/useColors";

/**
 * Renders the product photo when present, otherwise a clean line-icon
 * placeholder keyed off the product's category. Photos are trimmed against a
 * white field via `contentFit="contain"`.
 *
 * Uses `expo-image` for a memory + disk cache (`cachePolicy="memory-disk"`), so
 * a photo only downloads once — revisiting a product or scrolling back through
 * a list shows it instantly instead of re-fetching from the ERP each time. A
 * subtle spinner shows during the first load and a short fade smooths it in; if
 * the URL fails (404, expired, network) it falls back to the category icon so
 * the UI never shows a broken image.
 */
export function ProductImage({
  image,
  categoryId,
  pad = 8,
  iconSize = 28,
  style,
}: {
  image: ImageSource | ImageSourcePropType | string | null | undefined;
  categoryId: string | null;
  pad?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const icon = useCategoryIcon(categoryId);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Reset transient state when the source changes — list rows are recycled
  // across products, so a previous failure/load must not leak into the next.
  const imageKey =
    typeof image === "string"
      ? image
      : image && typeof image === "object" && "uri" in image
        ? image.uri
        : JSON.stringify(image);
  useEffect(() => {
    setFailed(false);
    setLoading(!!image);
  }, [imageKey, image]);

  if (image && !failed) {
    return (
      <View style={[{ backgroundColor: c.background, padding: pad, position: "relative" }, style]}>
        <Image
          source={image as ImageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          recyclingKey={imageKey}
          style={{ width: "100%", height: "100%" }}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
        {loading ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.neutral50,
            }}
          >
            <ActivityIndicator size="small" color={c.neutral300} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: c.neutral200, alignItems: "center", justifyContent: "center" }, style]}>
      <MaterialCommunityIcons name={icon as any} size={iconSize} color={c.neutral500} />
    </View>
  );
}
