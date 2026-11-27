import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PulseDot } from "@/components/ui/pulse-dot";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ThemeToggleButton } from "@/components/ui/theme-toggle";
import { Fonts, Radius } from "@/constants/theme";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTheme } from "@/hooks/use-theme";
import {
  triggerLightHaptic,
  triggerMediumHaptic,
  triggerSuccessHaptic,
} from "@/lib/haptics";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/rbac";
import { DEMO_ACCOUNTS, useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { UserRole } from "@/types";

const ROLE_ICON: Record<UserRole, keyof typeof Ionicons.glyphMap> = {
  driver: "navigate-circle",
  employee: "person",
  dispatcher: "radio",
  fleet_manager: "briefcase",
  mechanic: "construct",
  super_admin: "shield-checkmark",
};

const ROLE_TONE: Record<UserRole, BadgeTone> = {
  driver: "primary",
  employee: "primary",
  dispatcher: "neutral",
  fleet_manager: "neutral",
  mechanic: "neutral",
  super_admin: "primary",
};

export default function LoginScreen() {
  const theme = useTheme();
  const hydrated = useHydrated();

  const currentUserId = useAuthStore((s) => s.currentUserId);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);
  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("driver@demo.com");
  const [password, setPassword] = useState("demo1234");
  const [registerRole, setRegisterRole] = useState<UserRole>("driver");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoExpanded, setDemoExpanded] = useState(false);

  useEffect(() => {
    if (hydrated && currentUserId) {
      router.replace("/(tabs)/dashboard");
    }
  }, [hydrated, currentUserId]);

  const handleFormSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const err =
      mode === "signin"
        ? await login(email, password)
        : await register(name, email, password, registerRole);

    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    triggerSuccessHaptic();
    router.replace("/(tabs)/dashboard");
  };

  const handleQuickDemo = (role: UserRole, assignedVehicleId?: string) => {
    triggerMediumHaptic();
    setError(null);
    if (assignedVehicleId) {
      setSelectedVehicle(assignedVehicleId);
    }
    loginAsDemo(role);
    router.replace("/(tabs)/dashboard");
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Brand & Light/Dark Theme Switcher */}
          <Animated.View
            entering={FadeInUp.duration(160)}
            style={styles.topRow}
          >
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.logoBadge,
                  {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <Ionicons
                  name="navigate"
                  size={18}
                  color={theme.primaryForeground}
                />
              </View>
              <View>
                <Text style={[styles.brandName, { color: theme.text }]}>
                  TrackFlow Mobile
                </Text>
                <Text
                  style={[styles.brandSub, { color: theme.textSecondary }]}
                >
                  Driver Cockpit & Fleet Command
                </Text>
              </View>
            </View>

            <ThemeToggleButton />
          </Animated.View>

          {/* Hero Telemetry Banner */}
          <Animated.View
            entering={FadeInDown.delay(40).duration(160)}
            style={[
              styles.heroCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.heroPillRow}>
              <View
                style={[
                  styles.liveBadge,
                  {
                    backgroundColor: theme.isDark
                      ? "rgba(16, 185, 129, 0.16)"
                      : "rgba(5, 150, 105, 0.12)",
                    borderColor: theme.statusLive,
                  },
                ]}
              >
                <PulseDot color={theme.statusLive} size={7} />
                <Text
                  style={[
                    styles.liveBadgeText,
                    { color: theme.statusLive, fontFamily: Fonts?.mono },
                  ]}
                >
                  REAL GPS & LIVE STREET MAP
                </Text>
              </View>
              <Badge label="OFFLINE ASYNCSTORAGE" tone="primary" mono />
            </View>

            <Text style={[styles.heroTitle, { color: theme.text }]}>
              Every trip, route & vehicle in your pocket.
            </Text>
            <Text style={[styles.heroDesc, { color: theme.textSecondary }]}>
              Uber & Pathao-inspired live driver navigation cockpit, turn-by-turn
              corridors, pre/post inspection checklists, POD finger signatures,
              and multi-role fleet dispatch.
            </Text>
          </Animated.View>

          {/* Sign In / Register Credentials Card */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(160)}
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <SegmentedControl
              options={[
                { value: "signin", label: "Sign In" },
                { value: "register", label: "Create Account" },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
                if (next === "signin") {
                  setEmail("driver@demo.com");
                  setPassword("demo1234");
                } else {
                  setEmail("");
                  setPassword("");
                }
              }}
            />

            {mode === "register" ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Full Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Arif Rahman"
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

                <Text
                  style={[
                    styles.label,
                    { color: theme.textSecondary, marginTop: 6 },
                  ]}
                >
                  Select Account Role
                </Text>
                <View style={styles.roleChips}>
                  {ALL_ROLES.map((r) => {
                    const selected = registerRole === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setRegisterRole(r)}
                        style={[
                          styles.roleChip,
                          {
                            backgroundColor: selected
                              ? theme.primary
                              : theme.muted,
                            borderColor: selected
                              ? theme.primary
                              : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleChipText,
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
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="driver@demo.com"
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="demo1234"
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
            </View>

            {error ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    borderColor: theme.danger,
                    backgroundColor: "rgba(255, 107, 115, 0.12)",
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Button
              label={
                mode === "signin"
                  ? "Sign In to Cockpit"
                  : "Create Account & Launch"
              }
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleFormSubmit}
              rightIcon={
                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color={theme.primaryForeground}
                />
              }
            />
          </Animated.View>

          {/* 1-Click Quick Demo Launchers (Collapsible at bottom) */}
          <Animated.View
            entering={FadeInDown.delay(120).duration(160)}
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: demoExpanded }}
              onPress={() => {
                triggerLightHaptic();
                setDemoExpanded((prev) => !prev);
              }}
              style={styles.sectionHeader}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                1-Tap Quick Demo Accounts
              </Text>
              <View style={styles.sectionHeaderRight}>
                <Text
                  style={[
                    styles.sectionCount,
                    { color: theme.primary, fontFamily: Fonts?.mono },
                  ]}
                >
                  6 ROLES READY
                </Text>
                <Ionicons
                  name={demoExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>

            {demoExpanded ? (
              <View style={styles.demoList}>
                {DEMO_ACCOUNTS.map((acct) => {
                  const isPrimaryDriver = acct.role === "driver";
                  return (
                    <Pressable
                      key={acct.id}
                      onPress={() =>
                        handleQuickDemo(acct.role, acct.assignedVehicleId)
                      }
                      style={[
                        styles.demoItem,
                        {
                          backgroundColor: isPrimaryDriver
                            ? theme.cardElevated
                            : theme.muted,
                          borderColor: isPrimaryDriver
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.demoIconBox,
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
                            isPrimaryDriver
                              ? theme.primary
                              : theme.textSecondary
                          }
                        />
                      </View>

                      <View style={styles.demoTextCol}>
                        <View style={styles.demoTopLine}>
                          <Text
                            style={[styles.demoName, { color: theme.text }]}
                          >
                            {acct.name}
                          </Text>
                          <Badge
                            label={
                              isPrimaryDriver
                                ? "PRIMARY · DRIVER"
                                : ROLE_LABELS[acct.role]
                            }
                            tone={ROLE_TONE[acct.role]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.demoEmail,
                            {
                              color: theme.textSecondary,
                              fontFamily: Fonts?.mono,
                            },
                          ]}
                        >
                          {acct.email} · pass: demo1234
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.demoTagline,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {acct.tagline}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 18,
    gap: 16,
    paddingBottom: 36,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  heroCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  heroPillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 27,
  },
  heroDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: "800",
  },
  demoList: {
    gap: 9,
  },
  demoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 11,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  demoIconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demoTextCol: {
    flex: 1,
    gap: 2,
  },
  demoTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  demoName: {
    fontSize: 13,
    fontWeight: "800",
  },
  demoEmail: {
    fontSize: 10,
  },
  demoTagline: {
    fontSize: 11,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  roleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
