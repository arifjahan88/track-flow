import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopStatusHeader } from "@/components/layout/top-status-header";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { computeUtilization, computeVehicleTco } from "@/lib/analytics";
import {
  COMPLIANCE_DOC_LABELS,
  getComplianceStatus,
} from "@/lib/compliance";
import {
  computeDriverSafetyScore,
  computeDriverStats,
  getLicenseStatus,
} from "@/lib/drivers";
import { formatCurrency } from "@/lib/format";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";
import type { VehicleLifecycleStatus } from "@/types";

type FleetTabMode = "vehicles" | "compliance" | "drivers" | "analytics";

const STATUS_BADGE: Record<
  VehicleLifecycleStatus,
  { label: string; tone: BadgeTone }
> = {
  on_trip: { label: "IN TRIP", tone: "cyan" },
  available: { label: "AVAILABLE", tone: "emerald" },
  under_maintenance: { label: "MAINTENANCE", tone: "amber" },
  out_of_service: { label: "OUT OF SERVICE", tone: "danger" },
  decommissioned: { label: "DECOMMISSIONED", tone: "neutral" },
};

export default function FleetHubScreen() {
  const theme = useTheme();
  const [subTab, setSubTab] = useState<FleetTabMode>("vehicles");

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const expenses = useFleetStore((s) => s.expenses);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);
  const addVehicle = useFleetStore((s) => s.addVehicle);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [vehName, setVehName] = useState("");
  const [vehPlate, setVehPlate] = useState("");
  const [vehOdometer, setVehOdometer] = useState("12500");

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const tcoRows = useMemo(
    () =>
      computeVehicleTco(
        vehicles,
        trips,
        fuelLogs,
        maintenanceRecords,
        workOrders,
        expenses,
        complianceDocs
      ),
    [
      vehicles,
      trips,
      fuelLogs,
      maintenanceRecords,
      workOrders,
      expenses,
      complianceDocs,
    ]
  );

  const utilization = useMemo(
    () => computeUtilization(vehicles, trips),
    [vehicles, trips]
  );

  const handleAddVehicle = () => {
    if (!vehName.trim() || !vehPlate.trim()) return;
    addVehicle({
      name: vehName.trim(),
      plate: vehPlate.trim(),
      type: "Van",
      odometerKm: Number(vehOdometer) || 10000,
    });
    triggerSuccessHaptic();
    setVehName("");
    setVehPlate("");
    setShowAddVehicle(false);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <TopStatusHeader
        title="Fleet Hub & Analytics"
        subtitle={`${vehicles.length} units · ${drivers.length} drivers · Compliance & TCO`}
      />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: "vehicles", label: "Vehicles", count: vehicles.length },
            {
              value: "compliance",
              label: "Compliance",
              count: complianceDocs.length,
            },
            { value: "drivers", label: "Drivers", count: drivers.length },
            { value: "analytics", label: "CPK / TCO" },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. VEHICLES REGISTRY */}
        {subTab === "vehicles" ? (
          <>
            <Button
              label={showAddVehicle ? "Cancel" : "+ Register New Fleet Vehicle"}
              variant="primary"
              fullWidth
              onPress={() => setShowAddVehicle((p) => !p)}
            />

            {showAddVehicle ? (
              <AnimatedCard index={0} elevated>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Add Fleet Vehicle
                </Text>
                <TextInput
                  value={vehName}
                  onChangeText={setVehName}
                  placeholder="Vehicle name (e.g. Dhaka Express Van 08)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <TextInput
                  value={vehPlate}
                  onChangeText={setVehPlate}
                  placeholder="License plate (e.g. FP-7741)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <TextInput
                  value={vehOdometer}
                  onChangeText={setVehOdometer}
                  keyboardType="numeric"
                  placeholder="Odometer (km)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <Button
                  label="Save Vehicle to Registry"
                  variant="primary"
                  fullWidth
                  onPress={handleAddVehicle}
                />
              </AnimatedCard>
            ) : null}

            {vehicles.map((v, idx) => {
              const st = v.status ?? "available";
              const assignedDriver = drivers.find(
                (d) => d.assignedVehicleId === v.id
              );
              const fuelPct = Math.round(v.fuelLevelPercent ?? 78);

              return (
                <AnimatedCard
                  key={v.id}
                  index={idx}
                  onPress={() =>
                    router.push(`/modal/vehicle-details?vehicleId=${v.id}`)
                  }
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge label={v.plate} tone="primary" mono />
                      <Badge
                        label={STATUS_BADGE[st].label}
                        tone={STATUS_BADGE[st].tone}
                      />
                    </View>
                    <Text
                      style={[
                        styles.monoVal,
                        { color: theme.textSecondary, fontFamily: Fonts?.mono },
                      ]}
                    >
                      {Math.round(v.odometerKm).toLocaleString()} km
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {v.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v.year ?? 2024} {v.make ?? "Commercial"}{" "}
                    {v.model ?? v.type} · {v.fuelType ?? "Diesel"} · Fuel{" "}
                    {fuelPct}% · Driver: {assignedDriver?.name ?? "Unassigned"}
                  </Text>

                  <View style={styles.actionFooter}>
                    <Button
                      label="Track on Live Map"
                      size="sm"
                      variant="primary"
                      style={styles.flex}
                      icon={
                        <Ionicons
                          name="navigate"
                          size={14}
                          color={theme.primaryForeground}
                        />
                      }
                      onPress={() => {
                        setSelectedVehicle(v.id);
                        router.navigate("/(tabs)");
                      }}
                    />
                    <Button
                      label="Profile & Lifecycle"
                      size="sm"
                      variant="secondary"
                      style={styles.flex}
                      onPress={() =>
                        router.push(`/modal/vehicle-details?vehicleId=${v.id}`)
                      }
                    />
                  </View>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 2. COMPLIANCE DOCUMENT VAULT */}
        {subTab === "compliance" ? (
          <>
            {complianceDocs.map((doc, idx) => {
              const v = vehiclesById.get(doc.vehicleId);
              const status = getComplianceStatus(doc.expiryDate);
              const tone: BadgeTone =
                status.level === "expired" || status.level === "critical_7d"
                  ? "danger"
                  : status.level === "warning_15d" ||
                      status.level === "notice_30d"
                    ? "amber"
                    : "emerald";

              return (
                <AnimatedCard key={doc.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <Badge
                      label={COMPLIANCE_DOC_LABELS[doc.docType].toUpperCase()}
                      tone="cyan"
                    />
                    <Badge label={status.label.toUpperCase()} tone={tone} />
                  </View>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {v?.name} ({v?.plate})
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Doc #{doc.documentNumber} · Issuer: {doc.issuer} · Expires{" "}
                    {doc.expiryDate}
                  </Text>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 3. DRIVERS & SAFETY LEADERBOARD */}
        {subTab === "drivers" ? (
          <>
            {drivers.map((d, idx) => {
              const safety = computeDriverSafetyScore(d.id, trips);
              const stats = computeDriverStats(d.id, trips);
              const licStatus = getLicenseStatus(d.licenseExpiry);
              const assignedVeh = vehiclesById.get(d.assignedVehicleId ?? "");
              const scoreTone: BadgeTone =
                safety.score >= 90
                  ? "emerald"
                  : safety.score >= 75
                    ? "cyan"
                    : "amber";

              return (
                <AnimatedCard key={d.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={`SAFETY ${safety.score}/100 · ${safety.grade.toUpperCase()}`}
                        tone={scoreTone}
                      />
                      {licStatus !== "valid" ? (
                        <Badge
                          label="LICENSE EXPIRING SOON"
                          tone="amber"
                        />
                      ) : null}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {d.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {d.licenseClass ?? "Commercial"} ({d.licenseNumber}) ·{" "}
                    {d.phone}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Assigned: {assignedVeh?.name ?? "Standby"} (
                    {assignedVeh?.plate ?? "—"}) · {stats.completedTrips} trips ·{" "}
                    {stats.totalDistanceKm} km
                  </Text>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 4. CPK / TCO & UTILIZATION ANALYTICS */}
        {subTab === "analytics" ? (
          <>
            <Text
              style={[styles.sectionHeading, { color: theme.textSecondary }]}
            >
              COST PER KILOMETER (CPK) & TOTAL COST OF OWNERSHIP (TCO)
            </Text>
            {tcoRows.map((row, idx) => {
              const util = utilization.byVehicle.find(
                (u) => u.vehicleId === row.vehicleId
              );
              return (
                <AnimatedCard key={row.vehicleId} index={idx}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge label={row.plate} tone="cyan" mono />
                      <Badge
                        label={
                          row.cpk
                            ? `$${row.cpk.toFixed(2)} / km`
                            : "STANDBY"
                        }
                        tone="emerald"
                        mono
                      />
                    </View>
                    <Text
                      style={[
                        styles.costText,
                        { color: theme.text, fontFamily: Fonts?.mono },
                      ]}
                    >
                      TCO {formatCurrency(row.totalTco)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {row.vehicleName}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Fuel {formatCurrency(row.fuelCost)} · Maint{" "}
                    {formatCurrency(row.maintenanceCost)} · Expenses{" "}
                    {formatCurrency(row.expenseCost)} · Depr{" "}
                    {formatCurrency(row.depreciationCost)}
                  </Text>
                  <Text
                    style={[
                      styles.cardSub,
                      { color: theme.primary, marginTop: 4 },
                    ]}
                  >
                    Utilization: {util?.utilizationPct ?? 0}% (
                    {util?.tripCount ?? 0} completed trips · {row.distanceKm} km)
                  </Text>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  segmentWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 36,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  monoVal: {
    fontSize: 12,
    fontWeight: "700",
  },
  costText: {
    fontSize: 14,
    fontWeight: "800",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  cardSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  actionFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  input: {
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginTop: 8,
  },
});
