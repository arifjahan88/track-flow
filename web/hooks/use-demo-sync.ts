"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFleetStore } from "@/store/fleet-store";
import type { FleetAlert, Trip, TripBooking, Vehicle } from "@/types";

const STORAGE_KEY = "tf-demo-sync-enabled";

interface RemoteSyncPayload {
  version: number;
  updatedAt: number;
  source: string;
  snapshot: {
    bookings: TripBooking[];
    trips: Trip[];
    vehicles: Array<
      Pick<Vehicle, "id" | "status" | "odometerKm" | "fuelLevelPercent">
    >;
    alerts: FleetAlert[];
  } | null;
}

function buildSnapshotFingerprint(): string {
  const s = useFleetStore.getState();
  return JSON.stringify({
    bookings: s.bookings.map((b) => [
      b.id,
      b.status,
      b.driverId,
      b.vehicleId,
      b.rating,
      b.tripId,
    ]),
    trips: s.trips.map((t) => [
      t.id,
      t.status,
      t.waypoints?.map((w) => w.arrivedAt ?? ""),
    ]),
    vehicles: s.vehicles.map((v) => [v.id, v.status]),
    alertsLen: s.alerts.length,
    firstAlert: s.alerts[0]?.id ?? "",
  });
}

export function useDemoSync() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [status, setStatus] = useState<"idle" | "connected" | "offline">("idle");

  const versionRef = useRef(0);
  const lastFingerprintRef = useRef("");
  const applyingRemoteRef = useRef(false);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      if (!next) setStatus("idle");
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    lastFingerprintRef.current = buildSnapshotFingerprint();

    const pushLocalSnapshot = async () => {
      if (cancelled) return;
      const s = useFleetStore.getState();
      try {
        const res = await fetch("/api/demo-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "web",
            snapshot: {
              bookings: s.bookings,
              trips: s.trips,
              vehicles: s.vehicles.map((v) => ({
                id: v.id,
                status: v.status,
                odometerKm: v.odometerKm,
                fuelLevelPercent: v.fuelLevelPercent,
              })),
              alerts: s.alerts,
            },
          }),
        });
        if (!res.ok) throw new Error("Sync push failed");
        const data = (await res.json()) as { version?: number };
        if (typeof data.version === "number") {
          versionRef.current = data.version;
        }
        if (!cancelled) setStatus("connected");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    const pullRemoteSnapshot = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/demo-sync", { cache: "no-store" });
        if (!res.ok) throw new Error("Sync pull failed");
        const data = (await res.json()) as RemoteSyncPayload;
        if (!cancelled) setStatus("connected");

        if (!data.snapshot) {
          await pushLocalSnapshot();
          return;
        }
        if (data.version > versionRef.current) {
          versionRef.current = data.version;
          applyingRemoteRef.current = true;
          const vehMap = new Map(
            (data.snapshot.vehicles ?? []).map((v) => [v.id, v])
          );
          useFleetStore.setState((state) => ({
            bookings: data.snapshot!.bookings,
            trips: data.snapshot!.trips,
            alerts: data.snapshot!.alerts,
            vehicles: state.vehicles.map((v) => {
              const patch = vehMap.get(v.id);
              return patch
                ? {
                    ...v,
                    status: patch.status ?? v.status,
                    odometerKm: Math.max(v.odometerKm, patch.odometerKm ?? v.odometerKm),
                  }
                : v;
            }),
          }));
          lastFingerprintRef.current = buildSnapshotFingerprint();
          applyingRemoteRef.current = false;
        }
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };

    void pullRemoteSnapshot();

    const unsub = useFleetStore.subscribe(() => {
      if (applyingRemoteRef.current) return;
      const fp = buildSnapshotFingerprint();
      if (fp === lastFingerprintRef.current) return;
      lastFingerprintRef.current = fp;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        void pushLocalSnapshot();
      }, 350);
    });

    const interval = setInterval(() => {
      void pullRemoteSnapshot();
    }, 2000);

    return () => {
      cancelled = true;
      unsub();
      clearInterval(interval);
      if (pushTimer) clearTimeout(pushTimer);
    };
  }, [enabled]);

  return { enabled, status, toggleEnabled };
}
