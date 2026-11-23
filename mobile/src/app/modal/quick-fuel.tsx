import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatCurrency, toIsoDate } from "@/lib/format";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";

export default function QuickFuelModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const vehicles = useFleetStore((s) => s.vehicles);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const addFuelLog = useFleetStore((s) => s.addFuelLog);

  const [vehicleId, setVehicleId] = useState(
    params.vehicleId || selectedVehicleId || vehicles[0]?.id || "veh-1"
  );
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const [liters, setLiters] = useState("65");
  const [pricePerLiter, setPricePerLiter] = useState("1.66");
  const [odometerKm, setOdometerKm] = useState(
    String(Math.round((selectedVehicle?.odometerKm ?? 48240) + 120))
  );
  const [station, setStation] = useState("Shell Fleet Hub #14 (Tejgaon)");
  const [fullTank, setFullTank] = useState(true);

  const numLiters = Math.max(0, Number(liters) || 0);
  const numPrice = Math.max(0, Number(pricePerLiter) || 0);
  const totalCost = Number((numLiters * numPrice).toFixed(2));
  const tankCap = selectedVehicle?.tankCapacityLiters ?? 140;
  const overCapacity = numLiters > tankCap;

  const handleSave = () => {
    if (numLiters <= 0) return;
    addFuelLog({
      vehicleId,
      date: toIsoDate(),
      liters: numLiters,
      pricePerLiter: numPrice,
      totalCost,
      odometerKm: Math.max(
        selectedVehicle?.odometerKm ?? 0,
        Number(odometerKm) || 0
      ),
      fullTank,
      station: station.trim() || "Fleet Fuel Station",
    });
    triggerSuccessHaptic();
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: theme.text }]}>
            Log Fuel Fill-Up
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Automatic km/L efficiency & tank capacity anomaly check
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: theme.muted }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            SELECT VEHICLE
          </Text>
          <View style={styles.chipWrap}>
            {vehicles.map((v) => {
              const active = v.id === vehicleId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    setVehicleId(v.id);
                    setOdometerKm(String(Math.round(v.odometerKm + 95)));
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.primary : theme.muted,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active ? theme.primaryForeground : theme.text,
                      },
                    ]}
                  >
                    {v.plate} · {v.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                LITERS (MAX {tankCap}L)
              </Text>
              <TextInput
                value={liters}
                onChangeText={setLiters}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.muted,
                    borderColor: overCapacity ? theme.danger : theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                PRICE / LITER ($)
              </Text>
              <TextInput
                value={pricePerLiter}
                onChangeText={setPricePerLiter}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.muted,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </View>
          </View>

          {overCapacity ? (
            <View
              style={[
                styles.anomalyWarning,
                {
                  borderColor: theme.danger,
                  backgroundColor: "rgba(255, 107, 115, 0.14)",
                },
              ]}
            >
              <Ionicons name="warning" size={16} color={theme.danger} />
              <Text style={[styles.anomalyText, { color: theme.danger }]}>
                Over-Capacity Alert: {numLiters}L exceeds {selectedVehicle?.name}{" "}
                tank capacity ({tankCap}L). This will be flagged for audit.
              </Text>
            </View>
          ) : null}

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            CURRENT ODOMETER (KM)
          </Text>
          <TextInput
            value={odometerKm}
            onChangeText={setOdometerKm}
            keyboardType="numeric"
            style={[
              styles.input,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            FUEL STATION / HUB
          </Text>
          <TextInput
            value={station}
            onChangeText={setStation}
            style={[
              styles.input,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>
              Full Tank Fill-Up (restores fuel level to 100%)
            </Text>
            <Switch
              value={fullTank}
              onValueChange={setFullTank}
              trackColor={{ false: theme.muted, true: theme.statusLive }}
            />
          </View>

          <View
            style={[
              styles.totalBar,
              { backgroundColor: theme.muted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
              COMPUTED TOTAL COST
            </Text>
            <View style={styles.totalRight}>
              <Badge
                label={formatCurrency(totalCost)}
                tone="cyan"
                mono
              />
            </View>
          </View>
        </View>

        <Button
          label={`Save Fuel Log (${formatCurrency(totalCost)})`}
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 16, gap: 14 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "700" },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1, gap: 6 },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Fonts?.mono,
  },
  anomalyWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  anomalyText: { fontSize: 11, fontWeight: "700", flex: 1 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  totalBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  totalLabel: { fontSize: 11, fontWeight: "800" },
  totalRight: { flexDirection: "row", alignItems: "center" },
});
