import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ThemePreferenceSelector } from "@/components/ui/theme-toggle";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerMediumHaptic } from "@/lib/haptics";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/rbac";
import { DEMO_ACCOUNTS, useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types";

interface RoleSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  driver: "primary",
  employee: "primary",
  dispatcher: "neutral",
  fleet_manager: "neutral",
  mechanic: "neutral",
  super_admin: "primary",
};

const ROLE_ICON: Record<UserRole, keyof typeof Ionicons.glyphMap> = {
  driver: "navigate-circle",
  employee: "person",
  dispatcher: "radio",
  fleet_manager: "briefcase",
  mechanic: "construct",
  super_admin: "shield-checkmark",
};

export function RoleSwitcherSheet({
  visible,
  onClose,
}: RoleSwitcherSheetProps) {
  const theme = useTheme();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const logout = useAuthStore((s) => s.logout);

  const currentUser = users.find((u) => u.id === currentUserId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                Quick Role & Theme Switcher
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Test all 6 TrackFlow personas &amp; Light/Dark cockpit modes
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.muted }]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              APPEARANCE (LIGHT & DARK THEME)
            </Text>
            <ThemePreferenceSelector />

            <Text
              style={[
                styles.sectionLabel,
                { color: theme.textSecondary, marginTop: 14 },
              ]}
            >
              1-TAP DEMO ROLE SWITCHER (5 ROLES)
            </Text>

            {DEMO_ACCOUNTS.map((acct) => {
              const isSelected = currentUser?.role === acct.role;
              return (
                <Pressable
                  key={acct.id}
                  onPress={() => {
                    triggerMediumHaptic();
                    switchRole(acct.role);
                    onClose();
                  }}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: isSelected
                        ? theme.cardElevated
                        : theme.muted,
                      borderColor: isSelected
                        ? theme.borderFocus
                        : theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={ROLE_ICON[acct.role]}
                      size={20}
                      color={
                        isSelected ? theme.primary : theme.textSecondary
                      }
                    />
                  </View>

                  <View style={styles.roleInfo}>
                    <View style={styles.roleNameRow}>
                      <Text style={[styles.roleName, { color: theme.text }]}>
                        {acct.name}
                      </Text>
                      <Badge
                        label={ROLE_LABELS[acct.role]}
                        tone={ROLE_TONE[acct.role]}
                      />
                    </View>
                    <Text
                      style={[styles.roleEmail, { color: theme.textSecondary }]}
                    >
                      {acct.email}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.roleDesc, { color: theme.textSecondary }]}
                    >
                      {ROLE_DESCRIPTIONS[acct.role]}
                    </Text>
                  </View>

                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => {
                triggerMediumHaptic();
                onClose();
                logout();
              }}
              style={[
                styles.logoutBtn,
                {
                  borderColor: theme.danger,
                  backgroundColor: theme.isDark
                    ? "rgba(255,107,115,0.1)"
                    : "rgba(220,38,38,0.08)",
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={[styles.logoutText, { color: theme.danger }]}>
                Sign Out of TrackFlow
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 12, 20, 0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
    maxHeight: "86%",
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    gap: 10,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roleInfo: {
    flex: 1,
    gap: 2,
  },
  roleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  roleName: {
    fontSize: 14,
    fontWeight: "700",
  },
  roleEmail: {
    fontSize: 11,
  },
  roleDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  logoutBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
