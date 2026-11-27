import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { getScopedAlerts } from "@/lib/rbac-scope";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { FleetAlert, FleetAlertSeverity } from "@/types";

type AlertFilter = "all" | "unread" | "critical" | "info";

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return dayjs(timestamp).format("MMM D, h:mm A");
}

const SEVERITY_META: Record<
  FleetAlertSeverity,
  {
    icon: keyof typeof Ionicons.glyphMap;
    tone: BadgeTone;
    label: string;
  }
> = {
  critical: {
    icon: "alert-circle",
    tone: "danger",
    label: "CRITICAL",
  },
  warning: {
    icon: "warning-outline",
    tone: "neutral",
    label: "WARNING",
  },
  info: {
    icon: "information-circle-outline",
    tone: "primary",
    label: "NOTICE",
  },
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const allAlerts = useFleetStore((s) => s.alerts);
  const drivers = useFleetStore((s) => s.drivers);
  const bookings = useFleetStore((s) => s.bookings);
  const trips = useFleetStore((s) => s.trips);
  const markAlertRead = useFleetStore((s) => s.markAlertRead);
  const markAllAlertsRead = useFleetStore((s) => s.markAllAlertsRead);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);
  const vehicles = useFleetStore((s) => s.vehicles);

  const alerts = useMemo(
    () =>
      getScopedAlerts(
        currentUser,
        drivers,
        vehicles,
        bookings,
        trips,
        allAlerts
      ),
    [currentUser, drivers, vehicles, bookings, trips, allAlerts]
  );

  const [filter, setFilter] = useState<AlertFilter>("all");

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts]
  );
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === "critical").length,
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filter === "unread") return !a.read;
      if (filter === "critical") return a.severity === "critical";
      if (filter === "info") return a.severity !== "critical";
      return true;
    });
  }, [alerts, filter]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const handleTrackVehicle = (vehicleId: string) => {
    triggerMediumHaptic();
    setSelectedVehicle(vehicleId);
    router.dismissAll();
    router.navigate("/(tabs)");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Top Modal Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: theme.text, fontFamily: Fonts.bold },
              ]}
            >
              Notifications & Alerts
            </Text>
            {unreadCount > 0 ? (
              <Badge
                label={`${unreadCount} UNREAD`}
                tone="danger"
                mono
              />
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Live exceptions, safety incidents & dispatch milestones
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close notifications modal"
          style={[styles.closeBtn, { backgroundColor: theme.muted }]}
        >
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.topControlSection}>
        <SegmentedControl
          options={[
            { value: "all", label: "All", count: alerts.length },
            { value: "unread", label: "Unread", count: unreadCount },
            { value: "critical", label: "Critical", count: criticalCount },
            { value: "info", label: "Updates" },
          ]}
          value={filter}
          onChange={(next) => setFilter(next)}
        />
      </View>

      {/* Notification Stream */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAlerts.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: theme.muted },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={32}
                color={theme.statusLive}
              />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: theme.text, fontFamily: Fonts.bold },
              ]}
            >
              All Systems Normal
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              {filter === "unread"
                ? "No unread notifications. All fleet events have been acknowledged."
                : "No active alerts in this category."}
            </Text>
          </View>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.info;
            const vehicle = alert.vehicleId
              ? vehiclesById.get(alert.vehicleId)
              : undefined;

            return (
              <AnimatedCard
                key={alert.id}
                index={idx}
                onPress={() => {
                  triggerLightHaptic();
                  if (!alert.read) markAlertRead(alert.id);
                }}
                style={[
                  styles.alertCard,
                  !alert.read && {
                    borderColor:
                      alert.severity === "critical"
                        ? theme.danger
                        : theme.borderFocus,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        {
                          backgroundColor:
                            alert.severity === "critical"
                              ? theme.isDark
                                ? "rgba(239, 68, 68, 0.16)"
                                : "rgba(220, 38, 38, 0.10)"
                              : theme.muted,
                        },
                      ]}
                    >
                      <Ionicons
                        name={meta.icon}
                        size={18}
                        color={
                          alert.severity === "critical"
                            ? theme.danger
                            : theme.primary
                        }
                      />
                    </View>

                    <View style={styles.headerInfo}>
                      <View style={styles.badgeLine}>
                        <Badge label={meta.label} tone={meta.tone} />
                        {vehicle ? (
                          <Badge
                            label={vehicle.plate}
                            tone="neutral"
                            mono
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.alertTitle,
                          {
                            color: theme.text,
                            fontFamily: Fonts.bold,
                          },
                        ]}
                      >
                        {alert.title}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.headerRight}>
                    <Text
                      style={[
                        styles.timeText,
                        {
                          color: theme.textSecondary,
                          fontFamily: Fonts.mono,
                        },
                      ]}
                    >
                      {formatRelativeTime(alert.timestamp)}
                    </Text>
                    {!alert.read ? (
                      <View
                        style={[
                          styles.unreadDot,
                          {
                            backgroundColor:
                              alert.severity === "critical"
                                ? theme.danger
                                : theme.primary,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </View>

                {/* Message Body */}
                <Text
                  style={[
                    styles.alertMessage,
                    { color: theme.textSecondary, fontFamily: Fonts.regular },
                  ]}
                >
                  {alert.message}
                </Text>

                {/* Bottom Card Actions */}
                <View style={styles.cardFooter}>
                  {alert.vehicleId ? (
                    <Button
                      label="View on Live Map"
                      size="sm"
                      variant="primary"
                      icon={
                        <Ionicons
                          name="navigate"
                          size={13}
                          color={theme.primaryForeground}
                        />
                      }
                      onPress={() => handleTrackVehicle(alert.vehicleId!)}
                      style={styles.actionBtn}
                    />
                  ) : null}

                  {!alert.read ? (
                    <Button
                      label="Mark Read"
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        triggerLightHaptic();
                        markAlertRead(alert.id);
                      }}
                    />
                  ) : (
                    <View style={styles.readCheckWrap}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.readCheckText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Read
                      </Text>
                    </View>
                  )}
                </View>
              </AnimatedCard>
            );
          })
        )}
      </ScrollView>

      {/* Sticky Bottom Action Footer */}
      <View
        style={[
          styles.footer,
          { backgroundColor: theme.background, borderTopColor: theme.border },
        ]}
      >
        <Button
          label={
            unreadCount > 0 ? `Mark All as Read (${unreadCount})` : "All Caught Up"
          }
          variant="secondary"
          size="md"
          disabled={unreadCount === 0}
          icon={
            <Ionicons
              name="checkmark-done"
              size={16}
              color={unreadCount === 0 ? theme.textSecondary : theme.text}
            />
          }
          onPress={() => {
            triggerLightHaptic();
            markAllAlertsRead();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  titleWrap: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topControlSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  alertCard: {
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  badgeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alertTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  timeText: {
    fontSize: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.15)",
  },
  actionBtn: {
    paddingHorizontal: 12,
  },
  readCheckWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  readCheckText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
