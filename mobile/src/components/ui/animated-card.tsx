import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerLightHaptic } from "@/lib/haptics";

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  elevated?: boolean;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedCard({
  children,
  index = 0,
  elevated = false,
  active = false,
  onPress,
  style,
}: AnimatedCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const delayMs = Math.min(index * 30, 180);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: elevated ? theme.cardElevated : theme.card,
      borderColor: active ? theme.borderFocus : theme.border,
      shadowColor: theme.shadowColor,
    },
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        entering={FadeInDown.delay(delayMs).duration(150)}
        layout={LinearTransition.duration(150)}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 100 });
        }}
        onPress={() => {
          triggerLightHaptic();
          onPress();
        }}
        style={[containerStyle, scaleStyle]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(delayMs).duration(150)}
      layout={LinearTransition.duration(150)}
      style={containerStyle}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
});
