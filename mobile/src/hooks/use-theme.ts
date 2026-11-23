import { useColorScheme } from "react-native";
import { Colors, type TrackFlowPalette } from "@/constants/theme";
import { useThemeStore } from "@/store/theme-store";
import type { ResolvedTheme, ThemePreference } from "@/types";

export interface UseThemeResult extends TrackFlowPalette {
  theme: TrackFlowPalette;
  isDark: boolean;
  resolvedMode: ResolvedTheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const storeToggle = useThemeStore((s) => s.toggleTheme);

  const resolvedMode: ResolvedTheme =
    preference === "system"
      ? systemScheme === "light"
        ? "light"
        : "dark"
      : preference;

  const palette = Colors[resolvedMode];

  return {
    ...palette,
    theme: palette,
    isDark: resolvedMode === "dark",
    resolvedMode,
    preference,
    setPreference,
    toggleTheme: () => storeToggle(resolvedMode),
  };
}
