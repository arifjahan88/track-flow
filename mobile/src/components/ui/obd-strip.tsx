import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface ObdStripProps {
  ignitionOn: boolean;
  fuelLevelPercent?: number;
  distanceKm?: number;
}

export function ObdStrip({
  ignitionOn,
  fuelLevelPercent,
  distanceKm = 0,
}: ObdStripProps) {
  const theme = useTheme();
  const batteryVolts = ignitionOn ? "14.1V" : "12.6V";
  const computedFuel =
    typeof fuelLevelPercent === "number"
      ? Math.round(fuelLevelPercent)
      : Math.max(18, Math.round(86 - distanceKm * 1.4));
  const coolantC = ignitionOn ? "88°C" : "42°C";

  // Strict 3-color palette: Primary Blue, Live Green, Alert Red, Neutral Slate
  const items = [
    {
      label: "IGNITION",
      value: ignitionOn ? "ON" : "OFF",
      icon: "power" as const,
      color: ignitionOn ? theme.statusLive : theme.textSecondary,
    },
    {
      label: "BATTERY",
      value: batteryVolts,
      icon: "battery-charging" as const,
      color: theme.primary,
    },
    {
      label: "FUEL",
      value: `${computedFuel}%`,
      icon: "water" as const,
      color: computedFuel <= 20 ? theme.danger : theme.text,
    },
    {
      label: "COOLANT",
      value: coolantC,
      icon: "thermometer" as const,
      color: theme.textSecondary,
    },
    {
      label: "OBD-II",
      value: "0 DTC · OK",
      icon: "hardware-chip" as const,
      color: theme.statusLive,
    },
  ];

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.tile,
            {
              backgroundColor: theme.muted,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.tileHeader}>
            <Ionicons name={item.icon} size={12} color={item.color} />
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {item.label}
            </Text>
          </View>
          <Text
            style={[
              styles.value,
              { color: theme.text, fontFamily: Fonts?.mono },
            ]}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  tile: {
    flex: 1,
    padding: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 4,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
  },
  value: {
    fontSize: 11,
    fontWeight: "700",
  },
});
