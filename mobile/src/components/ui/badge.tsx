import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type BadgeTone =
  | "primary"
  | "neutral"
  | "danger"
  | "success"
  | "cyan"
  | "emerald"
  | "amber"
  | "violet";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  mono?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  label,
  tone = "neutral",
  mono = false,
  icon,
  style,
}: BadgeProps) {
  const theme = useTheme();

  // Strict 3-color palette: Primary (Precision Blue), Neutral (Slate), Danger (Alert Red), Success (Live Green)
  const tonePalette: Record<
    BadgeTone,
    { bg: string; border: string; text: string }
  > = {
    primary: {
      bg: theme.isDark ? "rgba(37, 99, 235, 0.16)" : "rgba(37, 99, 235, 0.10)",
      border: theme.isDark ? "rgba(59, 130, 246, 0.35)" : "rgba(37, 99, 235, 0.25)",
      text: theme.primary,
    },
    cyan: {
      bg: theme.isDark ? "rgba(37, 99, 235, 0.16)" : "rgba(37, 99, 235, 0.10)",
      border: theme.isDark ? "rgba(59, 130, 246, 0.35)" : "rgba(37, 99, 235, 0.25)",
      text: theme.primary,
    },
    violet: {
      bg: theme.isDark ? "rgba(37, 99, 235, 0.16)" : "rgba(37, 99, 235, 0.10)",
      border: theme.isDark ? "rgba(59, 130, 246, 0.35)" : "rgba(37, 99, 235, 0.25)",
      text: theme.primary,
    },
    success: {
      bg: theme.isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(5, 150, 105, 0.10)",
      border: theme.isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(5, 150, 105, 0.25)",
      text: theme.statusLive,
    },
    emerald: {
      bg: theme.isDark ? "rgba(16, 185, 129, 0.16)" : "rgba(5, 150, 105, 0.10)",
      border: theme.isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(5, 150, 105, 0.25)",
      text: theme.statusLive,
    },
    danger: {
      bg: theme.isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(220, 38, 38, 0.10)",
      border: theme.isDark ? "rgba(239, 68, 68, 0.35)" : "rgba(220, 38, 38, 0.25)",
      text: theme.danger,
    },
    amber: {
      bg: theme.muted,
      border: theme.border,
      text: theme.textSecondary,
    },
    neutral: {
      bg: theme.muted,
      border: theme.border,
      text: theme.textSecondary,
    },
  };

  const current = tonePalette[tone] ?? tonePalette.neutral;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: current.bg,
          borderColor: current.border,
        },
        style,
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: current.text,
            fontFamily: mono ? Fonts?.mono : Fonts?.sans,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
