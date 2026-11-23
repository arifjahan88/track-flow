import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopStatusHeader } from "@/components/layout/top-status-header";
import { DriverCockpitSheet } from "@/components/map/driver-cockpit-sheet";
import { GeofenceAlertToast } from "@/components/map/geofence-alert-toast";
import { RealFleetMap } from "@/components/map/real-fleet-map";
import { SpeedCompassHud } from "@/components/map/speed-compass-hud";
import { useLiveSimulation } from "@/hooks/use-live-simulation";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";

export default function MapCockpitScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    frames,
    activeBanner,
    dismissBanner,
    realDeviceLocation,
    gpsPermissionError,
  } = useLiveSimulation();

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const vectorGeofences = useFleetStore((s) => s.vectorGeofences);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const isSimulating = useFleetStore((s) => s.isSimulating);
  const simSpeedMultiplier = useFleetStore((s) => s.simSpeedMultiplier);
  const gpsMode = useFleetStore((s) => s.gpsMode);
  const cityRegion = useFleetStore((s) => s.cityRegion);

  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);
  const setIsSimulating = useFleetStore((s) => s.setIsSimulating);
  const setSimSpeedMultiplier = useFleetStore((s) => s.setSimSpeedMultiplier);
  const setGpsMode = useFleetStore((s) => s.setGpsMode);
  const setCityRegion = useFleetStore((s) => s.setCityRegion);
  const pauseTrip = useFleetStore((s) => s.pauseTrip);
  const resumeTrip = useFleetStore((s) => s.resumeTrip);

  const [followCamera, setFollowCamera] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "driver";

  // Automatically select the driver's assigned vehicle when signed in as Driver
  useEffect(() => {
    if (activeRole === "driver" && currentUser?.assignedVehicleId) {
      setSelectedVehicle(currentUser.assignedVehicleId);
    }
  }, [activeRole, currentUser?.assignedVehicleId, setSelectedVehicle]);

  const effectiveSelectedId = useMemo(() => {
    if (vehicles.some((v) => v.id === selectedVehicleId)) {
      return selectedVehicleId;
    }
    return vehicles[0]?.id ?? "veh-1";
  }, [vehicles, selectedVehicleId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === effectiveSelectedId),
    [vehicles, effectiveSelectedId]
  );

  const activeTrip = useMemo(
    () =>
      trips.find(
        (t) => t.vehicleId === effectiveSelectedId && t.status !== "done"
      ),
    [trips, effectiveSelectedId]
  );

  const selectedFrame = frames[effectiveSelectedId];

  const handleCycleSimSpeed = () => {
    const next =
      simSpeedMultiplier === 1 ? 2 : simSpeedMultiplier === 2 ? 4 : 1;
    setSimSpeedMultiplier(next);
  };

  const handlePauseOrResume = () => {
    if (activeTrip?.status === "paused") {
      resumeTrip();
    } else {
      pauseTrip();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Full-Screen Real Street Map (Uber / Pathao Style) */}
      <RealFleetMap
        vehicles={vehicles}
        frames={frames}
        geofences={vectorGeofences}
        showGeofences={showGeofences}
        selectedVehicleId={effectiveSelectedId}
        onSelectVehicle={(id) => {
          setSelectedVehicle(id);
          setFollowCamera(true);
        }}
        followCamera={followCamera}
        cityRegion={cityRegion}
        activeWaypoints={activeTrip?.waypoints ?? []}
        realDeviceLocation={realDeviceLocation}
        fitTrigger={fitTrigger}
      />

      {/* Top Overlay: Clean Compact Status Bar + Geofence Toast */}
      <View
        pointerEvents="box-none"
        style={[
          styles.topOverlay,
          { paddingTop: Math.max(insets.top + 4, 10) },
        ]}
      >
        <TopStatusHeader floating />

        <GeofenceAlertToast banner={activeBanner} onDismiss={dismissBanner} />

        {gpsPermissionError ? (
          <View
            style={[
              styles.gpsNotice,
              {
                backgroundColor: theme.card,
                borderColor: theme.danger,
              },
            ]}
          >
            <Text style={[styles.gpsNoticeText, { color: theme.danger }]}>
              {gpsPermissionError}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Overlay: Minimal 3-Button Dock + Integrated Driver Cockpit Sheet */}
      <View pointerEvents="box-none" style={styles.bottomOverlay}>
        <SpeedCompassHud
          followCamera={followCamera}
          onToggleFollow={() => setFollowCamera((prev) => !prev)}
          onFitRoute={() => {
            setFollowCamera(false);
            setFitTrigger((c) => c + 1);
          }}
          isSimulating={isSimulating}
          onToggleSimulating={() => setIsSimulating(!isSimulating)}
          simSpeedMultiplier={simSpeedMultiplier}
          onCycleSimSpeed={handleCycleSimSpeed}
          gpsMode={gpsMode}
          onToggleGpsMode={() =>
            setGpsMode(gpsMode === "sim" ? "real_gps" : "sim")
          }
          cityRegion={cityRegion}
          onToggleCityRegion={() =>
            setCityRegion(cityRegion === "dhaka" ? "sf_bay" : "dhaka")
          }
          showGeofences={showGeofences}
          onToggleGeofences={() => setShowGeofences((prev) => !prev)}
        />

        <DriverCockpitSheet
          role={activeRole}
          vehicles={vehicles}
          drivers={drivers}
          selectedVehicle={selectedVehicle}
          activeTrip={activeTrip}
          frame={selectedFrame}
          frames={frames}
          speedKmh={
            selectedFrame?.speedKmh ??
            selectedVehicle?.lastKnownLocation?.speed ??
            0
          }
          headingDeg={
            selectedFrame?.headingDeg ??
            selectedVehicle?.lastKnownLocation?.heading ??
            0
          }
          speedLimitKmh={
            selectedFrame?.turnInstruction.speedLimitKmh ?? 60
          }
          onSelectVehicle={(id) => {
            setSelectedVehicle(id);
            setFollowCamera(true);
          }}
          onPauseOrResumeTrip={handlePauseOrResume}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    gap: 8,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
  },
  gpsNotice: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  gpsNoticeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
