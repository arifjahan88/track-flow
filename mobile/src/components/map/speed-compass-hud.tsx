import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerLightHaptic } from "@/lib/haptics";
import type { CityRegionId, GpsTrackingMode } from "@/types";

interface SpeedCompassHudProps {
  speedKmh?: number;
  headingDeg?: number;
  speedLimitKmh?: number;
  followCamera: boolean;
  onToggleFollow: () => void;
  onFitRoute: () => void;
  isSimulating: boolean;
  onToggleSimulating: () => void;
  simSpeedMultiplier: 1 | 2 | 4;
  onCycleSimSpeed: () => void;
  gpsMode: GpsTrackingMode;
  onToggleGpsMode: () => void;
  cityRegion: CityRegionId;
  onToggleCityRegion: () => void;
  showGeofences: boolean;
  onToggleGeofences: () => void;
}

export function SpeedCompassHud({
  followCamera,
  onToggleFollow,
  onFitRoute,
  isSimulating,
  onToggleSimulating,
  simSpeedMultiplier,
  onCycleSimSpeed,
  gpsMode,
  onToggleGpsMode,
  cityRegion,
  onToggleCityRegion,
  showGeofences,
  onToggleGeofences,
}: SpeedCompassHudProps) {
  const theme = useTheme();
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);

  return (
    <>
      {/* Sleek Human-Crafted 3-Button Map Control Dock (Right Edge) */}
      <View style={styles.dockContainer} pointerEvents="box-none">
        <View
          style={[
            styles.dockPill,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          {/* Recenter / Follow Camera Toggle */}
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              onToggleFollow();
            }}
            accessibilityRole="button"
            accessibilityLabel="Recenter and follow camera"
            style={[
              styles.dockBtn,
              {
                backgroundColor: followCamera ? theme.primary : "transparent",
              },
            ]}
          >
            <Ionicons
              name={followCamera ? "locate" : "locate-outline"}
              size={15}
              color={followCamera ? theme.primaryForeground : theme.text}
            />
          </Pressable>

          <View style={[styles.dockDivider, { backgroundColor: theme.border }]} />

          {/* Fit Route Bounds */}
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              onFitRoute();
            }}
            accessibilityRole="button"
            accessibilityLabel="Fit entire route bounds"
            style={styles.dockBtn}
          >
            <Ionicons name="scan-outline" size={14} color={theme.text} />
          </Pressable>

          <View style={[styles.dockDivider, { backgroundColor: theme.border }]} />

          {/* Map Layers & Simulation Options Sheet */}
          <Pressable
            onPress={() => {
              triggerLightHaptic();
              setShowOptionsSheet(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open map options and simulation settings"
            style={styles.dockBtn}
          >
            <Ionicons name="options-outline" size={14} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Clean Modal Sheet for Secondary Controls & Simulation Engine */}
      <Modal
        visible={showOptionsSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsSheet(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowOptionsSheet(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: theme.shadowColor,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Map & Simulation Controls
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                  Region, GPS feeds, and virtual fleet telemetry
                </Text>
              </View>
              <Pressable
                onPress={() => setShowOptionsSheet(false)}
                style={[styles.closeBtn, { backgroundColor: theme.muted }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>

            {/* City Region Switcher */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
                CITY REGION
              </Text>
              <SegmentedControl
                options={[
                  { value: "dhaka", label: "Dhaka Metro" },
                  { value: "sf_bay", label: "SF Bay Hub" },
                ]}
                value={cityRegion}
                onChange={() => onToggleCityRegion()}
              />
            </View>

            {/* GPS Tracking Feed */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
                GPS POSITIONING FEED
              </Text>
              <SegmentedControl
                options={[
                  { value: "sim", label: "Street Simulation" },
                  { value: "real_gps", label: "Real Device GPS" },
                ]}
                value={gpsMode}
                onChange={() => onToggleGpsMode()}
              />
            </View>

            {/* Simulation Playback & Speed */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: theme.textSecondary }]}>
                SIMULATION PLAYBACK
              </Text>
              <View style={styles.simRow}>
                <Pressable
                  onPress={() => {
                    triggerLightHaptic();
                    onToggleSimulating();
                  }}
                  style={[
                    styles.simPlayBtn,
                    {
                      backgroundColor: isSimulating ? theme.cardElevated : theme.primary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={isSimulating ? "pause" : "play"}
                    size={16}
                    color={isSimulating ? theme.text : theme.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.simPlayText,
                      {
                        color: isSimulating ? theme.text : theme.primaryForeground,
                      },
                    ]}
                  >
                    {isSimulating ? "Pause Simulation" : "Resume Simulation"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerLightHaptic();
                    onCycleSimSpeed();
                  }}
                  style={[
                    styles.simSpeedBtn,
                    {
                      backgroundColor: theme.cardElevated,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.simSpeedText,
                      { color: theme.primary, fontFamily: Fonts?.mono },
                    ]}
                  >
                    {simSpeedMultiplier}x Speed
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Vector Geofences Toggle */}
            <View style={[styles.toggleRow, { borderTopColor: theme.border }]}>
              <View>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  Vector Geofence Zones
                </Text>
                <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                  Show warehouse & corridor alert boundaries
                </Text>
              </View>
              <Switch
                value={showGeofences}
                onValueChange={() => {
                  triggerLightHaptic();
                  onToggleGeofences();
                }}
                trackColor={{ false: theme.muted, true: theme.primary }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  dockPill: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  dockBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  dockDivider: {
    height: 1,
    width: "100%",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  settingGroup: {
    gap: 6,
  },
  settingLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  simRow: {
    flexDirection: "row",
    gap: 10,
  },
  simPlayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  simPlayText: {
    fontSize: 13,
    fontWeight: "700",
  },
  simSpeedBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  simSpeedText: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
