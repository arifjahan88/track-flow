import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ObdStrip } from "@/components/ui/obd-strip";
import { PulseDot } from "@/components/ui/pulse-dot";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getRouteById } from "@/lib/city-routes";
import { headingToCardinal } from "@/lib/geo-sim";
import { triggerLightHaptic } from "@/lib/haptics";
import type {
  Driver,
  LiveVehicleFrame,
  Trip,
  UserRole,
  Vehicle,
  VehicleLifecycleStatus,
} from "@/types";

interface DriverCockpitSheetProps {
  role: UserRole;
  vehicles: Vehicle[];
  drivers: Driver[];
  selectedVehicle: Vehicle | undefined;
  activeTrip: Trip | undefined;
  frame: LiveVehicleFrame | undefined;
  frames: Record<string, LiveVehicleFrame>;
  speedKmh?: number;
  headingDeg?: number;
  speedLimitKmh?: number;
  onSelectVehicle: (vehicleId: string) => void;
  onPauseOrResumeTrip: () => void;
}

const STATUS_META: Record<
  VehicleLifecycleStatus,
  { label: string; tone: BadgeTone }
> = {
  on_trip: { label: "IN TRIP", tone: "primary" },
  available: { label: "STANDBY", tone: "success" },
  under_maintenance: { label: "MAINTENANCE", tone: "neutral" },
  out_of_service: { label: "OUT OF SERVICE", tone: "danger" },
  decommissioned: { label: "DECOMMISSIONED", tone: "neutral" },
};

