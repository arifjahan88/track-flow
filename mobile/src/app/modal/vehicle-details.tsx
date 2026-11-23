import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ObdStrip } from "@/components/ui/obd-strip";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  COMPLIANCE_DOC_LABELS,
  getComplianceStatus,
} from "@/lib/compliance";
import { triggerLightHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";
import type { VehicleLifecycleStatus } from "@/types";

const LIFECYCLE_STATES: Array<{
  key: VehicleLifecycleStatus;
  label: string;
  tone: BadgeTone;
}> = [
  { key: "available", label: "Available", tone: "emerald" },
  { key: "on_trip", label: "On Trip", tone: "cyan" },
  { key: "under_maintenance", label: "Maintenance", tone: "amber" },
  { key: "out_of_service", label: "Out of Service", tone: "danger" },
  { key: "decommissioned", label: "Decommissioned", tone: "neutral" },
];

export default function VehicleDetailsModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const trips = useFleetStore((s) => s.trips);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const setVehicleStatus = useFleetStore((s) => s.setVehicleStatus);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);

  const vehicle =
    vehicles.find((v) => v.id === (params.vehicleId || selectedVehicleId)) ??
    vehicles[0];

  if (!vehicle) return null;

  const assignedDriver = drivers.find(
    (d) => d.assignedVehicleId === vehicle.id
  );
  const vehicleDocs = complianceDocs.filter((c) => c.vehicleId === vehicle.id);
  const vehicleTrips = trips.filter((t) => t.vehicleId === vehicle.id);

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
            {vehicle.name}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: theme.primary, fontFamily: Fonts?.mono },
            ]}
          >
            {vehicle.plate} · VIN {vehicle.vin ?? "JTFSX22P806041291"}
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
        {/* Asset Specification Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            VEHICLE SPECIFICATIONS & TELEMETRY
          </Text>

          <View style={styles.specGrid}>
            <View
              style={[
                styles.specBox,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.specKey, { color: theme.textSecondary }]}>
                MAKE / MODEL
              </Text>
              <Text style={[styles.specVal, { color: theme.text }]}>
                {vehicle.year ?? 2024} {vehicle.make ?? "Volvo"}{" "}
                {vehicle.model ?? vehicle.type}
              </Text>
            </View>
            <View
              style={[
                styles.specBox,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.specKey, { color: theme.textSecondary }]}>
                ODOMETER
              </Text>
              <Text
                style={[
                  styles.specVal,
                  { color: theme.text, fontFamily: Fonts?.mono },
                ]}
              >
                {Math.round(vehicle.odometerKm).toLocaleString()} km
              </Text>
            </View>
            <View
              style={[
                styles.specBox,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.specKey, { color: theme.textSecondary }]}>
                FUEL / TANK
              </Text>
              <Text style={[styles.specVal, { color: theme.text }]}>
                {vehicle.fuelType ?? "Diesel"} ·{" "}
                {vehicle.tankCapacityLiters ?? 140} L
              </Text>
            </View>
            <View
              style={[
                styles.specBox,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.specKey, { color: theme.textSecondary }]}>
                ASSIGNED DRIVER
              </Text>
              <Text style={[styles.specVal, { color: theme.text }]}>
                {assignedDriver?.name ?? "Standby Pool"}
              </Text>
            </View>
          </View>

          <ObdStrip
            ignitionOn={vehicle.status === "on_trip"}
            fuelLevelPercent={vehicle.fuelLevelPercent}
          />
        </View>

        {/* Status Lifecycle Switcher */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            STATUS LIFECYCLE CONTROL
          </Text>
          <View style={styles.chipWrap}>
            {LIFECYCLE_STATES.map((item) => {
              const active = (vehicle.status ?? "available") === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    triggerLightHaptic();
                    setVehicleStatus(vehicle.id, item.key);
                  }}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: active
                        ? theme.primary
                        : theme.muted,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: active ? theme.primaryForeground : theme.text,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Compliance Documents */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            COMPLIANCE VAULT ({vehicleDocs.length})
          </Text>
          {vehicleDocs.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No compliance documents attached to this unit.
            </Text>
          ) : (
            vehicleDocs.map((doc) => {
              const st = getComplianceStatus(doc.expiryDate);
              return (
                <View
                  key={doc.id}
                  style={[
                    styles.docRow,
                    { backgroundColor: theme.muted, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.docInfo}>
                    <Text style={[styles.docTitle, { color: theme.text }]}>
                      {COMPLIANCE_DOC_LABELS[doc.docType]}
                    </Text>
                    <Text
                      style={[styles.docSub, { color: theme.textSecondary }]}
                    >
                      {doc.documentNumber} · Expires {doc.expiryDate}
                    </Text>
                  </View>
                  <Badge
                    label={st.label}
                    tone={
                      st.level === "valid"
                        ? "emerald"
                        : st.level === "expired"
                          ? "danger"
                          : "amber"
                    }
                  />
                </View>
              );
            })
          )}
        </View>

        {/* Recent Trips Summary */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            RECENT TRIPS ({vehicleTrips.length})
          </Text>
          {vehicleTrips.slice(0, 3).map((t) => (
            <View
              key={t.id}
              style={[
                styles.docRow,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <View style={styles.docInfo}>
                <Text style={[styles.docTitle, { color: theme.text }]}>
                  {t.purpose}
                </Text>
                <Text style={[styles.docSub, { color: theme.textSecondary }]}>
                  {t.distanceKm.toFixed(1)} km · Max {Math.round(t.maxSpeedKmh)}{" "}
                  km/h
                </Text>
              </View>
              <Badge
                label={t.status.toUpperCase()}
                tone={t.status === "active" ? "cyan" : "emerald"}
              />
            </View>
          ))}
        </View>

        <Button
          label="Focus Camera on Live Map Cockpit"
          variant="primary"
          size="lg"
          fullWidth
          icon={
            <Ionicons
              name="navigate"
              size={18}
              color={theme.primaryForeground}
            />
          }
          onPress={() => {
            setSelectedVehicle(vehicle.id);
            router.dismissAll();
            router.navigate("/(tabs)");
          }}
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
  sub: { fontSize: 11, marginTop: 2 },
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
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  specBox: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 2,
  },
  specKey: { fontSize: 9, fontWeight: "800" },
  specVal: { fontSize: 13, fontWeight: "700" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  emptyText: { fontSize: 12 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8,
  },
  docInfo: { flex: 1, gap: 2 },
  docTitle: { fontSize: 13, fontWeight: "700" },
  docSub: { fontSize: 11 },
});
