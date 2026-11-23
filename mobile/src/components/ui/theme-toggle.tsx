import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/types";

export function ThemeToggleButton({ compact = false }: { compact?: boolean }) {
  const { isDark, toggleTheme, cardElevated, border, primary, text } =
    useTheme();

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(isDark ? "0deg" : "180deg", {
          duration: 160,
        }),
      },
    ],
  }));

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel="Toggle Light and Dark Theme"
      style={[
        styles.button,
        {
          backgroundColor: cardElevated,
          borderColor: border,
          paddingHorizontal: compact ? 10 : 12,
        },
      ]}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isDark ? "moon" : "sunny"}
          size={16}
          color={isDark ? primary : text}
        />
      </Animated.View>
      {!compact ? (
        <Text style={[styles.label, { color: text }]}>
          {isDark ? "Dark" : "Light"}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ThemePreferenceSelector() {
  const {
    preference,
    setPreference,
    card,
    muted,
    border,
    borderFocus,
    text,
    textSecondary,
    primary,
  } = useTheme();

  const items: Array<{
    key: ThemePreference;
    label: string;
    subtitle: string;
    icon: "moon" | "sunny" | "phone-portrait-outline";
  }> = [
    {
      key: "dark",
      label: "Night Cockpit (Dark)",
      subtitle: "High contrast for night and low-glare driving",
      icon: "moon",
    },
    {
      key: "light",
      label: "Daylight High-Vis (Light)",
      subtitle: "Crisp silver map and high daylight legibility",
      icon: "sunny",
    },
    {
      key: "system",
      label: "Auto System Sync",
      subtitle: "Automatically align with device OS settings",
      icon: "phone-portrait-outline",
    },
  ];

  return (
    <View style={styles.selectorContainer}>
      {items.map((it) => {
        const isSelected = preference === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => setPreference(it.key)}
            style={[
              styles.selectorCard,
              {
                backgroundColor: isSelected ? muted : card,
                borderColor: isSelected ? borderFocus : border,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isSelected
                    ? primary
                    : muted,
                },
              ]}
            >
              <Ionicons
                name={it.icon}
                size={18}
                color={isSelected ? "#FFFFFF" : textSecondary}
              />
            </View>

            <View style={styles.textWrap}>
              <Text style={[styles.itemLabel, { color: text }]}>
                {it.label}
              </Text>
              <Text style={[styles.itemSub, { color: textSecondary }]}>
                {it.subtitle}
              </Text>
            </View>

            <View
              style={[
                styles.radioOuter,
                {
                  borderColor: isSelected ? primary : border,
                },
              ]}
            >
              {isSelected ? (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: primary },
                  ]}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
  selectorContainer: {
    gap: 10,
  },
  selectorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
