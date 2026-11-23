import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { GeofenceBannerEvent } from "@/hooks/use-live-simulation";

interface GeofenceAlertToastProps {
  banner: GeofenceBannerEvent | null;
  onDismiss: () => void;
}

export function GeofenceAlertToast({
  banner,
  onDismiss,
}: GeofenceAlertToastProps) {
  const theme = useTheme();
  if (!banner) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(160)}
      exiting={FadeOutUp.duration(120)}
      style={[
        styles.toast,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadowColor,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.isDark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.10)" },
        ]}
      >
        <Ionicons name="radio" size={16} color={theme.primary} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: theme.text }]}>
          Geofence Zone: {banner.geofenceName}
        </Text>
        <Text
          style={[
            styles.sub,
            { color: theme.textSecondary, fontFamily: Fonts?.mono },
          ]}
        >
          {banner.vehicleName} ({banner.plateNumber}) crossed boundary
        </Text>
      </View>

      <Pressable onPress={onDismiss} style={styles.closeBtn}>
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
});
