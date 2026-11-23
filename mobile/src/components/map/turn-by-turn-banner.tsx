import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { TurnInstruction, TurnManeuver } from "@/types";

interface TurnByTurnBannerProps {
  instruction: TurnInstruction;
  routeCode: string;
  routeColor: string;
  currentSpeedKmh: number;
}

const MANEUVER_ICON: Record<TurnManeuver, keyof typeof Ionicons.glyphMap> = {
  depart: "navigate",
  right: "arrow-forward",
  left: "arrow-back",
  straight: "arrow-up",
  merge: "git-merge-outline",
  arrive: "flag",
};

export function TurnByTurnBanner({
  instruction,
  routeCode,
  routeColor,
  currentSpeedKmh,
}: TurnByTurnBannerProps) {
  const theme = useTheme();
  const isOverLimit = currentSpeedKmh > instruction.speedLimitKmh + 5;

  return (
    <Animated.View
      entering={FadeInUp.duration(160)}
      exiting={FadeOutUp.duration(120)}
      style={[
        styles.banner,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadowColor,
        },
      ]}
    >
      {/* Left: Maneuver Icon Box */}
      <View
        style={[
          styles.maneuverBox,
          {
            backgroundColor: theme.primary,
          },
        ]}
      >
        <Ionicons
          name={MANEUVER_ICON[instruction.maneuver]}
          size={24}
          color="#FFFFFF"
        />
        <Text style={[styles.distText, { fontFamily: Fonts?.mono }]}>
          {instruction.distanceMeters}m
        </Text>
      </View>

      {/* Center: Street & Instruction */}
      <View style={styles.centerInfo}>
        <View style={styles.corridorRow}>
          <View style={[styles.codePill, { backgroundColor: theme.muted }]}>
            <Text style={[styles.codeText, { color: theme.textSecondary, fontFamily: Fonts?.mono }]}>
              {routeCode}
            </Text>
          </View>
          <Text numberOfLines={1} style={[styles.districtText, { color: theme.textSecondary }]}>
            {instruction.district} · {instruction.streetName}
          </Text>
        </View>
        <Text numberOfLines={2} style={[styles.instructionText, { color: theme.text }]}>
          {instruction.instruction}
        </Text>
      </View>

      {/* Right: Speed Limit Sign */}
      <View
        style={[
          styles.speedLimitSign,
          {
            borderColor: isOverLimit ? theme.danger : theme.border,
            backgroundColor: isOverLimit
              ? (theme.isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(220, 38, 38, 0.12)")
              : theme.cardElevated,
          },
        ]}
      >
        <Text
          style={[
            styles.limitLabel,
            { color: isOverLimit ? theme.danger : theme.textSecondary },
          ]}
        >
          LIMIT
        </Text>
        <Text
          style={[
            styles.limitValue,
            {
              color: isOverLimit ? theme.danger : theme.text,
              fontFamily: Fonts?.mono,
            },
          ]}
        >
          {instruction.speedLimitKmh}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  maneuverBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  distText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  centerInfo: {
    flex: 1,
    gap: 2,
  },
  corridorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  codePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  districtText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  instructionText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  speedLimitSign: {
    width: 42,
    height: 46,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  limitLabel: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  limitValue: {
    fontSize: 14,
    fontWeight: "800",
  },
});
