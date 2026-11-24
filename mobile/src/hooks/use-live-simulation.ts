import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { getRouteById } from "@/lib/city-routes";
import {
  interpolateRoutePosition,
  isPointInsideVectorGeofence,
  lerpAngle,
} from "@/lib/geo-sim";
import { triggerWarningHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";
import type {
  LiveVehicleFrame,
  MapCoordinate,
  SimulationTickUpdate,
} from "@/types";

export interface GeofenceBannerEvent {
  id: string;
  vehicleName: string;
  plateNumber: string;
  geofenceName: string;
  color: string;
}

interface MutableSimEntry {
  progress: number;
  headingDeg: number;
  speedKmh: number;
  phaseOffset: number;
  accumulatedDistKm: number;
  accumulatedFuelPct: number;
  insideGeofences: Set<string>;
}

export function useLiveSimulation() {
  const vehicles = useFleetStore((s) => s.vehicles);
  const vectorGeofences = useFleetStore((s) => s.vectorGeofences);
  const isSimulating = useFleetStore((s) => s.isSimulating);
  const simSpeedMultiplier = useFleetStore((s) => s.simSpeedMultiplier);
  const cityRegion = useFleetStore((s) => s.cityRegion);
  const gpsMode = useFleetStore((s) => s.gpsMode);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const applySimulationTick = useFleetStore((s) => s.applySimulationTick);
  const addFleetAlert = useFleetStore((s) => s.addFleetAlert);
  const addPoint = useFleetStore((s) => s.addPoint);

  const [frames, setFrames] = useState<Record<string, LiveVehicleFrame>>({});
  const [activeBanner, setActiveBanner] = useState<GeofenceBannerEvent | null>(
    null
  );
  const [realDeviceLocation, setRealDeviceLocation] =
    useState<MapCoordinate | null>(null);
  const [gpsPermissionError, setGpsPermissionError] = useState<string | null>(
    null
  );

  const vehiclesRef = useRef(vehicles);
  const geofencesRef = useRef(vectorGeofences);
  const isSimulatingRef = useRef(isSimulating);
  const simSpeedRef = useRef(simSpeedMultiplier);
  const cityRegionRef = useRef(cityRegion);
  const gpsModeRef = useRef(gpsMode);
  const selectedVehicleRef = useRef(selectedVehicleId);
  const realLocationRef = useRef< {
    latitude: number;
    longitude: number;
    speedKmh: number;
    headingDeg: number;
  } | null>(null);
  const simMapRef = useRef<Map<string, MutableSimEntry>>(new Map());
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    geofencesRef.current = vectorGeofences;
  }, [vectorGeofences]);

  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  useEffect(() => {
    simSpeedRef.current = simSpeedMultiplier;
  }, [simSpeedMultiplier]);

  useEffect(() => {
    cityRegionRef.current = cityRegion;
  }, [cityRegion]);

  useEffect(() => {
    gpsModeRef.current = gpsMode;
  }, [gpsMode]);

  useEffect(() => {
    selectedVehicleRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  const showGeofenceBanner = useCallback((event: GeofenceBannerEvent) => {
    triggerWarningHaptic();
    setActiveBanner(event);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
    }, 4500);
  }, []);

  // Real Device GPS subscription when gpsMode === "real_gps"
  useEffect(() => {
    if (gpsMode !== "real_gps") {
      setGpsPermissionError(null);
      return;
    }

    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setGpsPermissionError(
              "Location permission denied. Using simulated corridor telemetry."
            );
          }
          return;
        }
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1500,
            distanceInterval: 3,
          },
          (loc) => {
            if (cancelled) return;
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6);
            const headingDeg =
              loc.coords.heading && loc.coords.heading >= 0
                ? loc.coords.heading
                : 0;
            realLocationRef.current = {
              latitude: lat,
              longitude: lng,
              speedKmh,
              headingDeg,
            };
            setRealDeviceLocation({ latitude: lat, longitude: lng });
            addPoint(lat, lng, loc.timestamp);
          }
        );
      } catch {
        if (!cancelled) {
          setGpsPermissionError(
            "GPS sensor unavailable on this simulator. Falling back to Live Sim."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [gpsMode, addPoint]);

  // 60fps Route Interpolation & Geofence Engine
  useEffect(() => {
    let rafId = 0;
    let lastTs = Date.now();
    let lastCommitTs = Date.now();
    let lastUiFrameTs = 0;

    const step = () => {
      const now = Date.now();
      const dtSec = Math.min(0.1, Math.max(0.005, (now - lastTs) / 1000));
      lastTs = now;

      const currentVehicles = vehiclesRef.current;
      const currentGeofences = geofencesRef.current;
      const running = isSimulatingRef.current;
      const speedMult = simSpeedRef.current;
      const region = cityRegionRef.current;

      const nextFrames: Record<string, LiveVehicleFrame> = {};

      for (let idx = 0; idx < currentVehicles.length; idx++) {
        const v = currentVehicles[idx];
        const route = getRouteById(v.routeId);
        let entry = simMapRef.current.get(v.id);

        if (!entry) {
          const initialPos = interpolateRoutePosition(
            route.waypoints,
            v.routeProgress ?? 0,
            route,
            region
          );
          const initInside = new Set<string>();
          for (const g of currentGeofences) {
            if (isPointInsideVectorGeofence(initialPos.x, initialPos.y, g)) {
              initInside.add(g.id);
            }
          }
          entry = {
            progress: v.routeProgress ?? 0,
            headingDeg: initialPos.headingDeg,
            speedKmh: v.status === "on_trip" ? (v.baseSpeedKmh ?? 64) : 0,
            phaseOffset: idx * 1.7 + 0.4,
            accumulatedDistKm: 0,
            accumulatedFuelPct: 0,
            insideGeofences: initInside,
          };
          simMapRef.current.set(v.id, entry);
        }

        const isMoving = v.status === "on_trip" && running;
        let speedKmh = 0;

        if (isMoving) {
          const base = v.baseSpeedKmh ?? 64;
          const wave =
            Math.sin(now * 0.0009 + entry.phaseOffset) * 11 +
            Math.cos(now * 0.0017 + entry.phaseOffset * 1.6) * 6;
          speedKmh = Math.max(24, Math.min(104, base + wave));

          const progressDelta =
            ((speedKmh / 3600) * dtSec * speedMult * 22) / route.distanceKm;
          entry.progress = (entry.progress + progressDelta) % 1;

          const distDeltaKm = progressDelta * route.distanceKm;
          entry.accumulatedDistKm += distDeltaKm;
          entry.accumulatedFuelPct += distDeltaKm * 0.35;
          entry.speedKmh = speedKmh;
        } else {
          entry.speedKmh = 0;
        }

        const pos = interpolateRoutePosition(
          route.waypoints,
          entry.progress,
          route,
          region
        );
        entry.headingDeg = lerpAngle(entry.headingDeg, pos.headingDeg, 0.16);

        if (isMoving) {
          for (const zone of currentGeofences) {
            const isInside = isPointInsideVectorGeofence(pos.x, pos.y, zone);
            const wasInside = entry.insideGeofences.has(zone.id);
            if (isInside && !wasInside) {
              entry.insideGeofences.add(zone.id);
              const speedLabel = Math.round(speedKmh);
              addFleetAlert({
                severity: "info",
                title: `Geofence Entry: ${zone.name}`,
                message: `${v.name} (${v.plate}) entered ${zone.name} at ${speedLabel} km/h.`,
                vehicleId: v.id,
                timestamp: Date.now(),
              });
              showGeofenceBanner({
                id: `${v.id}-${zone.id}-${now}`,
                vehicleName: v.name,
                plateNumber: v.plate,
                geofenceName: zone.name,
                color: zone.color,
              });
            } else if (!isInside && wasInside) {
              entry.insideGeofences.delete(zone.id);
            }
          }
        }

        // If Real GPS is active for the currently selected vehicle, override its coordinates with real device GPS
        const useRealGps =
          gpsModeRef.current === "real_gps" &&
          v.id === selectedVehicleRef.current &&
          realLocationRef.current !== null;

        const finalLat = useRealGps
          ? realLocationRef.current!.latitude
          : pos.latitude;
        const finalLng = useRealGps
          ? realLocationRef.current!.longitude
          : pos.longitude;
        const finalSpeed = useRealGps
          ? realLocationRef.current!.speedKmh || entry.speedKmh
          : entry.speedKmh;
        const finalHeading = useRealGps
          ? realLocationRef.current!.headingDeg || entry.headingDeg
          : entry.headingDeg;

        nextFrames[v.id] = {
          vehicleId: v.id,
          x: pos.x,
          y: pos.y,
          latitude: finalLat,
          longitude: finalLng,
          headingDeg: finalHeading,
          speedKmh: finalSpeed,
          routeProgress: entry.progress,
          coveredPoints: pos.coveredPoints,
          remainingPoints: pos.remainingPoints,
          coveredCoords: pos.coveredCoords,
          remainingCoords: pos.remainingCoords,
          turnInstruction: pos.turnInstruction,
        };
      }

      if (now - lastUiFrameTs >= 48) {
        lastUiFrameTs = now;
        setFrames(nextFrames);
      }

      if (now - lastCommitTs >= 1500 && running) {
        lastCommitTs = now;
        const updates: SimulationTickUpdate[] = [];
        for (const v of currentVehicles) {
          if (v.status !== "on_trip") continue;
          const entry = simMapRef.current.get(v.id);
          const frame = nextFrames[v.id];
          if (!entry || !frame) continue;

          updates.push({
            vehicleId: v.id,
            routeProgress: entry.progress,
            latitude: frame.latitude,
            longitude: frame.longitude,
            speed: Number(frame.speedKmh.toFixed(1)),
            heading: Number(frame.headingDeg.toFixed(1)),
            deltaDistanceKm: entry.accumulatedDistKm,
            deltaFuelPercent: entry.accumulatedFuelPct,
            timestamp: now,
          });
          entry.accumulatedDistKm = 0;
          entry.accumulatedFuelPct = 0;
        }
        if (updates.length > 0) {
          applySimulationTick(updates);
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, [applySimulationTick, addFleetAlert, showGeofenceBanner]);

  return {
    frames,
    activeBanner,
    dismissBanner: () => setActiveBanner(null),
    realDeviceLocation,
    gpsPermissionError,
  };
}