export function DriverCockpitSheet({
  role,
  vehicles,
  drivers,
  selectedVehicle,
  activeTrip,
  frame,
  frames,
  speedKmh = 0,
  headingDeg = 0,
  speedLimitKmh = 60,
  onSelectVehicle,
  onPauseOrResumeTrip,
}: DriverCockpitSheetProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const dragOffset = useSharedValue(0);

  const toggleExpanded = (nextState?: boolean) => {
    triggerLightHaptic();
    setExpanded((prev) => (typeof nextState === "boolean" ? nextState : !prev));
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragOffset.value = Math.max(-45, Math.min(45, e.translationY * 0.35));
    })
    .onEnd((e) => {
      // Smooth timing, no bounce overshoot
      dragOffset.value = withTiming(0, { duration: 150 });
      if (e.translationY < -28) {
        runOnJS(toggleExpanded)(true);
      } else if (e.translationY > 28) {
        runOnJS(toggleExpanded)(false);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragOffset.value }],
  }));

  if (!selectedVehicle) return null;

  const route = getRouteById(selectedVehicle.routeId);
  const driverName =
    drivers.find((d) => d.assignedVehicleId === selectedVehicle.id)?.name ??
    "Unassigned";
  const status: VehicleLifecycleStatus = selectedVehicle.status ?? "available";
  const isMoving = status === "on_trip";
  const isLocked =
    status === "under_maintenance" ||
    status === "out_of_service" ||
    status === "decommissioned";
  const fuelPct = Math.round(selectedVehicle.fuelLevelPercent ?? 78);
  const progressPct = Math.round(
    ((frame?.routeProgress ?? selectedVehicle.routeProgress ?? 0) % 1) * 100
  );
  const pendingWaypoint = activeTrip?.waypoints?.find((w) => !w.arrivedAt);

  const roundedSpeed = Math.round(speedKmh);
  const isSpeeding = roundedSpeed > speedLimitKmh + 5;
  const remainingMinutes = Math.max(
    1,
    Math.round(route.estimatedMinutes * (1 - progressPct / 100))
  );
  const remainingKm = Math.max(
    0.1,
    route.distanceKm * (1 - progressPct / 100)
  ).toFixed(1);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        layout={LinearTransition.duration(150)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: theme.shadowColor,
          },
          animatedSheetStyle,
        ]}
      >
        {/* Drag Handle + Section Hint */}
        <Pressable
          onPress={() => toggleExpanded()}
          style={styles.handleHitbox}
        >
          <View
            style={[styles.dragHandle, { backgroundColor: theme.border }]}
          />
          <View style={styles.handleHintRow}>
            <View style={styles.liveIndicatorRow}>
              <PulseDot
                size={6}
                active={isMoving}
                color={isMoving ? theme.primary : theme.statusLive}
              />
              <Text style={[styles.cockpitTag, { color: theme.textSecondary }]}>
                {role === "driver"
                  ? "DRIVER COCKPIT"
                  : "LIVE FLEET TELEMETRY"}
              </Text>
            </View>
            <View style={styles.expandChip}>
              <Text
                style={[styles.expandChipText, { color: theme.textSecondary }]}
              >
                {expanded ? "Less" : "Telemetry & Tools"}
              </Text>
              <Ionicons
                name={expanded ? "chevron-down" : "chevron-up"}
                size={14}
                color={theme.textSecondary}
              />
            </View>
          </View>
        </Pressable>

        {/* Integrated Human-Designed Telemetry Strip */}
        <View
          style={[
            styles.telemetryBar,
            {
              backgroundColor: theme.muted,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Left: Prominent Speed Readout */}
          <View style={styles.speedBlock}>
            <Text
              style={[
                styles.speedNumber,
                {
                  color: isSpeeding ? theme.danger : theme.text,
                  fontFamily: Fonts?.mono,
                },
              ]}
            >
              {roundedSpeed}
            </Text>
            <View style={styles.speedSubCol}>
              <Text style={[styles.speedUnit, { color: theme.textSecondary }]}>
                KM/H
              </Text>
              <Text
                style={[
                  styles.headingText,
                  { color: theme.textSecondary, fontFamily: Fonts?.mono },
                ]}
              >
                {Math.round(headingDeg)}° {headingToCardinal(headingDeg)}
              </Text>
            </View>
          </View>

          {/* Center: Clean Speed Limit Badge */}
          <View
            style={[
              styles.speedLimitBadge,
              {
                borderColor: isSpeeding ? theme.danger : theme.border,
                backgroundColor: isSpeeding
                  ? theme.isDark
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(220, 38, 38, 0.12)"
                  : theme.cardElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.speedLimitLabel,
                { color: isSpeeding ? theme.danger : theme.textSecondary },
              ]}
            >
              LIMIT
            </Text>
            <Text
              style={[
                styles.speedLimitNum,
                {
                  color: isSpeeding ? theme.danger : theme.text,
                  fontFamily: Fonts?.mono,
                },
              ]}
            >
              {speedLimitKmh}
            </Text>
          </View>

          {/* Right: Trip ETA or Standby Status */}
          <View style={styles.etaBlock}>
            <Text style={[styles.etaLabel, { color: theme.textSecondary }]}>
              {isMoving ? "REMAINING" : "STATUS"}
            </Text>
            <Text
              style={[
                styles.etaValue,
                { color: theme.text, fontFamily: Fonts?.mono },
              ]}
            >
              {isMoving ? `${remainingMinutes}m · ${remainingKm}km` : "Standby"}
            </Text>
          </View>
        </View>

        {/* Primary Vehicle Title & Route Information */}
        <View style={styles.headerRow}>
          <View style={styles.vehicleMain}>
            <View style={styles.titleLine}>
              <Text
                numberOfLines={1}
                style={[styles.vehicleName, { color: theme.text }]}
              >
                {selectedVehicle.name}
              </Text>
              <Badge
                label={STATUS_META[status].label}
                tone={STATUS_META[status].tone}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.metaLine,
                { color: theme.textSecondary, fontFamily: Fonts?.mono },
              ]}
            >
              {selectedVehicle.plate} · {driverName} ·{" "}
              {Math.round(selectedVehicle.odometerKm).toLocaleString()} km
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(`/modal/vehicle-details?vehicleId=${selectedVehicle.id}`)
            }
            style={[
              styles.inspectBtn,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>

        {/* Route Progress Bar (Single Brand Accent) */}
        <View
          style={[
            styles.progressBox,
            {
              backgroundColor: theme.muted,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.progressTop}>
            <View style={styles.routeTitleWrap}>
              <Text
                numberOfLines={1}
                style={[styles.routeName, { color: theme.text }]}
              >
                {route.code} · {route.name}
              </Text>
            </View>
            <Text
              style={[
                styles.progressValue,
                { color: theme.textSecondary, fontFamily: Fonts?.mono },
              ]}
            >
              {progressPct}% · Fuel {fuelPct}%
            </Text>
          </View>
          <View
            style={[
              styles.trackBar,
              { backgroundColor: theme.cardElevated },
            ]}
          >
            <View
              style={[
                styles.fillBar,
                {
                  width: `${Math.max(4, progressPct)}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
        </View>

        {/* Primary Trip Action Buttons */}
        <View style={styles.ctaRow}>
          {isMoving ? (
            <>
              <Button
                label={activeTrip?.status === "paused" ? "Resume" : "Pause"}
                variant="secondary"
                size="md"
                icon={
                  <Ionicons
                    name={activeTrip?.status === "paused" ? "play" : "pause"}
                    size={16}
                    color={theme.text}
                  />
                }
                onPress={onPauseOrResumeTrip}
                style={styles.flexBtn}
              />

              {pendingWaypoint ? (
                <Button
                  label="POD Stop"
                  variant="primary"
                  size="md"
                  icon={
                    <Ionicons
                      name="create-outline"
                      size={16}
                      color={theme.primaryForeground}
                    />
                  }
                  onPress={() =>
                    router.push(
                      `/modal/pod?waypointId=${pendingWaypoint.id}&tripId=${activeTrip?.id ?? ""}`
                    )
                  }
                  style={styles.flexBtn}
                />
              ) : null}

              <Button
                label="End Trip"
                variant="danger"
                size="md"
                icon={<Ionicons name="stop-circle" size={16} color="#FFFFFF" />}
                onPress={() =>
                  router.push(
                    `/modal/checklist?phase=post&vehicleId=${selectedVehicle.id}`
                  )
                }
                style={styles.flexBtn}
              />
            </>
          ) : isLocked ? (
            <Button
              label="In Service Bay (Maintenance Hold)"
              variant="outline"
              disabled
              fullWidth
              icon={
                <Ionicons
                  name="construct-outline"
                  size={16}
                  color={theme.textSecondary}
                />
              }
              onPress={() => {}}
            />
          ) : (
            <Button
              label={`Start Trip · ${route.code} (Pre-Check)`}
              variant="primary"
              size="lg"
              fullWidth
              icon={<Ionicons name="navigate" size={18} color="#FFFFFF" />}
              onPress={() =>
                router.push(
                  `/modal/checklist?phase=pre&vehicleId=${selectedVehicle.id}`
                )
              }
            />
          )}
        </View>

        {/* Expanded Secondary Telemetry, Quick Actions & Unit Switcher */}
        {expanded ? (
          <View style={styles.expandedContent}>
            <ObdStrip
              ignitionOn={isMoving}
              fuelLevelPercent={selectedVehicle.fuelLevelPercent}
              distanceKm={activeTrip?.distanceKm ?? 0}
            />

            {/* Quick Driver Actions */}
            <View style={styles.quickActionsRow}>
              <Pressable
                onPress={() =>
                  router.push(
                    `/modal/quick-fuel?vehicleId=${selectedVehicle.id}`
                  )
                }
                style={[
                  styles.quickActionTile,
                  {
                    backgroundColor: theme.muted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="water-outline"
                  size={16}
                  color={theme.text}
                />
                <Text style={[styles.quickActionText, { color: theme.text }]}>
                  Log Fuel
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push(
                    `/modal/quick-expense?vehicleId=${selectedVehicle.id}`
                  )
                }
                style={[
                  styles.quickActionTile,
                  {
                    backgroundColor: theme.muted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={16}
                  color={theme.text}
                />
                <Text style={[styles.quickActionText, { color: theme.text }]}>
                  Expense
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push(
                    `/modal/report-incident?vehicleId=${selectedVehicle.id}`
                  )
                }
                style={[
                  styles.quickActionTile,
                  {
                    backgroundColor: theme.muted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="warning-outline"
                  size={16}
                  color={theme.danger}
                />
                <Text style={[styles.quickActionText, { color: theme.danger }]}>
                  SOS Incident
                </Text>
              </Pressable>
            </View>

            {/* Horizontal Fleet Units Switcher */}
            <View style={styles.rosterBlock}>
              <Text
                style={[styles.rosterTitle, { color: theme.textSecondary }]}
              >
                FLEET VEHICLES ({vehicles.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rosterScroll}
              >
                {vehicles.map((v) => {
                  const active = v.id === selectedVehicle.id;
                  const vf = frames[v.id];
                  const vSpd = Math.round(vf?.speedKmh ?? 0);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => {
                        triggerLightHaptic();
                        onSelectVehicle(v.id);
                      }}
                      style={[
                        styles.rosterChip,
                        {
                          backgroundColor: active
                            ? theme.cardElevated
                            : theme.muted,
                          borderColor: active
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <PulseDot
                        size={6}
                        active={v.status === "on_trip"}
                        color={
                          v.status === "on_trip"
                            ? theme.primary
                            : theme.statusLive
                        }
                      />
                      <View>
                        <Text
                          numberOfLines={1}
                          style={[styles.chipName, { color: theme.text }]}
                        >
                          {v.name}
                        </Text>
                        <Text
                          style={[
                            styles.chipSub,
                            {
                              color: theme.textSecondary,
                              fontFamily: Fonts?.mono,
                            },
                          ]}
                        >
                          {v.plate} · {vSpd} km/h
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  handleHitbox: {
    alignItems: "center",
    gap: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  handleHintRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cockpitTag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  expandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  expandChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  telemetryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  speedBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  speedNumber: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 28,
  },
  speedSubCol: {
    gap: 1,
  },
  speedUnit: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headingText: {
    fontSize: 10,
    fontWeight: "600",
  },
  speedLimitBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  speedLimitLabel: {
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  speedLimitNum: {
    fontSize: 13,
    fontWeight: "800",
  },
  etaBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  etaLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  etaValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  vehicleMain: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: "700",
  },
  metaLine: {
    fontSize: 11,
    fontWeight: "500",
  },
  inspectBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  routeTitleWrap: {
    flex: 1,
  },
  routeName: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  trackBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fillBar: {
    height: "100%",
    borderRadius: 2,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 8,
  },
  flexBtn: {
    flex: 1,
  },
  expandedContent: {
    gap: 10,
    paddingTop: 2,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionTile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rosterBlock: {
    gap: 6,
  },
  rosterTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  rosterScroll: {
    gap: 8,
  },
  rosterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  chipName: {
    fontSize: 12,
    fontWeight: "600",
  },
  chipSub: {
    fontSize: 10,
  },
});
