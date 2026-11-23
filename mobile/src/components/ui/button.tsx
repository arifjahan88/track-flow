import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerLightHaptic } from "@/lib/haptics";

export type ButtonVariant =
  | "primary"
  | "emerald"
  | "danger"
  | "secondary"
  | "outline"
  | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  rightIcon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  rightIcon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantColors: Record<
    ButtonVariant,
    { bg: string; border: string; text: string }
  > = {
    primary: {
      bg: theme.primary,
      border: theme.primary,
      text: theme.primaryForeground,
    },
    emerald: {
      bg: theme.statusLive,
      border: theme.statusLive,
      text: "#FFFFFF",
    },
    danger: {
      bg: theme.danger,
      border: theme.danger,
      text: "#FFFFFF",
    },
    secondary: {
      bg: theme.cardElevated,
      border: theme.border,
      text: theme.text,
    },
    outline: {
      bg: "transparent",
      border: theme.border,
      text: theme.text,
    },
    ghost: {
      bg: "transparent",
      border: "transparent",
      text: theme.textSecondary,
    },
  };

  const c = variantColors[variant];
  const height = size === "sm" ? 36 : size === "lg" ? 48 : 42;
  const fontSize = size === "sm" ? 12 : size === "lg" ? 15 : 14;

  return (
    <AnimatedPressable
      disabled={disabled || loading}
      onPressIn={() => {
        // Immediate, non-bouncy press transition
        scale.value = withTiming(0.98, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 100 });
      }}
      onPress={() => {
        triggerLightHaptic();
        onPress();
      }}
      style={[
        styles.button,
        {
          height,
          backgroundColor: c.bg,
          borderColor: c.border,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? "100%" : undefined,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.text} />
      ) : (
        <>
          {icon}
          <Text
            numberOfLines={1}
            style={[styles.label, { color: c.text, fontSize }]}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  label: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
