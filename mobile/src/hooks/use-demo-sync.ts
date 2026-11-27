import { useCallback, useEffect, useRef, useState } from "react";
import { useFleetStore } from "@/store/fleet-store";
import type { FleetAlert, Trip, TripBooking, Vehicle } from "@/types";

const SYNC_URL =
  process.env.EXPO_PUBLIC_SYNC_URL ?? "http://localhost:3000/api/demo-sync";

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

let globalSyncEnabled = false;
const listeners = new Set<() => void>();

export function setMobileDemoSyncEnabled(next: boolean) {
  globalSyncEnabled = next;
  listeners.forEach((fn) => fn());
}

export function getMobileDemoSyncEnabled(): boolean {
  return globalSyncEnabled;
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

export function useMobileDemoSync() {
  const [enabled, setEnabled] = useState<boolean>(globalSyncEnabled);
  const [status, setStatus] = useState<"idle" | "connected" | "offline">("idle");

  useEffect(() => {
    const onChange = () => setEnabled(globalSyncEnabled);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const toggleEnabled = useCallback(() => {
    const next = !globalSyncEnabled;
    setMobileDemoSyncEnabled(next);
    if (!next) setStatus("idle");
  }, []);

  const versionRef = useRef(0);
  const lastFingerprintRef = useRef("");
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    lastFingerprintRef.current = buildSnapshotFingerprint();

    const pushLocalSnapshot = async () => {
      if (cancelled) return;
      const s = useFleetStore.getState();
      try {
        const res = await fetch(SYNC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "mobile",
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
        const res = await fetch(SYNC_URL);
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
                    odometerKm: Math.max(
                      v.odometerKm,
                      patch.odometerKm ?? v.odometerKm
                    ),
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

  return { enabled, status, toggleEnabled, syncUrl: SYNC_URL };
}
