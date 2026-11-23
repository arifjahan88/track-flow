import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TopStatusHeader } from "@/components/layout/top-status-header";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getRouteById } from "@/lib/city-routes";
import { checkDriverAvailability } from "@/lib/drivers";
import { formatDateTime, formatKm, offsetIsoDate } from "@/lib/format";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { can } from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";

type TripTabMode = "active" | "bookings" | "history";

export default function TripsScreen() {
  const theme = useTheme();
  const [subTab, setSubTab] = useState<TripTabMode>("active");

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const bookings = useFleetStore((s) => s.bookings);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const addBooking = useFleetStore((s) => s.addBooking);
  const updateBookingStatus = useFleetStore((s) => s.updateBookingStatus);
  const addActiveTripWaypoint = useFleetStore((s) => s.addActiveTripWaypoint);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);

  // New Booking form state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [requesterName, setRequesterName] = useState(
    currentUser?.name ?? "Marcus Vance"
  );
  const [bookingPurpose, setBookingPurpose] = useState("");
  const [estimatedKm, setEstimatedKm] = useState("24");

  // Add Stop Waypoint state
  const [newStopLabel, setNewStopLabel] = useState("");
  const [newStopAddress, setNewStopAddress] = useState("");

  // Historical Playback scrubber state
  const [playbackProgress, setPlaybackProgress] = useState<
    Record<string, number>
  >({});

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const activeTrips = useMemo(
    () => trips.filter((t) => t.status !== "done"),
    [trips]
  );
  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "done"),
    [trips]
  );

  const focusedTrip =
    activeTrips.find((t) => t.vehicleId === selectedVehicleId) ??
    activeTrips[0];

  const canApproveDispatch = can(activeRole, "dispatch:approve");

  const handleCreateBooking = () => {
    if (!bookingPurpose.trim()) return;
    addBooking({
      requesterName: requesterName.trim() || "Operations Team",
      department: "Mobile Dispatch",
      purpose: bookingPurpose.trim(),
      requestedDate: offsetIsoDate(1),
      estimatedKm: Math.max(4, Number(estimatedKm) || 20),
      vehicleId: selectedVehicleId,
      driverId: drivers[0]?.id,
    });
    triggerSuccessHaptic();
    setBookingPurpose("");
    setShowBookingForm(false);
  };

  const handleAddStop = () => {
    if (!newStopLabel.trim()) return;
    addActiveTripWaypoint({
      label: newStopLabel.trim(),
      address: newStopAddress.trim() || "Dhaka Logistics Corridor",
      lat: 23.775,
      lng: 90.414,
    });
    triggerSuccessHaptic();
    setNewStopLabel("");
    setNewStopAddress("");
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <TopStatusHeader
        title="Trips, Waypoints & Dispatch"
        subtitle={`${activeTrips.length} live corridors · ${bookings.length} dispatch bookings`}
      />

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            {
              value: "active",
              label: "Active Manifest",
              count: activeTrips.length,
            },
            {
              value: "bookings",
              label: "Bookings",
              count: bookings.length,
            },
            {
              value: "history",
              label: "History",
              count: completedTrips.length,
            },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TAB 1: ACTIVE TRIP MANIFEST, WAYPOINTS & POD */}
        {subTab === "active" ? (
          <>
            {focusedTrip ? (
              <AnimatedCard index={0} active>
                <View style={styles.cardHeader}>
                  <View style={styles.flex}>
                    <View style={styles.badgeRow}>
                      <Badge
                        label={
                          focusedTrip.status === "paused"
                            ? "PAUSED"
                            : "LIVE TRIP"
                        }
                        tone={
                          focusedTrip.status === "paused" ? "amber" : "emerald"
                        }
                      />
                      <Badge
                        label={
                          vehiclesById.get(focusedTrip.vehicleId)?.plate ??
                          "FP-8421"
                        }
                        tone="cyan"
                        mono
                      />
                    </View>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      {focusedTrip.purpose}
                    </Text>
                    <Text
                      style={[styles.cardSub, { color: theme.textSecondary }]}
                    >
                      {vehiclesById.get(focusedTrip.vehicleId)?.name} · Driver:{" "}
                      {driversById.get(focusedTrip.driverId ?? "")?.name ??
                        "Marcus Vance"}
                    </Text>
                  </View>
                </View>

                {/* Telemetry Readout */}
                <View style={styles.telemetryGrid}>
                  <View
                    style={[
                      styles.telemetryBox,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.teleLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      DISTANCE
                    </Text>
                    <Text
                      style={[
                        styles.teleVal,
                        { color: theme.text, fontFamily: Fonts?.mono },
                      ]}
                    >
                      {formatKm(focusedTrip.distanceKm)} km
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.telemetryBox,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.teleLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      MAX SPEED
                    </Text>
                    <Text
                      style={[
                        styles.teleVal,
                        {
                          color: theme.primary,
                          fontFamily: Fonts?.mono,
                        },
                      ]}
                    >
                      {Math.round(focusedTrip.maxSpeedKmh)} km/h
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.telemetryBox,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.teleLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      SAFETY
                    </Text>
                    <Text
                      style={[
                        styles.teleVal,
                        {
                          color: theme.statusLive,
                          fontFamily: Fonts?.mono,
                        },
                      ]}
                    >
                      {focusedTrip.safetyMetrics?.harshBrakingCount ?? 0} harsh
                    </Text>
                  </View>
                </View>

                {/* Pre-Trip Walkaround Badge */}
                <View
                  style={[
                    styles.checklistBanner,
                    {
                      backgroundColor: theme.muted,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      focusedTrip.preTripChecklist
                        ? "checkmark-done-circle"
                        : "clipboard-outline"
                    }
                    size={18}
                    color={
                      focusedTrip.preTripChecklist
                        ? theme.statusLive
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.checklistText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {focusedTrip.preTripChecklist
                      ? "Pre-Trip Walkaround Inspection Verified (All 5 Checks OK)"
                      : "Pre-Trip Walkaround Pending"}
                  </Text>
                </View>

                {/* Waypoints & Proof of Delivery (POD) Stops */}
                <Text
                  style={[styles.sectionHeading, { color: theme.textSecondary }]}
                >
                  DELIVERY WAYPOINTS & PROOF OF DELIVERY (POD)
                </Text>

                <View style={styles.waypointList}>
                  {(focusedTrip.waypoints ?? []).map((wp, idx) => {
                    const completed = Boolean(wp.arrivedAt);
                    return (
                      <View
                        key={wp.id}
                        style={[
                          styles.waypointItem,
                          {
                            backgroundColor: theme.muted,
                            borderColor: completed
                              ? theme.statusLive
                              : theme.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.stopCircle,
                            {
                              backgroundColor: completed
                                ? theme.statusLive
                                : theme.textSecondary,
                            },
                          ]}
                        >
                          {completed ? (
                            <Ionicons
                              name="checkmark"
                              size={13}
                              color="#FFFFFF"
                            />
                          ) : (
                            <Text style={styles.stopNum}>{idx + 1}</Text>
                          )}
                        </View>

                        <View style={styles.flex}>
                          <Text
                            style={[styles.stopLabel, { color: theme.text }]}
                          >
                            {wp.label}
                          </Text>
                          <Text
                            style={[
                              styles.stopAddress,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {wp.address}
                          </Text>
                          {completed ? (
                            <Text
                              style={[
                                styles.podStatus,
                                { color: theme.statusLive },
                              ]}
                            >
                              POD Signed by {wp.recipientName ?? "Client"} ·{" "}
                              {formatDateTime(wp.arrivedAt!)}
                            </Text>
                          ) : null}
                        </View>

                        {!completed ? (
                          <Button
                            label="POD Sign"
                            size="sm"
                            variant="primary"
                            onPress={() =>
                              router.push(
                                `/modal/pod?waypointId=${wp.id}&tripId=${focusedTrip.id}`
                              )
                            }
                          />
                        ) : (
                          <Badge label="DELIVERED" tone="success" />
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Add Quick Delivery Stop */}
                <View style={styles.addStopRow}>
                  <TextInput
                    value={newStopLabel}
                    onChangeText={setNewStopLabel}
                    placeholder="Add stop (e.g. Banani Warehouse #4)"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.stopInput,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                  />
                  <Button
                    label="+ Stop"
                    size="sm"
                    variant="secondary"
                    onPress={handleAddStop}
                  />
                </View>

                {/* Action Footer */}
                <View style={styles.actionFooter}>
                  <Button
                    label="Open on Live Map"
                    variant="secondary"
                    size="md"
                    style={styles.flex}
                    icon={
                      <Ionicons
                        name="map-outline"
                        size={16}
                        color={theme.text}
                      />
                    }
                    onPress={() => {
                      setSelectedVehicle(focusedTrip.vehicleId);
                      router.navigate("/(tabs)");
                    }}
                  />
                  <Button
                    label="End Trip (Post-Check)"
                    variant="danger"
                    size="md"
                    style={styles.flex}
                    icon={
                      <Ionicons
                        name="stop-circle-outline"
                        size={16}
                        color="#FFFFFF"
                      />
                    }
                    onPress={() =>
                      router.push(
                        `/modal/checklist?phase=post&vehicleId=${focusedTrip.vehicleId}`
                      )
                    }
                  />
                </View>
              </AnimatedCard>
            ) : null}

            {/* Other Active Fleet Corridors */}
            <Text
              style={[styles.sectionHeading, { color: theme.textSecondary }]}
            >
              ALL ACTIVE FLEET CORRIDORS ({activeTrips.length})
            </Text>
            {activeTrips.map((t, i) => {
              const v = vehiclesById.get(t.vehicleId);
              const route = getRouteById(t.routeId);
              return (
                <AnimatedCard
                  key={t.id}
                  index={i + 1}
                  onPress={() => {
                    setSelectedVehicle(t.vehicleId);
                    router.navigate("/(tabs)");
                  }}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.flex}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        {v?.name} ({v?.plate})
                      </Text>
                      <Text
                        style={[
                          styles.itemSub,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t.purpose}
                      </Text>
                    </View>
                    <Badge label={route.code} tone="cyan" mono />
                  </View>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* TAB 2: TRIP BOOKINGS & APPROVAL WORKFLOW */}
        {subTab === "bookings" ? (
          <>
            <View style={styles.rowBetween}>
              <Text
                style={[styles.sectionHeading, { color: theme.textSecondary }]}
              >
                DISPATCH BOOKINGS & REQUESTS
              </Text>
              <Button
                label={showBookingForm ? "Cancel" : "+ Request Trip"}
                size="sm"
                variant="primary"
                onPress={() => setShowBookingForm((p) => !p)}
              />
            </View>

            {showBookingForm ? (
              <AnimatedCard index={0} elevated>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  New Trip Dispatch Request
                </Text>
                <TextInput
                  value={requesterName}
                  onChangeText={setRequesterName}
                  placeholder="Requester name"
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
                  value={bookingPurpose}
                  onChangeText={setBookingPurpose}
                  placeholder="Trip purpose & destination manifest"
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
                  value={estimatedKm}
                  onChangeText={setEstimatedKm}
                  keyboardType="numeric"
                  placeholder="Estimated distance (km)"
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
                  label="Submit Dispatch Booking"
                  variant="emerald"
                  fullWidth
                  onPress={handleCreateBooking}
                />
              </AnimatedCard>
            ) : null}

            {bookings.map((b, idx) => {
              const v = vehiclesById.get(b.vehicleId ?? "");
              const d = driversById.get(b.driverId ?? "");
              const avail = d
                ? checkDriverAvailability(d, b.requestedDate, trips)
                : { available: true };

              const tone =
                b.status === "approved"
                  ? "emerald"
                  : b.status === "dispatched"
                    ? "cyan"
                    : b.status === "rejected"
                      ? "danger"
                      : "amber";

              return (
                <AnimatedCard key={b.id} index={idx + 1}>
                  <View style={styles.rowBetween}>
                    <Badge label={b.status.toUpperCase()} tone={tone} />
                    <Text
                      style={[
                        styles.monoMeta,
                        {
                          color: theme.textSecondary,
                          fontFamily: Fonts?.mono,
                        },
                      ]}
                    >
                      {b.requestedDate} · {b.estimatedKm} km
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {b.purpose}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Requested by {b.requesterName} ({b.department ?? "Ops"}) ·
                    Unit: {v?.name ?? "Pulse Courier 12"} · Driver:{" "}
                    {d?.name ?? "Priya Nair"}
                  </Text>

                  {!avail.available ? (
                    <Text
                      style={[
                        styles.conflictText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Shift Note: {avail.reason}
                    </Text>
                  ) : null}

                  <View style={styles.actionFooter}>
                    {b.status === "pending" && canApproveDispatch ? (
                      <>
                        <Button
                          label="Approve"
                          size="sm"
                          variant="emerald"
                          style={styles.flex}
                          onPress={() =>
                            updateBookingStatus(b.id, "approved", {
                              approvedBy: currentUser?.name ?? "Dispatcher",
                            })
                          }
                        />
                        <Button
                          label="Reject"
                          size="sm"
                          variant="danger"
                          style={styles.flex}
                          onPress={() => updateBookingStatus(b.id, "rejected")}
                        />
                      </>
                    ) : null}

                    {b.status === "approved" ? (
                      <Button
                        label="Launch Pre-Trip Inspection & Dispatch"
                        size="sm"
                        variant="primary"
                        fullWidth
                        onPress={() =>
                          router.push(
                            `/modal/checklist?phase=pre&vehicleId=${b.vehicleId ?? "veh-4"}&purpose=${encodeURIComponent(b.purpose)}`
                          )
                        }
                      />
                    ) : null}
                  </View>
                </AnimatedCard>
              );
            })}
          </>
        ) : null}

        {/* TAB 3: COMPLETED TRIP HISTORY & INTERACTIVE ROUTE SCRUBBER */}
        {subTab === "history" ? (
          <>
            {completedTrips.map((t, idx) => {
              const v = vehiclesById.get(t.vehicleId);
              const d = driversById.get(t.driverId ?? "");
              const scrub = playbackProgress[t.id] ?? 100;
              const pointIdx = Math.min(
                t.points.length - 1,
                Math.max(0, Math.floor((scrub / 100) * t.points.length))
              );
              const pt = t.points[pointIdx];

              return (
                <AnimatedCard key={t.id} index={idx}>
                  <View style={styles.rowBetween}>
                    <Badge
                      label={v?.plate ?? "FLEET"}
                      tone="primary"
                      mono
                    />
                    <Text
                      style={[
                        styles.monoMeta,
                        {
                          color: theme.textSecondary,
                          fontFamily: Fonts?.mono,
                        },
                      ]}
                    >
                      {formatDateTime(t.startedAt)}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      { color: theme.text, marginTop: 6 },
                    ]}
                  >
                    {t.purpose}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    {v?.name} · Driver: {d?.name ?? "Marcus Vance"} ·{" "}
                    {formatKm(t.distanceKm)} km · Top{" "}
                    {Math.round(t.maxSpeedKmh)} km/h
                  </Text>

                  {/* Interactive Telemetry Route Replay Scrubber */}
                  <View
                    style={[
                      styles.replayBox,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text
                        style={[
                          styles.teleLabel,
                          { color: theme.primary },
                        ]}
                      >
                        ROUTE PLAYBACK ({scrub}%)
                      </Text>
                      {pt ? (
                        <Text
                          style={[
                            styles.monoMeta,
                            {
                              color: theme.textSecondary,
                              fontFamily: Fonts?.mono,
                            },
                          ]}
                        >
                          {pt.lat.toFixed(4)}°N, {pt.lng.toFixed(4)}°E
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.scrubButtons}>
                      {[0, 25, 50, 75, 100].map((pctVal) => (
                        <Pressable
                          key={pctVal}
                          onPress={() =>
                            setPlaybackProgress((prev) => ({
                              ...prev,
                              [t.id]: pctVal,
                            }))
                          }
                          style={[
                            styles.scrubStep,
                            {
                              backgroundColor:
                                scrub === pctVal
                                  ? theme.primary
                                  : theme.cardElevated,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.scrubStepText,
                              {
                                color:
                                  scrub === pctVal
                                    ? theme.primaryForeground
                                    : theme.text,
                                fontFamily: Fonts?.mono,
                              },
                            ]}
                          >
                            {pctVal}%
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  telemetryBox: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 9,
    gap: 2,
  },
  teleLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  teleVal: {
    fontSize: 13,
    fontWeight: "800",
  },
  checklistBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: 10,
  },
  checklistText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 4,
  },
  waypointList: {
    gap: 8,
  },
  waypointItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  stopCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stopNum: {
    fontSize: 11,
    fontWeight: "900",
    color: "#03121A",
  },
  stopLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  stopAddress: {
    fontSize: 11,
  },
  podStatus: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  addStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  stopInput: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  actionFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginTop: 8,
  },
  monoMeta: {
    fontSize: 11,
  },
  conflictText: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  replayBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8,
  },
  scrubButtons: {
    flexDirection: "row",
    gap: 6,
  },
  scrubStep: {
    flex: 1,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  scrubStepText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
