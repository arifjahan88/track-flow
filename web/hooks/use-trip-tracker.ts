"use client";

import { useEffect, useRef, useState } from "react";
import type { Trip } from "@/types";
import { SIM_ROUTE } from "@/lib/geo";
import { useFleetStore } from "@/store/fleet-store";

export type TrackingSource = "simulate" | "gps";

interface UseTripTrackerOptions {
  activeTrip: Trip | null;
  source: TrackingSource;
  onAutoComplete?: () => void;
}

interface UseTripTrackerResult {
  gpsError: string | null;
  wakeLockActive: boolean;
}

export function useTripTracker({
  activeTrip,
  source,
  onAutoComplete,
}: UseTripTrackerOptions): UseTripTrackerResult {
  const addPoint = useFleetStore((s) => s.addPoint);
  const endTrip = useFleetStore((s) => s.endTrip);

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const onAutoCompleteRef = useRef(onAutoComplete);
  useEffect(() => {
    onAutoCompleteRef.current = onAutoComplete;
  }, [onAutoComplete]);

  const isTracking = activeTrip?.status === "active";
  const activeTripId = activeTrip?.id ?? null;

  // Screen wake lock while actively tracking
  useEffect(() => {
    if (!isTracking) {
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) {
            void lock.release();
          } else {
            sentinel = lock;
            setWakeLockActive(true);
          }
        })
        .catch(() => {
          // Wake lock may be denied on battery saver or background tabs
        });
    }

    return () => {
      cancelled = true;
      setWakeLockActive(false);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [isTracking]);

  // Simulator or Geolocation tracker
  useEffect(() => {
    if (!isTracking || !activeTripId) {
      return;
    }

    if (source === "simulate") {
      // Seed the first point immediately if trip has 0 points
      const currentTrip = useFleetStore
        .getState()
        .trips.find((t) => t.id === activeTripId);
      let nextIndex = currentTrip?.points.length ?? 0;

      if (nextIndex === 0 && SIM_ROUTE[0]) {
        addPoint(SIM_ROUTE[0].lat, SIM_ROUTE[0].lng, Date.now());
        nextIndex = 1;
      }

      const timer = window.setInterval(() => {
        const latestTrip = useFleetStore
          .getState()
          .trips.find((t) => t.id === activeTripId);
        if (!latestTrip || latestTrip.status !== "active") return;

        if (nextIndex >= SIM_ROUTE.length) {
          window.clearInterval(timer);
          endTrip();
          onAutoCompleteRef.current?.();
          return;
        }

        const pt = SIM_ROUTE[nextIndex];
        addPoint(pt.lat, pt.lng, Date.now());
        nextIndex += 1;
      }, 1000);

      return () => {
        window.clearInterval(timer);
      };
    }

    // Real browser Geolocation API
    if (typeof window === "undefined") return;

    if (!window.isSecureContext) {
      const id = window.setTimeout(() => {
        setGpsError(
          "Live GPS requires HTTPS or localhost. Switch to Simulate GPS to test on an insecure origin."
        );
      }, 0);
      return () => window.clearTimeout(id);
    }

    if (!("geolocation" in navigator)) {
      const id = window.setTimeout(() => {
        setGpsError(
          "Geolocation is not supported by this browser. Switch to Simulate GPS instead."
        );
      }, 0);
      return () => window.clearTimeout(id);
    }

    const clearId = window.setTimeout(() => setGpsError(null), 0);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsError(null);
        addPoint(
          position.coords.latitude,
          position.coords.longitude,
          position.timestamp || Date.now()
        );
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError(
              "Location permission was denied. Allow location access in your browser settings or enable Simulate GPS."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError(
              "Location information is currently unavailable. Move outdoors or use Simulate GPS."
            );
            break;
          case error.TIMEOUT:
            setGpsError(
              "Location request timed out. Waiting for a GPS signal..."
            );
            break;
          default:
            setGpsError("Unable to read GPS location.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );

    return () => {
      window.clearTimeout(clearId);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, activeTripId, source, addPoint, endTrip]);

  return {
    gpsError: source === "gps" ? gpsError : null,
    wakeLockActive,
  };
}
