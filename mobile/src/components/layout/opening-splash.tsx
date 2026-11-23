import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface OpeningSplashProps {
  ready: boolean;
  onFinish?: () => void;
}

export function OpeningSplash({ ready, onFinish }: OpeningSplashProps) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(true);
  const opacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    // Subtle breathing pulse for the logo ring
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 800 }),
        withTiming(0.45, { duration: 800 })
      ),
      -1,
      true
    );
  }, [pulseScale, pulseOpacity]);

  useEffect(() => {
    if (ready) {
      // Hold for at least a brief moment so the splash feels deliberate and smooth
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 250 }, (finished) => {
          if (finished) {
            onFinish?.();
          }
        });
        setTimeout(() => setMounted(false), 300);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [ready, opacity, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[
        StyleSheet.absoluteFill,
        styles.container,
        { backgroundColor: theme.background },
        containerStyle,
      ]}
    >
      <View style={styles.contentWrap}>
        {/* Animated Brand Emblem */}
        <View style={styles.emblemContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: theme.primary },
              pulseRingStyle,
            ]}
          />
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.primary,
              },
            ]}
          >
            <View
              style={[
                styles.iconInner,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons
                name="navigate"
                size={28}
                color={theme.primaryForeground}
              />
            </View>
          </View>
        </View>

        {/* Brand Typography */}
        <View style={styles.textBlock}>
          <Text
            style={[
              styles.brandName,
              { color: theme.text, fontFamily: Fonts.extrabold },
            ]}
          >
            TrackFlow
          </Text>
          <Text
            style={[
              styles.tagline,
              { color: theme.textSecondary, fontFamily: Fonts.medium },
            ]}
          >
            DRIVER COCKPIT & FLEET TELEMETRY
          </Text>
        </View>
      </View>

      {/* Bottom Status Indicator */}
      <View style={styles.bottomBlock}>
        <View
          style={[
            styles.loadBarTrack,
            { backgroundColor: theme.cardElevated },
          ]}
        >
          <Animated.View
            style={[
              styles.loadBarFill,
              { backgroundColor: theme.primary },
            ]}
          />
        </View>
        <Text
          style={[
            styles.statusText,
            { color: theme.textSecondary, fontFamily: Fonts.mono },
          ]}
        >
          LOCAL-FIRST ASYNC PERSISTENCE
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  contentWrap: {
    alignItems: "center",
    gap: 24,
  },
  emblemContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    alignItems: "center",
    gap: 6,
  },
  brandName: {
    fontSize: 28,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
  bottomBlock: {
    position: "absolute",
    bottom: 48,
    alignItems: "center",
    gap: 12,
  },
  loadBarTrack: {
    width: 140,
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  loadBarFill: {
    width: "70%",
    height: "100%",
    borderRadius: 1.5,
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
