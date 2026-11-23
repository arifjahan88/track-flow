import { useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerLightHaptic } from "@/lib/haptics";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const tabWidth =
    containerWidth > 0 ? (containerWidth - 8) / options.length : 0;

  const translateX = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(w);
    const tw = (w - 8) / options.length;
    translateX.value = activeIndex * tw;
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withTiming(activeIndex * tabWidth, {
          duration: 150,
        }),
      },
    ],
  }));

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.container,
        {
          backgroundColor: theme.muted,
          borderColor: theme.border,
        },
      ]}
    >
      {tabWidth > 0 ? (
        <Animated.View
          style={[
            styles.activePill,
            {
              width: tabWidth,
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: theme.shadowColor,
            },
            pillStyle,
          ]}
        />
      ) : null}

      <View style={styles.optionsRow}>
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                triggerLightHaptic();
                onChange(opt.value);
              }}
              style={styles.tabButton}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? theme.text : theme.textSecondary,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {opt.label}
              </Text>
              {typeof opt.count === "number" ? (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isActive
                        ? theme.primary
                        : theme.cardElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      {
                        color: isActive
                          ? theme.primaryForeground
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {opt.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    position: "relative",
    justifyContent: "center",
  },
  activePill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 13,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
