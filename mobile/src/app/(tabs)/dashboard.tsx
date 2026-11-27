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
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getComplianceStatus } from "@/lib/compliance";
import {
  checkDriverAvailability,
  computeDriverSafetyScore,
} from "@/lib/drivers";
import { formatKm, offsetIsoDate } from "@/lib/format";
import { detectFuelAnomalies } from "@/lib/fuel";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { BookingStatus, WorkOrderStatus } from "@/types";

const NEXT_WO_STATUS: Record<WorkOrderStatus, WorkOrderStatus> = {
  open: "in_progress",
  in_progress: "waiting_parts",
  waiting_parts: "completed",
  completed: "completed",
};

const STATUS_BADGE: Record<BookingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "PENDING ADMIN", tone: "amber" },
  assigned: { label: "DRIVER ASSIGNED", tone: "primary" },
  in_progress: { label: "IN PROGRESS", tone: "success" },
  completed: { label: "COMPLETED", tone: "neutral" },
  rejected: { label: "REJECTED", tone: "danger" },
};

export default function RoleDashboardScreen() {
  const theme = useTheme();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const bookings = useFleetStore((s) => s.bookings);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const incidents = useFleetStore((s) => s.incidents);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);

  const addBooking = useFleetStore((s) => s.addBooking);
  const rejectBooking = useFleetStore((s) => s.rejectBooking);
  const removeBooking = useFleetStore((s) => s.removeBooking);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);
  const updateWorkOrderStatus = useFleetStore((s) => s.updateWorkOrderStatus);
  const completeMaintenanceRecord = useFleetStore(
    (s) => s.completeMaintenanceRecord
  );
  const setVehicleStatus = useFleetStore((s) => s.setVehicleStatus);

  // Quick inline Trip Request form (used by Employee & others)
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [purpose, setPurpose] = useState("");
  const [estimatedKm, setEstimatedKm] = useState("22");

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const activeDriver = useMemo(
    () =>
      drivers.find((d) => d.id === currentUser?.driverId) ??
      drivers.find((d) => d.name === currentUser?.name) ??
      drivers[0],
    [drivers, currentUser]
  );

  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings]
  );
  const myEmployeeBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          !currentUser ||
          b.requesterUserId === currentUser.id ||
          b.requesterName.toLowerCase() === currentUser.name.toLowerCase()
      ),
    [bookings, currentUser]
  );
  const driverAssignedBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "assigned" &&
          (!activeDriver || b.driverId === activeDriver.id)
      ),
    [bookings, activeDriver]
  );
  const driverActiveTrips = useMemo(
    () =>
      trips.filter(
        (t) =>
          t.status !== "done" &&
          (t.driverId === activeDriver?.id ||
            t.vehicleId === currentUser?.assignedVehicleId)
      ),
    [trips, activeDriver, currentUser?.assignedVehicleId]
  );

  const openWorkOrders = useMemo(
    () => workOrders.filter((w) => w.status !== "completed"),
    [workOrders]
  );
  const dueServices = useMemo(
    () =>
      maintenanceRecords.filter((rec) => {
        const v = vehiclesById.get(rec.vehicleId);
        const st = getMaintenanceStatus(
          rec,
          v?.odometerKm ?? 0,
          undefined,
          v?.engineHours
        );
        return st === "overdue" || st === "due_soon";
      }),
    [maintenanceRecords, vehiclesById]
  );
  const expiringCompliance = useMemo(
    () =>
      complianceDocs.filter(
        (c) => getComplianceStatus(c.expiryDate).level !== "valid"
      ),
    [complianceDocs]
  );
  const fuelAnomalyCount = useMemo(
    () =>
      Array.from(detectFuelAnomalies(fuelLogs, vehiclesById).values()).reduce(
        (s, arr) => s + arr.length,
        0
      ),
    [fuelLogs, vehiclesById]
  );

  const handleSubmitRequest = () => {
    if (!purpose.trim() || !pickup.trim() || !dropoff.trim()) return;
    addBooking({
      requesterUserId: currentUser?.id,
      requesterName: currentUser?.name ?? "Nadia Karim",
      department: activeRole === "employee" ? "Staff Operations" : "Dispatch",
      purpose: purpose.trim(),
      pickupLocation: pickup.trim(),
      dropoffLocation: dropoff.trim(),
      requestedDate: offsetIsoDate(0),
      requestedTime: "10:30",
      passengerCount: 1,
      estimatedKm: Math.max(2, Number(estimatedKm) || 15),
    });
    triggerSuccessHaptic();
    setPickup("");
    setDropoff("");
    setPurpose("");
    setShowRequestForm(false);
  };

  const todayIso = offsetIsoDate(0);
  const inTripCount = vehicles.filter((v) => v.status === "on_trip").length;
  const standbyCount = vehicles.filter(
    (v) => (v.status ?? "available") === "available"
  ).length;
  const availableDriverCount = drivers.filter(
    (d) => checkDriverAvailability(d, todayIso, trips).available
  ).length;
  const driverSafety = activeDriver
    ? computeDriverSafetyScore(activeDriver.id, trips)
    : { score: 100, grade: "Excellent" as const };

  const headerTitle =
    activeRole === "employee"
      ? "My Trip Portal"
      : activeRole === "driver"
        ? "Driver Duty Hub"
        : activeRole === "mechanic"
          ? "Mechanic Service Bay"
          : activeRole === "dispatcher"
            ? "Dispatch Control Hub"
            : activeRole === "fleet_manager"
              ? "Fleet Manager Hub"
              : "Super Admin Command";

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <TopStatusHeader
        title={headerTitle}
        subtitle={`${currentUser?.name ?? "User"} · ${ROLE_LABELS[activeRole]}`}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================
         * 1. EMPLOYEE / USER VIEW
         * ============================================================== */}
        {activeRole === "employee" ? (
          <>
            <AnimatedCard index={0} active>
              <Badge label="EMPLOYEE TRIP PORTAL" tone="primary" />
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                Need a vehicle for your trip?
              </Text>
              <Text style={[styles.subText, { color: theme.textSecondary }]}>
                Submit pickup &amp; drop-off details. Admin assigns a driver &amp;
                vehicle, then track live until completion.
              </Text>
              <Button
                label={showRequestForm ? "Close Form" : "+ Request a Trip"}
                variant="primary"
                fullWidth
                onPress={() => {
                  triggerLightHaptic();
                  setShowRequestForm((p) => !p);
                }}
              />
            </AnimatedCard>

            {showRequestForm ? (
              <AnimatedCard index={1} elevated>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  New Trip Request
                </Text>
                <TextInput
                  value={pickup}
                  onChangeText={setPickup}
                  placeholder="Pickup location (e.g. Gulshan-2 HQ)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.muted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <TextInput
                  value={dropoff}
                  onChangeText={setDropoff}
                  placeholder="Drop-off destination (e.g. Airport Gate 4)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.muted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <TextInput
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="Trip purpose (e.g. Client site visit)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.muted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <TextInput
                  value={estimatedKm}
                  onChangeText={setEstimatedKm}
                  keyboardType="numeric"
                  placeholder="Estimated distance (km)"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.muted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
                <Button
                  label="Submit Request to Admin"
                  variant="emerald"
                  fullWidth
                  onPress={handleSubmitRequest}
                />
              </AnimatedCard>
            ) : null}

            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.brandAmber, fontFamily: Fonts.mono }]}>
                  {myEmployeeBookings.filter((b) => b.status === "pending").length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  PENDING
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.primary, fontFamily: Fonts.mono }]}>
                  {
                    myEmployeeBookings.filter(
                      (b) => b.status === "assigned" || b.status === "in_progress"
                    ).length
                  }
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  ACTIVE
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.statusLive, fontFamily: Fonts.mono }]}>
                  {myEmployeeBookings.filter((b) => b.status === "completed").length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  DONE
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              MY TRIP REQUESTS ({myEmployeeBookings.length})
            </Text>

            {myEmployeeBookings.map((b, idx) => {
              const meta = STATUS_BADGE[b.status] ?? STATUS_BADGE.pending;
              const drv = b.driverId ? driversById.get(b.driverId) : undefined;
              const veh = b.vehicleId ? vehiclesById.get(b.vehicleId) : undefined;
              return (
                <AnimatedCard key={b.id} index={idx + 2}>
                  <View style={styles.rowBetween}>
                    <Badge label={meta.label} tone={meta.tone} />
                    <Text
                      style={[
                        styles.monoMeta,
                        { color: theme.textSecondary, fontFamily: Fonts.mono },
                      ]}
                    >
                      {b.requestedDate} · {b.estimatedKm} km
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {b.purpose}
                  </Text>
                  <Text style={[styles.subText, { color: theme.textSecondary }]}>
                    {b.pickupLocation ?? "Central Hub"} →{" "}
                    {b.dropoffLocation ?? b.purpose}
                  </Text>
                  {drv && veh ? (
                    <Text style={[styles.assignedLine, { color: theme.primary }]}>
                      Driver: {drv.name} ({drv.phone}) · {veh.name} ({veh.plate})
                    </Text>
                  ) : null}
                  <View style={styles.btnRow}>
                    {b.status === "in_progress" && b.vehicleId ? (
                      <Button
                        label="Track Driver Live"
                        size="sm"
                        variant="primary"
                        style={styles.flex}
                        onPress={() => {
                          setSelectedVehicle(b.vehicleId!);
                          router.navigate("/(tabs)");
                        }}
                      />
                    ) : null}
                    {b.status === "pending" ? (
                      <Button
                        label="Cancel Request"
                        size="sm"
                        variant="secondary"
                        style={styles.flex}
                        onPress={() => removeBooking(b.id)}
                      />
                    ) : null}
                  </View>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* ================================================================
         * 2. DRIVER VIEW (Assigned Trips Ready to Start + Active Trip)
         * ============================================================== */}
        {activeRole === "driver" ? (
          <>
            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.primary, fontFamily: Fonts.mono }]}>
                  {driverAssignedBookings.length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  ASSIGNED
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.statusLive, fontFamily: Fonts.mono }]}>
                  {driverActiveTrips.length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  LIVE TRIP
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {driverSafety.score}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  SAFETY
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              ASSIGNED TRIPS — READY TO START ({driverAssignedBookings.length})
            </Text>

            {driverAssignedBookings.length === 0 ? (
              <AnimatedCard index={0}>
                <Text style={[styles.subText, { color: theme.textSecondary }]}>
                  No new Admin-assigned trips waiting. Check Active Trips below or
                  open Drive Map.
                </Text>
              </AnimatedCard>
            ) : (
              driverAssignedBookings.map((b, idx) => {
                const veh = b.vehicleId ? vehiclesById.get(b.vehicleId) : undefined;
                return (
                  <AnimatedCard key={b.id} index={idx} active>
                    <View style={styles.rowBetween}>
                      <Badge label="ASSIGNED BY ADMIN" tone="primary" />
                      <Text
                        style={[
                          styles.monoMeta,
                          { color: theme.textSecondary, fontFamily: Fonts.mono },
                        ]}
                      >
                        {b.estimatedKm} km
                      </Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      {b.purpose}
                    </Text>
                    <Text style={[styles.subText, { color: theme.textSecondary }]}>
                      {b.pickupLocation ?? "Central Hub"} →{" "}
                      {b.dropoffLocation ?? b.purpose}
                    </Text>
                    <Text style={[styles.subText, { color: theme.textSecondary }]}>
                      Requester: {b.requesterName} · Unit: {veh?.name ?? "Fleet Unit"} (
                      {veh?.plate ?? "PLATE"})
                    </Text>
                    <Button
                      label="Start Trip (Pre-Check)"
                      variant="emerald"
                      fullWidth
                      icon={<Ionicons name="play" size={16} color="#FFFFFF" />}
                      onPress={() =>
                        router.push(
                          `/modal/checklist?phase=pre&bookingId=${b.id}&vehicleId=${b.vehicleId ?? "veh-4"}&purpose=${encodeURIComponent(b.purpose)}`
                        )
                      }
                    />
                  </AnimatedCard>
                );
              })
            )}

            {driverActiveTrips.length > 0 ? (
              <>
                <Text
                  style={[styles.sectionHeading, { color: theme.textSecondary }]}
                >
                  MY ACTIVE LIVE TRIPS ({driverActiveTrips.length})
                </Text>
                {driverActiveTrips.map((t, idx) => {
                  const v = vehiclesById.get(t.vehicleId);
                  return (
                    <AnimatedCard key={t.id} index={idx + 2}>
                      <View style={styles.rowBetween}>
                        <Badge label="LIVE ON ROUTE" tone="success" />
                        <Badge label={v?.plate ?? "UNIT"} tone="primary" mono />
                      </View>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>
                        {t.purpose}
                      </Text>
                      <Text style={[styles.subText, { color: theme.textSecondary }]}>
                        {v?.name} · {formatKm(t.distanceKm)} km covered
                      </Text>
                      <View style={styles.btnRow}>
                        <Button
                          label="Drive Map"
                          size="sm"
                          variant="secondary"
                          style={styles.flex}
                          onPress={() => {
                            setSelectedVehicle(t.vehicleId);
                            router.navigate("/(tabs)");
                          }}
                        />
                        <Button
                          label="Finish Trip"
                          size="sm"
                          variant="danger"
                          style={styles.flex}
                          onPress={() =>
                            router.push(
                              `/modal/checklist?phase=post&vehicleId=${t.vehicleId}`
                            )
                          }
                        />
                      </View>
                    </AnimatedCard>
                  );
                })}
              </>
            ) : null}

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              QUICK FIELD ACTIONS
            </Text>
            <View style={styles.btnRow}>
              <Button
                label="Log Fuel"
                size="sm"
                variant="secondary"
                style={styles.flex}
                onPress={() =>
                  router.push(`/modal/quick-fuel?vehicleId=${selectedVehicleId}`)
                }
              />
              <Button
                label="Expense"
                size="sm"
                variant="secondary"
                style={styles.flex}
                onPress={() =>
                  router.push(
                    `/modal/quick-expense?vehicleId=${selectedVehicleId}`
                  )
                }
              />
              <Button
                label="SOS"
                size="sm"
                variant="danger"
                style={styles.flex}
                onPress={() =>
                  router.push(
                    `/modal/report-incident?vehicleId=${selectedVehicleId}`
                  )
                }
              />
            </View>
          </>
        ) : null}

        {/* ================================================================
         * 3. MECHANIC VIEW (Service Bay KPIs + Inline Work Order Control)
         * ============================================================== */}
        {activeRole === "mechanic" ? (
          <>
            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.primary, fontFamily: Fonts.mono }]}>
                  {openWorkOrders.length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  WORK ORDERS
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.brandAmber, fontFamily: Fonts.mono }]}>
                  {dueServices.length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  DUE SERVICES
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.danger, fontFamily: Fonts.mono }]}>
                  {incidents.filter((i) => i.status !== "resolved").length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  OPEN SOS
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              ACTIVE WORK ORDERS ({openWorkOrders.length})
            </Text>
            {openWorkOrders.map((wo, idx) => {
              const v = vehiclesById.get(wo.vehicleId);
              const next = NEXT_WO_STATUS[wo.status];
              return (
                <AnimatedCard key={wo.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <Badge label={wo.priority.toUpperCase()} tone="amber" />
                    <Badge
                      label={wo.status.replaceAll("_", " ").toUpperCase()}
                      tone="primary"
                    />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {wo.title}
                  </Text>
                  <Text style={[styles.subText, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · Vendor: {wo.vendorName}
                  </Text>
                  <Button
                    label={`Advance → ${next.replaceAll("_", " ")}`}
                    size="sm"
                    variant="primary"
                    fullWidth
                    onPress={() => {
                      triggerSuccessHaptic();
                      updateWorkOrderStatus(
                        wo.id,
                        next,
                        next === "completed" ? todayIso : undefined
                      );
                    }}
                  />
                </AnimatedCard>
              );
            })}

            {vehicles
              .filter((v) => v.status === "under_maintenance")
              .map((v, idx) => (
                <AnimatedCard key={v.id} index={idx + 3}>
                  <View style={styles.rowBetween}>
                    <Badge label="IN SERVICE BAY" tone="amber" />
                    <Badge label={v.plate} tone="neutral" mono />
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {v.name}
                  </Text>
                  <Button
                    label="Release Vehicle to Available"
                    size="sm"
                    variant="emerald"
                    fullWidth
                    onPress={() => {
                      triggerSuccessHaptic();
                      setVehicleStatus(v.id, "available");
                    }}
                  />
                </AnimatedCard>
              ))}

            {dueServices.slice(0, 3).map((rec, idx) => {
              const v = vehiclesById.get(rec.vehicleId);
              return (
                <AnimatedCard key={rec.id} index={idx + 5}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {rec.title}
                  </Text>
                  <Text style={[styles.subText, { color: theme.textSecondary }]}>
                    {v?.name} ({v?.plate}) · {rec.type}
                  </Text>
                  <Button
                    label="Mark Service Completed"
                    size="sm"
                    variant="secondary"
                    fullWidth
                    onPress={() => {
                      triggerSuccessHaptic();
                      completeMaintenanceRecord(rec.id, todayIso, rec.cost ?? 120);
                    }}
                  />
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* ================================================================
         * 4. DISPATCHER / FLEET MANAGER / SUPER ADMIN VIEW
         * ============================================================== */}
        {activeRole === "dispatcher" ||
        activeRole === "fleet_manager" ||
        activeRole === "super_admin" ? (
          <>
            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.brandAmber, fontFamily: Fonts.mono }]}>
                  {pendingBookings.length}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  PENDING REQ
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.statusLive, fontFamily: Fonts.mono }]}>
                  {inTripCount}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  LIVE TRIPS
                </Text>
              </View>
              <View
                style={[
                  styles.kpiBox,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.kpiVal, { color: theme.primary, fontFamily: Fonts.mono }]}>
                  {standbyCount}/{availableDriverCount}
                </Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>
                  VEH / DRV
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              PENDING TRIP REQUESTS — ASSIGN DRIVER ({pendingBookings.length})
            </Text>

            {pendingBookings.length === 0 ? (
              <AnimatedCard index={0}>
                <Text style={[styles.subText, { color: theme.textSecondary }]}>
                  All incoming trip requests have been assigned or resolved.
                </Text>
              </AnimatedCard>
            ) : (
              pendingBookings.map((b, idx) => (
                <AnimatedCard key={b.id} index={idx} active>
                  <View style={styles.rowBetween}>
                    <Badge label="NEEDS DRIVER" tone="amber" />
                    <Text
                      style={[
                        styles.monoMeta,
                        { color: theme.textSecondary, fontFamily: Fonts.mono },
                      ]}
                    >
                      {b.requestedDate} · {b.estimatedKm} km
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {b.purpose}
                  </Text>
                  <Text style={[styles.subText, { color: theme.textSecondary }]}>
                    By {b.requesterName} · {b.pickupLocation ?? "Hub"} →{" "}
                    {b.dropoffLocation ?? b.purpose}
                  </Text>
                  <View style={styles.btnRow}>
                    <Button
                      label="Assign Driver"
                      size="sm"
                      variant="primary"
                      style={styles.flex}
                      onPress={() =>
                        router.push(`/modal/assign-booking?bookingId=${b.id}`)
                      }
                    />
                    <Button
                      label="Reject"
                      size="sm"
                      variant="danger"
                      onPress={() => {
                        triggerLightHaptic();
                        rejectBooking(b.id, "Declined from mobile dashboard");
                      }}
                    />
                  </View>
                </AnimatedCard>
              ))
            )}

            {activeRole !== "dispatcher" ? (
              <AnimatedCard index={3}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Fleet Risk &amp; Cost Signals
                </Text>
                <Text style={[styles.subText, { color: theme.textSecondary }]}>
                  • {expiringCompliance.length} compliance documents expiring or
                  expired{"\n"}• {fuelAnomalyCount} fuel efficiency / capacity
                  anomalies flagged{"\n"}• {openWorkOrders.length} active
                  workshop work orders
                </Text>
              </AnimatedCard>
            ) : null}

            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              QUICK COMMAND SHORTCUTS
            </Text>
            <View style={styles.btnRow}>
              <Button
                label="Live Map"
                size="sm"
                variant="primary"
                style={styles.flex}
                onPress={() => router.navigate("/(tabs)")}
              />
              <Button
                label="Bookings"
                size="sm"
                variant="secondary"
                style={styles.flex}
                onPress={() => router.navigate("/(tabs)/trips")}
              />
              <Button
                label="Service / Fuel"
                size="sm"
                variant="secondary"
                style={styles.flex}
                onPress={() => router.navigate("/(tabs)/logs")}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  heroTitle: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  subText: { fontSize: 12, lineHeight: 18 },
  assignedLine: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpiBox: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  kpiVal: { fontSize: 20, fontWeight: "900" },
  kpiLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  monoMeta: { fontSize: 10, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  flex: { flex: 1 },
  input: {
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
});
