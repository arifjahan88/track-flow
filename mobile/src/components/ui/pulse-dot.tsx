import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface PulseDotProps {
  color?: string;
  size?: number;
  active?: boolean;
}

export function PulseDot({
  color = "#10B981",
  size = 8,
  active = true,
}: PulseDotProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.75);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withTiming(2.3, {
          duration: 1500,
          easing: Easing.out(Easing.cubic),
        }),
        -1,
        false
      );
      opacity.value = withRepeat(
        withTiming(0, {
          duration: 1500,
          easing: Easing.out(Easing.cubic),
        }),
        -1,
        false
      );
    } else {
      scale.value = 1;
      opacity.value = 0;
    }
  }, [active, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View
      style={[
        styles.wrapper,
        { width: size * 2.2, height: size * 2.2 },
      ]}
    >
      {active ? (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
            },
            ringStyle,
          ]}
        />
      ) : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
});
