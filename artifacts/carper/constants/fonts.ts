import { Platform } from "react-native";

/**
 * Font family names. Inter is the grotesk workhorse (the editorial type scale
 * leans on the heaviest weights); Space Mono renders all SKUs and prices as
 * "engineered data".
 */
export const Fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  black: "Inter_900Black",
  mono: "SpaceMono_400Regular",
  monoBold: "SpaceMono_700Bold",
} as const;

export const isWeb = Platform.OS === "web";

/** Web preview runs in an iframe with no native safe area — pad manually. */
export const WEB_TOP_INSET = 50;
export const WEB_BOTTOM_INSET = 34;

/** Bottom tab bar height (50 + 34 web inset, per skill guidance). */
export const TAB_BAR_HEIGHT = isWeb ? 84 : 64;
