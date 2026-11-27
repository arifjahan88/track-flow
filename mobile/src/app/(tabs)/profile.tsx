import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
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
import { ThemePreferenceSelector } from "@/components/ui/theme-toggle";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  DAY_OF_WEEK_LABELS,
  computeDriverSafetyScore,
  computeDriverStats,
} from "@/lib/drivers";
import { formatDateTime, offsetIsoDate } from "@/lib/format";
import { triggerMediumHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
} from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";

export default function ProfileScreen() {
  const theme = useTheme();

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const logout = useAuthStore((s) => s.logout);

  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const auditLogs = useFleetStore((s) => s.auditLogs);
  const cityRegion = useFleetStore((s) => s.cityRegion);
  const setCityRegion = useFleetStore((s) => s.setCityRegion);
  const addDriverLeave = useFleetStore((s) => s.addDriverLeave);
  const resetDemoData = useFleetStore((s) => s.resetDemoData);

  const [leaveReason, setLeaveReason] = useState("");
  const [resetConfirmed, setResetConfirmed] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";

  const activeDriver = useMemo(
    () =>
      drivers.find((d) => d.name === currentUser?.name) ?? drivers[0],
    [drivers, currentUser?.name]
  );

  const safety = useMemo(
    () =>
      activeDriver
        ? computeDriverSafetyScore(activeDriver.id, trips)
        : {
            score: 100,
            harshBraking: 0,
            speedingIncidents: 0,
            idleMinutes: 0,
            onTimeRatePct: 100,
            grade: "Excellent" as const,
          },
    [activeDriver, trips]
  );

  const driverStats = useMemo(
    () =>
      activeDriver
        ? computeDriverStats(activeDriver.id, trips)
        : { completedTrips: 0, totalDistanceKm: 0, topSpeedKmh: 0 },
    [activeDriver, trips]
  );

  const handleRequestLeave = () => {
    if (!activeDriver || !leaveReason.trim()) return;
    addDriverLeave(activeDriver.id, {
      fromDate: offsetIsoDate(3),
      toDate: offsetIsoDate(5),
      reason: leaveReason.trim(),
    });
    triggerSuccessHaptic();
    setLeaveReason("");
  };

  const handleResetDemo = () => {
    triggerMediumHaptic();
    resetDemoData();
    setResetConfirmed(true);
    setTimeout(() => setResetConfirmed(false), 2500);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <TopStatusHeader
        title="Driver Profile, Theme & RBAC"
        subtitle={`Signed in as ${currentUser?.name ?? "Marcus Vance"} (${ROLE_LABELS[activeRole]})`}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. APPEARANCE: LIGHT & DARK THEME ENGINE */}
        <AnimatedCard index={0}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Appearance (Light & Dark Theme)
            </Text>
            <Badge
              label={theme.isDark ? "NIGHT COCKPIT" : "DAYLIGHT MODE"}
              tone={theme.isDark ? "cyan" : "amber"}
            />
          </View>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Switch between Deep Slate Night Cockpit and High-Contrast Daylight
            Driving Mode. Real street map tiles adapt automatically.
          </Text>
          <View style={{ marginTop: 10 }}>
            <ThemePreferenceSelector />
          </View>

          {/* City Region Switcher */}
          <View style={styles.regionRow}>
            <Text style={[styles.regionLabel, { color: theme.textSecondary }]}>
              Default Real Map Corridor Region:
            </Text>
            <View style={styles.regionBtns}>
              {(["dhaka", "sf_bay"] as const).map((reg) => {
                const active = cityRegion === reg;
                return (
                  <Pressable
                    key={reg}
                    onPress={() => setCityRegion(reg)}
                    style={[
                      styles.regionChip,
                      {
                        backgroundColor: active ? theme.primary : theme.muted,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.regionChipText,
                        {
                          color: active
                            ? theme.primaryForeground
                            : theme.text,
                        },
                      ]}
                    >
                      {reg === "dhaka" ? "Dhaka Metro" : "SF Bay Area"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </AnimatedCard>

        {/* 2. DRIVER SAFETY SCORECARD & SHIFTS */}
        <AnimatedCard index={1}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Driver Safety & Telemetry Score
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {activeDriver?.name} · {activeDriver?.licenseClass} (
                {activeDriver?.licenseNumber})
              </Text>
            </View>
            <View
              style={[
                styles.scoreCircle,
                {
                  borderColor: theme.statusLive,
                  backgroundColor: theme.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.scoreNum,
                  { color: theme.statusLive, fontFamily: Fonts?.mono },
                ]}
              >
                {safety.score}
              </Text>
              <Text style={[styles.scoreGrade, { color: theme.textSecondary }]}>
                {safety.grade}
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statTile,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                ON-TIME
              </Text>
              <Text
                style={[
                  styles.statVal,
                  { color: theme.statusLive, fontFamily: Fonts?.mono },
                ]}
              >
                {safety.onTimeRatePct}%
              </Text>
            </View>
            <View
              style={[
                styles.statTile,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                COMPLETED
              </Text>
              <Text
                style={[
                  styles.statVal,
                  { color: theme.text, fontFamily: Fonts?.mono },
                ]}
              >
                {driverStats.completedTrips} trips
              </Text>
            </View>
            <View
              style={[
                styles.statTile,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                HARSH / SPD
              </Text>
              <Text
                style={[
                  styles.statVal,
                  { color: theme.text, fontFamily: Fonts?.mono },
                ]}
              >
                {safety.harshBraking} / {safety.speedingIncidents}
              </Text>
            </View>
          </View>

          {/* Weekly Shift Schedule */}
          <Text
            style={[
              styles.subHeading,
              { color: theme.textSecondary, marginTop: 12 },
            ]}
          >
            WEEKLY SHIFT SCHEDULE
          </Text>
          <View style={styles.shiftWrap}>
            {(activeDriver?.shifts ?? []).map((sh) => (
              <Badge
                key={sh.id}
                label={`${DAY_OF_WEEK_LABELS[sh.dayOfWeek]} ${sh.startTime}–${sh.endTime}`}
                tone="cyan"
                mono
              />
            ))}
          </View>

          {/* Quick Leave Request */}
          <View style={styles.leaveRow}>
            <TextInput
              value={leaveReason}
              onChangeText={setLeaveReason}
              placeholder="Request leave (e.g. Medical checkup)"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.leaveInput,
                {
                  backgroundColor: theme.muted,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Button
              label="Log Leave"
              size="sm"
              variant="secondary"
              onPress={handleRequestLeave}
            />
          </View>
        </AnimatedCard>

        {/* 3. 1-TAP ROLE SWITCHER & RBAC CAPABILITIES */}
        <AnimatedCard index={2}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            1-Tap Role Switcher (6 TrackFlow Personas)
          </Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            {ROLE_DESCRIPTIONS[activeRole]}
          </Text>

          <View style={styles.roleGrid}>
            {ALL_ROLES.map((r) => {
              const selected = r === activeRole;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    triggerMediumHaptic();
                    switchRole(r);
                  }}
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor: selected
                        ? theme.primary
                        : theme.muted,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      {
                        color: selected
                          ? theme.primaryForeground
                          : theme.text,
                      },
                    ]}
                  >
                    {ROLE_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text
            style={[
              styles.subHeading,
              { color: theme.textSecondary, marginTop: 12 },
            ]}
          >
            ACTIVE ROLE PERMISSIONS ({ROLE_LABELS[activeRole].toUpperCase()})
          </Text>
          <View style={styles.permWrap}>
            {ALL_PERMISSIONS.map((perm) => {
              const allowed = can(activeRole, perm.key);
              return (
                <Badge
                  key={perm.key}
                  label={`${allowed ? "✓" : "✕"} ${perm.label}`}
                  tone={allowed ? "emerald" : "neutral"}
                />
              );
            })}
          </View>
        </AnimatedCard>

        {/* 4. RECENT AUDIT LOG (ADMIN/MANAGER ONLY) & ACCOUNT ACTIONS */}
        <AnimatedCard index={3}>
          {can(activeRole, "audit:view") ? (
            <>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Local AsyncStorage Audit Stream
                </Text>
                <Badge label={`${auditLogs.length} EVENTS`} tone="cyan" mono />
              </View>

              <View style={styles.auditList}>
                {auditLogs.slice(0, 5).map((entry) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.auditRow,
                      {
                        backgroundColor: theme.muted,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text
                        style={[
                          styles.auditAction,
                          {
                            color: theme.primary,
                            fontFamily: Fonts?.mono,
                          },
                        ]}
                      >
                        {entry.action}
                      </Text>
                      <Text
                        style={[
                          styles.auditTime,
                          {
                            color: theme.textSecondary,
                            fontFamily: Fonts?.mono,
                          },
                        ]}
                      >
                        {formatDateTime(entry.timestamp)}
                      </Text>
                    </View>
                    <Text style={[styles.auditSummary, { color: theme.text }]}>
                      {entry.summary}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.footerBtns}>
            {can(activeRole, "audit:view") ? (
              <Button
                label={
                  resetConfirmed
                    ? "✓ Demo Dataset Restored!"
                    : "Reset Demo Fleet Data"
                }
                variant="secondary"
                size="md"
                style={styles.flex}
                onPress={handleResetDemo}
              />
            ) : null}
            <Button
              label="Sign Out"
              variant="danger"
              size="md"
              style={styles.flex}
              icon={
                <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
              }
              onPress={logout}
            />
          </View>
        </AnimatedCard>
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  cardSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  regionRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  regionLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  regionBtns: {
    flexDirection: "row",
    gap: 6,
  },
  regionChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  regionChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: "900",
  },
  scoreGrade: {
    fontSize: 9,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  statTile: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 9,
    gap: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
  },
  statVal: {
    fontSize: 13,
    fontWeight: "800",
  },
  subHeading: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  shiftWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  leaveInput: {
    flex: 1,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  permWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  auditList: {
    gap: 8,
    marginTop: 10,
  },
  auditRow: {
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 3,
  },
  auditAction: {
    fontSize: 11,
    fontWeight: "800",
  },
  auditTime: {
    fontSize: 10,
  },
  auditSummary: {
    fontSize: 12,
  },
  footerBtns: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
});
