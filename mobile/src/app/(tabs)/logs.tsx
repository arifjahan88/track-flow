import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopStatusHeader } from "@/components/layout/top-status-header";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { computeWorkOrderTotal } from "@/lib/analytics";
import { formatCurrency } from "@/lib/format";
import { computeFuelEfficiency, detectFuelAnomalies } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { can } from "@/lib/rbac";
import {
  getScopedExpenses,
  getScopedFuelLogs,
  getScopedIncidents,
} from "@/lib/rbac-scope";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { WorkOrderStatus } from "@/types";

type LogsTabMode = "fuel" | "expenses" | "maintenance" | "incidents";

const NEXT_WO_STATUS: Record<WorkOrderStatus, WorkOrderStatus> = {
  open: "in_progress",
  in_progress: "waiting_parts",
  waiting_parts: "completed",
  completed: "completed",
};

export default function LogsScreen() {
  const theme = useTheme();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";
  const canServiceBay =
    can(activeRole, "maintenance:write") || can(activeRole, "work_orders:write");
  const canFuel = can(activeRole, "fuel:write");
  const canExpenses = can(activeRole, "expenses:write");

  const [subTab, setSubTab] = useState<LogsTabMode>(
    activeRole === "mechanic" ? "maintenance" : "fuel"
  );

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const bookings = useFleetStore((s) => s.bookings);
  const trips = useFleetStore((s) => s.trips);
  const allFuelLogs = useFleetStore((s) => s.fuelLogs);
  const allExpenses = useFleetStore((s) => s.expenses);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const allIncidents = useFleetStore((s) => s.incidents);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);

  const fuelLogs = useMemo(
    () =>
      getScopedFuelLogs(
        currentUser,
        drivers,
        vehicles,
        bookings,
        trips,
        allFuelLogs
      ),
    [currentUser, drivers, vehicles, bookings, trips, allFuelLogs]
  );
  const expenses = useMemo(
    () =>
      getScopedExpenses(
        currentUser,
        drivers,
        vehicles,
        bookings,
        trips,
        allExpenses
      ),
    [currentUser, drivers, vehicles, bookings, trips, allExpenses]
  );
  const incidents = useMemo(
    () =>
      getScopedIncidents(
        currentUser,
        drivers,
        vehicles,
        bookings,
        trips,
        allIncidents
      ),
    [currentUser, drivers, vehicles, bookings, trips, allIncidents]
  );

  const availableOptions = useMemo(() => {
    const opts: Array<{ value: LogsTabMode; label: string; count: number }> = [];
    if (canFuel) opts.push({ value: "fuel", label: "Fuel", count: fuelLogs.length });
    if (canExpenses) {
      opts.push({ value: "expenses", label: "Expenses", count: expenses.length });
    }
    if (canServiceBay) {
      opts.push({
        value: "maintenance",
        label: "Service",
        count: workOrders.length + maintenanceRecords.length,
      });
    }
    opts.push({ value: "incidents", label: "SOS", count: incidents.length });
    return opts;
  }, [
    canFuel,
    canExpenses,
    canServiceBay,
    fuelLogs.length,
    expenses.length,
    workOrders.length,
    maintenanceRecords.length,
    incidents.length,
  ]);

  const effectiveSubTab: LogsTabMode = availableOptions.some(
    (o) => o.value === subTab
  )
    ? subTab
    : (availableOptions[0]?.value ?? "incidents");

  const completeMaintenanceRecord = useFleetStore(
    (s) => s.completeMaintenanceRecord
  );
  const updateWorkOrderStatus = useFleetStore((s) => s.updateWorkOrderStatus);
  const updateIncidentStatus = useFleetStore((s) => s.updateIncidentStatus);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const anomaliesByLog = useMemo(
    () => detectFuelAnomalies(fuelLogs, vehiclesById),
    [fuelLogs, vehiclesById]
  );

  const efficiencyByLog = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vehicles) {
      const vLogs = fuelLogs.filter((f) => f.vehicleId === v.id);
      const pts = computeFuelEfficiency(vLogs);
      for (const p of pts) {
        map.set(p.logId, p.kmPerLiter);
      }
    }
    return map;
  }, [vehicles, fuelLogs]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <TopStatusHeader
        title="Field Logs & Service Bay"
        subtitle="Fuel fill-ups, tolls, preventive service & roadside SOS"
      />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={availableOptions}
          value={effectiveSubTab}
          onChange={setSubTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. FUEL FILL-UP LOGS & ANOMALY DETECTION */}
        {effectiveSubTab === "fuel" ? (
          <>
            <Button
              label="+ Log Fuel Fill-Up"
              variant="primary"
              fullWidth
              icon={
                <Ionicons
                  name="water"
                  size={16}
                  color={theme.primaryForeground}
                />
              }
              onPress={() =>
                router.push(
                  `/modal/quick-fuel?vehicleId=${selectedVehicleId}`
                )
              }
            />

            {fuelLogs.map((f, idx) => {
              const v = vehiclesById.get(f.vehicleId);
              const kmL = efficiencyByLog.get(f.id);
              const anomalies = anomaliesByLog.get(f.id) ?? [];

              return (
                <AnimatedCard key={f.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge label={v?.plate ?? "FLEET"} tone="cyan" mono />
                      {kmL ? (
                        <Badge
                          label={`${kmL} km/L`}
                          tone="emerald"
                          mono
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.costText,
                        { color: theme.text, fontFamily: Fonts?.mono },
                      ]}
                    >
                      {formatCurrency(f.totalCost)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {v?.name} · {f.liters.toFixed(1)} L @ $
                    {f.pricePerLiter.toFixed(2)}/L
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {f.station ?? "Fleet Fuel Hub"} · Odometer{" "}
                    {f.odometerKm.toLocaleString()} km · {f.date}
                  </Text>

                  {anomalies.map((anom, i) => (
                    <View
                      key={i}
                      style={[
                        styles.anomalyBox,
                        {
                          backgroundColor: "rgba(255, 107, 115, 0.12)",
                          borderColor: theme.danger,
                        },
                      ]}
                    >
                      <Ionicons
                        name="warning"
                        size={14}
                        color={theme.danger}
                      />
                      <Text
                        style={[styles.anomalyText, { color: theme.danger }]}
                      >
                        Anomaly: {anom.message}
                      </Text>
                    </View>
                  ))}
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 2. OPERATING EXPENSES (TOLLS, PARKING, ALLOWANCES) */}
        {effectiveSubTab === "expenses" ? (
          <>
            <Button
              label="+ Log Toll / Parking / Allowance"
              variant="emerald"
              fullWidth
              icon={<Ionicons name="receipt" size={16} color="#FFFFFF" />}
              onPress={() =>
                router.push(
                  `/modal/quick-expense?vehicleId=${selectedVehicleId}`
                )
              }
            />

            {expenses.map((e, idx) => {
              const v = vehiclesById.get(e.vehicleId);
              return (
                <AnimatedCard key={e.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <Badge label={e.category.toUpperCase()} tone="violet" />
                    <Text
                      style={[
                        styles.costText,
                        { color: theme.text, fontFamily: Fonts?.mono },
                      ]}
                    >
                      {formatCurrency(e.amount)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {e.description}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · {e.costCenter ?? "Operations"} ·{" "}
                    {e.date}
                  </Text>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 3. PREVENTIVE SERVICE RULES & MECHANIC WORK ORDERS */}
        {effectiveSubTab === "maintenance" ? (
          <>
            <Text
              style={[styles.sectionHeading, { color: theme.textSecondary }]}
            >
              ACTIVE SERVICE BAY WORK ORDERS ({workOrders.length})
            </Text>
            {workOrders.map((wo, idx) => {
              const v = vehiclesById.get(wo.vehicleId);
              const total = computeWorkOrderTotal(wo);
              const tone =
                wo.status === "completed"
                  ? "emerald"
                  : wo.priority === "critical" || wo.priority === "high"
                    ? "danger"
                    : "amber";

              return (
                <AnimatedCard key={wo.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={wo.status.replaceAll("_", " ").toUpperCase()}
                        tone={tone}
                      />
                      <Badge
                        label={`${wo.priority.toUpperCase()} PRIORITY`}
                        tone="amber"
                      />
                    </View>
                    <Text
                      style={[
                        styles.costText,
                        { color: theme.text, fontFamily: Fonts?.mono },
                      ]}
                    >
                      {formatCurrency(total)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {wo.title}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · Vendor: {wo.vendorName} · Downtime{" "}
                    {wo.downtimeHours}h
                  </Text>

                  {wo.parts.length > 0 ? (
                    <View
                      style={[
                        styles.partsBox,
                        {
                          backgroundColor: theme.muted,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      {wo.parts.map((pt) => (
                        <Text
                          key={pt.id}
                          style={[
                            styles.partLine,
                            { color: theme.textSecondary },
                          ]}
                        >
                          • {pt.name} (x{pt.qty}) —{" "}
                          {formatCurrency(pt.qty * pt.unitCost)}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {wo.status !== "completed" ? (
                    <Button
                      label={`Advance Status → ${NEXT_WO_STATUS[wo.status].replaceAll("_", " ").toUpperCase()}`}
                      size="sm"
                      variant="primary"
                      fullWidth
                      style={{ marginTop: 10 }}
                      onPress={() =>
                        updateWorkOrderStatus(wo.id, NEXT_WO_STATUS[wo.status])
                      }
                    />
                  ) : null}
                </AnimatedCard>
              );
            })}

            <Text
              style={[styles.sectionHeading, { color: theme.textSecondary }]}
            >
              PREVENTIVE MAINTENANCE RULES ({maintenanceRecords.length})
            </Text>
            {maintenanceRecords.map((m, idx) => {
              const v = vehiclesById.get(m.vehicleId);
              const status = getMaintenanceStatus(
                m,
                v?.odometerKm ?? 0,
                Date.now(),
                v?.engineHours
              );
              const tone =
                status === "completed"
                  ? "emerald"
                  : status === "overdue"
                    ? "danger"
                    : status === "due_soon"
                      ? "amber"
                      : "cyan";

              return (
                <AnimatedCard key={m.id} index={idx + 2}>
                  <View style={styles.rowBetween}>
                    <Badge
                      label={status.replaceAll("_", " ").toUpperCase()}
                      tone={tone}
                    />
                    {m.cost ? (
                      <Text
                        style={[
                          styles.costText,
                          { color: theme.text, fontFamily: Fonts?.mono },
                        ]}
                      >
                        {formatCurrency(m.cost)}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {m.title}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · Due{" "}
                    {m.dueOdometerKm?.toLocaleString() ?? "—"} km · Scheduled{" "}
                    {m.scheduledDate ?? "—"}
                  </Text>

                  {status !== "completed" ? (
                    <Button
                      label="Mark Service Completed"
                      size="sm"
                      variant="emerald"
                      fullWidth
                      style={{ marginTop: 10 }}
                      onPress={() =>
                        completeMaintenanceRecord(
                          m.id,
                          new Date().toISOString().slice(0, 10),
                          m.cost
                        )
                      }
                    />
                  ) : null}
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* 4. ROADSIDE INCIDENTS & SOS REPORTS */}
        {effectiveSubTab === "incidents" ? (
          <>
            <Button
              label="SOS · Report Roadside Incident / Accident"
              variant="danger"
              fullWidth
              icon={<Ionicons name="warning" size={16} color="#FFFFFF" />}
              onPress={() =>
                router.push(
                  `/modal/report-incident?vehicleId=${selectedVehicleId}`
                )
              }
            />

            {incidents.map((inc, idx) => {
              const v = vehiclesById.get(inc.vehicleId);
              const tone =
                inc.status === "resolved"
                  ? "emerald"
                  : inc.severity === "major"
                    ? "danger"
                    : "amber";

              return (
                <AnimatedCard key={inc.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={`${inc.severity.toUpperCase()} SEVERITY`}
                        tone={tone}
                      />
                      <Badge label={inc.status.toUpperCase()} tone="cyan" />
                    </View>
                    {inc.estimatedCost ? (
                      <Text
                        style={[
                          styles.costText,
                          { color: theme.text, fontFamily: Fonts?.mono },
                        ]}
                      >
                        Est. {formatCurrency(inc.estimatedCost)}
                      </Text>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {inc.locationLabel}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · {inc.occurredAt} ·{" "}
                    {inc.description}
                  </Text>

                  {inc.status !== "resolved" ? (
                    <Button
                      label="Mark Incident Resolved"
                      size="sm"
                      variant="secondary"
                      fullWidth
                      style={{ marginTop: 10 }}
                      onPress={() => updateIncidentStatus(inc.id, "resolved")}
                    />
                  ) : null}
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
  costText: {
    fontSize: 15,
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
  anomalyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: 8,
  },
  anomalyText: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 6,
  },
  partsBox: {
    marginTop: 8,
    padding: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 3,
  },
  partLine: {
    fontSize: 11,
    fontWeight: "600",
  },
});
