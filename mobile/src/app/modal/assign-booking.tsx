import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  checkDriverAvailability,
  computeDriverSafetyScore,
} from "@/lib/drivers";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";

export default function AssignBookingModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();

  const bookings = useFleetStore((s) => s.bookings);
  const drivers = useFleetStore((s) => s.drivers);
  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const assignBooking = useFleetStore((s) => s.assignBooking);

  const booking = useMemo(
    () =>
      bookings.find((b) => b.id === params.bookingId) ??
      bookings.find((b) => b.status === "pending"),
    [bookings, params.bookingId]
  );

  const defaultDriverId = useMemo(() => {
    if (booking?.driverId) return booking.driverId;
    const free = booking
      ? drivers.find(
          (d) => checkDriverAvailability(d, booking.requestedDate, trips).available
        )
      : undefined;
    return free?.id ?? drivers[0]?.id ?? "";
  }, [booking, drivers, trips]);

  const defaultVehicleId = useMemo(() => {
    if (booking?.vehicleId) return booking.vehicleId;
    const free = vehicles.find((v) => (v.status ?? "available") === "available");
    return free?.id ?? vehicles[0]?.id ?? "";
  }, [booking, vehicles]);

  const [selectedDriverId, setSelectedDriverId] = useState(defaultDriverId);
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!booking) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.emptyWrap}>
          <Text style={[styles.title, { color: theme.text }]}>
            No Pending Booking Found
          </Text>
          <Button label="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const effectiveDriverId = selectedDriverId || defaultDriverId;
  const effectiveVehicleId = selectedVehicleId || defaultVehicleId;

  const handleSelectDriver = (drvId: string) => {
    triggerLightHaptic();
    setSelectedDriverId(drvId);
    setError(null);
    const drv = drivers.find((d) => d.id === drvId);
    if (drv?.assignedVehicleId) {
      const assignedVeh = vehicles.find(
        (v) =>
          v.id === drv.assignedVehicleId &&
          (v.status ?? "available") === "available"
      );
      if (assignedVeh) {
        setSelectedVehicleId(assignedVeh.id);
      }
    }
  };

  const handleAssign = () => {
    setError(null);
    const drv = drivers.find((d) => d.id === effectiveDriverId);
    const avail = drv
      ? checkDriverAvailability(drv, booking.requestedDate, trips)
      : { available: true };

    const res = assignBooking(booking.id, {
      driverId: effectiveDriverId,
      vehicleId: effectiveVehicleId,
      notes: notes.trim() || undefined,
      allowQueuedDriver: !avail.available,
    });

    if (!res.ok) {
      setError(res.error ?? "Unable to assign driver.");
      return;
    }

    triggerSuccessHaptic();
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>
            Assign Driver &amp; Vehicle
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Review trip request and dispatch to driver
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
        {/* Booking Summary */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <Badge label="PENDING REQUEST" tone="amber" />
            <Text
              style={[
                styles.mono,
                { color: theme.textSecondary, fontFamily: Fonts.mono },
              ]}
            >
              {booking.requestedDate} · {booking.estimatedKm} km
            </Text>
          </View>
          <Text style={[styles.bookingTitle, { color: theme.text }]}>
            {booking.purpose}
          </Text>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            Requester: {booking.requesterName} ({booking.department ?? "Ops"})
          </Text>
          <Text style={[styles.metaText, { color: theme.text }]}>
            Route: {booking.pickupLocation ?? "Central Hub"} →{" "}
            {booking.dropoffLocation ?? booking.purpose}
          </Text>
        </View>

        {/* 1. Choose Driver */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          1. SELECT DRIVER
        </Text>
        <View style={styles.optionList}>
          {drivers.map((drv) => {
            const avail = checkDriverAvailability(
              drv,
              booking.requestedDate,
              trips
            );
            const safety = computeDriverSafetyScore(drv.id, trips);
            const targetDay = booking.requestedDate.slice(0, 10);
            const onLeave = (drv.leaveLogs ?? []).some(
              (l) => targetDay >= l.fromDate && targetDay <= l.toDate
            );
            const selected = effectiveDriverId === drv.id;

            return (
              <Pressable
                key={drv.id}
                disabled={onLeave}
                onPress={() => handleSelectDriver(drv.id)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selected ? theme.cardElevated : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: onLeave ? 0.5 : 1,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {drv.name}
                  </Text>
                  <Badge
                    label={
                      onLeave
                        ? "ON LEAVE"
                        : avail.available
                          ? "AVAILABLE"
                          : "QUEUED"
                    }
                    tone={
                      onLeave ? "danger" : avail.available ? "success" : "amber"
                    }
                  />
                </View>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  Safety {safety.score}/100 · {drv.phone}
                </Text>
                {!avail.available ? (
                  <Text style={[styles.warnText, { color: theme.brandAmber }]}>
                    {avail.reason}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* 2. Choose Vehicle */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          2. SELECT VEHICLE
        </Text>
        <View style={styles.optionList}>
          {vehicles.map((veh) => {
            const st = veh.status ?? "available";
            const locked =
              st === "under_maintenance" ||
              st === "out_of_service" ||
              st === "decommissioned";
            const selected = effectiveVehicleId === veh.id;

            return (
              <Pressable
                key={veh.id}
                disabled={locked}
                onPress={() => {
                  triggerLightHaptic();
                  setSelectedVehicleId(veh.id);
                  setError(null);
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selected ? theme.cardElevated : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: locked ? 0.45 : 1,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>
                    {veh.name} ({veh.plate})
                  </Text>
                  <Badge
                    label={
                      st === "available"
                        ? "READY"
                        : st === "on_trip"
                          ? "IN TRIP"
                          : "LOCKED"
                    }
                    tone={
                      st === "available"
                        ? "success"
                        : st === "on_trip"
                          ? "amber"
                          : "danger"
                    }
                  />
                </View>
                <Text style={[styles.optionSub, { color: theme.textSecondary }]}>
                  Fuel {Math.round(veh.fuelLevelPercent ?? 75)}% ·{" "}
                  {Math.round(veh.odometerKm).toLocaleString()} km
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional dispatch notes for the driver..."
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

        {error ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        ) : null}

        <Button
          label="Confirm & Assign Driver"
          variant="primary"
          size="lg"
          fullWidth
          icon={
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={theme.primaryForeground}
            />
          }
          onPress={handleAssign}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: "800" },
  sub: { fontSize: 12 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 16, gap: 12, paddingBottom: 36 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mono: { fontSize: 10, fontWeight: "700" },
  bookingTitle: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  metaText: { fontSize: 12, lineHeight: 17 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  optionList: { gap: 8 },
  optionCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  optionTitle: { fontSize: 13, fontWeight: "800" },
  optionSub: { fontSize: 11 },
  warnText: { fontSize: 10, fontWeight: "600" },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  errorText: { fontSize: 12, fontWeight: "700" },
});
