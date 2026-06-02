/**
 * Carper design tokens — Variant B "Polestar editorial".
 * Near-monochrome (black / white / neutral grays carry ~95% of the UI) with a
 * single electric-blue accent (#0055FF) reserved for deal/CTA/compatibility
 * moments. Green is a status-only signal for stock/compatibility confirmation.
 * Corners are sharp (radius 0); dividers are hairlines.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#0a0a0a",
    tint: "#0055FF",

    // Core surfaces
    background: "#ffffff",
    backgroundAlt: "#fafafa", // neutral-50 — quiet section background
    foreground: "#0a0a0a",

    // Cards / elevated surfaces
    card: "#ffffff",
    cardForeground: "#0a0a0a",

    // Primary = the single electric-blue accent
    primary: "#0055FF",
    primaryForeground: "#ffffff",
    primaryPressed: "#0044CC",
    primarySoft: "#eef2ff", // accent at ~5% for compatibility panel fills

    // Secondary surfaces
    secondary: "#f5f5f5",
    secondaryForeground: "#0a0a0a",

    // Muted / subdued
    muted: "#f5f5f5",
    mutedForeground: "#737373", // neutral-500

    // Accent (same as primary in this palette)
    accent: "#0055FF",
    accentForeground: "#ffffff",

    // Status
    success: "#16a34a",
    successForeground: "#ffffff",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",

    // Neutral scale (editorial grayscale)
    neutral50: "#fafafa",
    neutral100: "#f5f5f5",
    neutral200: "#e5e5e5",
    neutral300: "#d4d4d4",
    neutral400: "#a3a3a3",
    neutral500: "#737373",
    neutral900: "#0a0a0a",

    // Borders and inputs
    border: "#e5e5e5", // neutral-200 hairline
    borderStrong: "#0a0a0a",
    input: "#e5e5e5",
  },

  // Editorial language uses near-zero corner radius.
  radius: 0,
};

export default colors;
