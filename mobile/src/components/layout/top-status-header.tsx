import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RoleSwitcherSheet } from "@/components/layout/role-switcher-sheet";
import { PulseDot } from "@/components/ui/pulse-dot";
import { ThemeToggleButton } from "@/components/ui/theme-toggle";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerMediumHaptic } from "@/lib/haptics";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";

interface TopStatusHeaderProps {
  title?: string;
  subtitle?: string;
  floating?: boolean;
}

export function TopStatusHeader({
  title,
  subtitle,
  floating = false,
}: TopStatusHeaderProps) {
  const theme = useTheme();
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const driverOnDuty = useFleetStore((s) => s.driverOnDuty);
  const toggleDriverOnDuty = useFleetStore((s) => s.toggleDriverOnDuty);
  const alerts = useFleetStore((s) => s.alerts);
  const markAllAlertsRead = useFleetStore((s) => s.markAllAlertsRead);

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";
  const unreadAlerts = alerts.filter((a) => !a.read).length;

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: floating ? theme.glassBg : theme.card,
            borderColor: theme.border,
          },
          floating && styles.floating,
        ]}
      >
        {/* Left: Brand or Screen Title / On-Duty Toggle */}
        {title ? (
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[styles.subtitle, { color: theme.textSecondary }]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => {
              triggerMediumHaptic();
              toggleDriverOnDuty();
            }}
            style={[
              styles.onDutyPill,
              {
                backgroundColor: driverOnDuty
                  ? theme.isDark
                    ? "rgba(16, 185, 129, 0.16)"
                    : "rgba(5, 150, 105, 0.14)"
                  : theme.muted,
                borderColor: driverOnDuty ? theme.statusLive : theme.border,
              },
            ]}
          >
            <PulseDot
              color={driverOnDuty ? theme.statusLive : theme.textMuted}
              active={driverOnDuty}
              size={8}
            />
            <Text
              style={[
                styles.onDutyText,
                {
                  color: driverOnDuty
                    ? theme.statusLive
                    : theme.textSecondary,
                },
              ]}
            >
              {driverOnDuty ? "ON DUTY · ONLINE" : "OFF DUTY"}
            </Text>
          </Pressable>
        )}

        {/* Right Controls: Role Switcher Pill + Theme Toggle + Alerts Bell */}
        <View style={styles.rightControls}>
          <Pressable
            onPress={() => setRoleSheetOpen(true)}
            style={[
              styles.rolePill,
              {
                backgroundColor: theme.cardElevated,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons
              name="person-circle-outline"
              size={15}
              color={theme.primary}
            />
            <Text
              numberOfLines={1}
              style={[styles.roleText, { color: theme.text }]}
            >
              {ROLE_LABELS[activeRole]}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={theme.textSecondary}
            />
          </Pressable>

          <ThemeToggleButton compact />

          {unreadAlerts > 0 ? (
            <Pressable
              onPress={markAllAlertsRead}
              style={[
                styles.alertBtn,
                {
                  backgroundColor: theme.isDark
                    ? "rgba(255, 107, 115, 0.16)"
                    : "rgba(220, 38, 38, 0.12)",
                  borderColor: theme.danger,
                },
              ]}
            >
              <Ionicons name="notifications" size={14} color={theme.danger} />
              <Text style={[styles.alertCount, { color: theme.danger }]}>
                {unreadAlerts}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <RoleSwitcherSheet
        visible={roleSheetOpen}
        onClose={() => setRoleSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  floating: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  onDutyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  onDutyText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  rightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  alertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  alertCount: {
    fontSize: 11,
    fontWeight: "800",
  },
});
