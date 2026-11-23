import { Platform } from "react-native";

export interface TrackFlowPalette {
  mode: "dark" | "light";
  background: string;
  backgroundSecondary: string;
  backgroundElement: string;
  backgroundSelected: string;
  mapCanvas: string;
  card: string;
  cardElevated: string;
  muted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryForeground: string;
  statusLive: string;
  danger: string;
  brandCyan: string;
  brandCyanBright: string;
  brandBlue: string;
  brandEmerald: string;
  brandAmber: string;
  brandViolet: string;
  border: string;
  borderFocus: string;
  glassBg: string;
  shadowColor: string;
}

export const Colors: Record<"dark" | "light", TrackFlowPalette> = {
  dark: {
    mode: "dark",
    background: "#0B0F17",
    backgroundSecondary: "#111622",
    backgroundElement: "#151B26",
    backgroundSelected: "#1E2636",
    mapCanvas: "#090D14",
    card: "#141A23",
    cardElevated: "#1C2431",
    muted: "#18202C",
    text: "#F8FAFC",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    primary: "#2563EB",
    primaryForeground: "#FFFFFF",
    statusLive: "#10B981",
    danger: "#EF4444",
    // Standard 2-to-3 Color Mapping (deprecating rainbow confetti)
    brandCyan: "#2563EB",
    brandCyanBright: "#3B82F6",
    brandBlue: "#2563EB",
    brandEmerald: "#10B981",
    brandAmber: "#F59E0B",
    brandViolet: "#2563EB",
    border: "#242E3D",
    borderFocus: "#3B82F6",
    glassBg: "rgba(20, 26, 35, 0.94)",
    shadowColor: "#000000",
  },
  light: {
    mode: "light",
    background: "#F8FAFC",
    backgroundSecondary: "#F1F5F9",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#E2E8F0",
    mapCanvas: "#EEF2F6",
    card: "#FFFFFF",
    cardElevated: "#F8FAFC",
    muted: "#F1F5F9",
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    primary: "#2563EB",
    primaryForeground: "#FFFFFF",
    statusLive: "#059669",
    danger: "#DC2626",
    // Standard 2-to-3 Color Mapping (deprecating rainbow confetti)
    brandCyan: "#2563EB",
    brandCyanBright: "#2563EB",
    brandBlue: "#2563EB",
    brandEmerald: "#059669",
    brandAmber: "#D97706",
    brandViolet: "#2563EB",
    border: "#E2E8F0",
    borderFocus: "#2563EB",
    glassBg: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#0F172A",
  },
} as const;

export type ThemeColor = keyof TrackFlowPalette;

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    serif: "Georgia",
    rounded: "System",
    mono: "Menlo",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, serif",
    rounded: "system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 72 }) ?? 0;
export const MaxContentWidth = 800;
