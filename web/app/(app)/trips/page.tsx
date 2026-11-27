"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Printer, Radar, Route } from "lucide-react";
import { toast } from "sonner";
import { RoutePlayback } from "@/components/route-playback";
import { BookingsPanel } from "@/components/trips/bookings-panel";
import { GeofencesPanel } from "@/components/trips/geofences-panel";
import {
  LiveVectorMap,
  type GeofenceBannerEvent,
} from "@/components/trips/live-vector-map";
import { ObdDiagnosticsStrip } from "@/components/trips/obd-diagnostics-strip";
import { TelemetryInspector } from "@/components/trips/telemetry-inspector";
import { TripChecklistDialog } from "@/components/trips/trip-checklist-dialog";
import { TripHistoryTable } from "@/components/trips/trip-history-table";
import { WaypointPodDialog } from "@/components/trips/waypoint-pod-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { getRouteById } from "@/lib/city-routes";
import {
  interpolateRoutePosition,
  isPointInsideVectorGeofence,
  lerpAngle,
} from "@/lib/geo-sim";
import { formatDateTime } from "@/lib/format";
import { openPrintableTripManifest } from "@/lib/trip-manifest-print";
import { can } from "@/lib/rbac";
import {
  getScopedBookings,
  getScopedTrips,
  getScopedVehicles,
} from "@/lib/rbac-scope";
import type {
  LiveVehicleFrame,
  SimulationTickUpdate,
  Trip,
  TripBooking,
  TripChecklist,
  TripWaypoint,
} from "@/types";

interface MutableSimEntry {
  progress: number;
  headingDeg: number;
  speedKmh: number;
  phaseOffset: number;
  accumulatedDistKm: number;
  accumulatedFuelPct: number;
  insideGeofences: Set<string>;
}

function TripsTrackingContent() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const queryVehicleId = searchParams.get("vehicle");
  const queryTab = searchParams.get("tab");

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "super_admin";
  const canManageGeofences = can(activeRole, "geofences:write");
  const canOperateTrips = can(activeRole, "trips:operate");

  const allVehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const allTrips = useFleetStore((s) => s.trips);
  const allBookings = useFleetStore((s) => s.bookings);
  const geofences = useFleetStore((s) => s.geofences);
  const vectorGeofences = useFleetStore((s) => s.vectorGeofences);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const isSimulating = useFleetStore((s) => s.isSimulating);
  const simSpeedMultiplier = useFleetStore((s) => s.simSpeedMultiplier);

  const vehicles = useMemo(
    () =>
      getScopedVehicles(
        currentUser,
        drivers,
        allVehicles,
        allBookings,
        allTrips
      ),
    [currentUser, drivers, allVehicles, allBookings, allTrips]
  );
  const trips = useMemo(
    () => getScopedTrips(currentUser, drivers, allTrips, allBookings),
    [currentUser, drivers, allTrips, allBookings]
  );
  const bookings = useMemo(
    () => getScopedBookings(currentUser, drivers, allBookings),
    [currentUser, drivers, allBookings]
  );

  const setSelectedVehicle = useFleetStore((s) => s.setSelectedVehicle);
  const setIsSimulating = useFleetStore((s) => s.setIsSimulating);
  const setSimSpeedMultiplier = useFleetStore((s) => s.setSimSpeedMultiplier);
  const toggleVectorGeofence = useFleetStore((s) => s.toggleVectorGeofence);
  const startTripForVehicle = useFleetStore((s) => s.startTripForVehicle);
  const startAssignedBooking = useFleetStore((s) => s.startAssignedBooking);
  const endActiveTripForVehicle = useFleetStore(
    (s) => s.endActiveTripForVehicle
  );
  const applySimulationTick = useFleetStore((s) => s.applySimulationTick);
  const addFleetAlert = useFleetStore((s) => s.addFleetAlert);
  const completeWaypointPod = useFleetStore((s) => s.completeWaypointPod);

  const [activeTab, setActiveTab] = useState<string>(
    queryTab === "bookings" || queryTab === "geofences" ? queryTab : "bookings"
  );
  const [podWaypoint, setPodWaypoint] = useState<TripWaypoint | null>(null);
  const [frames, setFrames] = useState<Record<string, LiveVehicleFrame>>({});
  const [activeBanner, setActiveBanner] = useState<GeofenceBannerEvent | null>(
    null
  );
  const [selectedHistoryTrip, setSelectedHistoryTrip] = useState<Trip | null>(
    null
  );
  const [checklistState, setChecklistState] = useState<{
    phase: "pre" | "post";
    vehicleId: string;
    bookingId?: string;
    purpose?: string;
  } | null>(null);

  const vehiclesRef = useRef(vehicles);
  const geofencesRef = useRef(vectorGeofences);
  const isSimulatingRef = useRef(isSimulating);
  const simSpeedRef = useRef(simSpeedMultiplier);
  const simMapRef = useRef<Map<string, MutableSimEntry>>(new Map());
  const bannerTimerRef = useRef<number | null>(null);

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

  // Honor ?vehicle=<id> query parameter from Vehicles / Dashboard "Live Track" links
  useEffect(() => {
    if (queryVehicleId && vehicles.some((v) => v.id === queryVehicleId)) {
      setSelectedVehicle(queryVehicleId);
    }
  }, [queryVehicleId, vehicles, setSelectedVehicle]);

  const effectiveSelectedId = useMemo(() => {
    if (vehicles.some((v) => v.id === selectedVehicleId)) {
      return selectedVehicleId;
    }
    return vehicles[0]?.id ?? "";
  }, [vehicles, selectedVehicleId]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === effectiveSelectedId),
    [vehicles, effectiveSelectedId]
  );

  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "done"),
    [trips]
  );

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const showGeofenceBanner = useCallback((event: GeofenceBannerEvent) => {
    setActiveBanner(event);
    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setActiveBanner(null);
    }, 4800);
  }, []);

  // Real-time simulation loop with 1.2s Zustand commit throttling
  useEffect(() => {
    if (!hydrated) return;

    let rafId = 0;
    let lastTs = performance.now();
    let lastCommitTs = performance.now();

    const step = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const currentVehicles = vehiclesRef.current;
      const currentGeofences = geofencesRef.current;
      const running = isSimulatingRef.current;
      const speedMult = simSpeedRef.current;

      const nextFrames: Record<string, LiveVehicleFrame> = {};

      for (let idx = 0; idx < currentVehicles.length; idx++) {
        const v = currentVehicles[idx];
        const route = getRouteById(v.routeId);
        let entry = simMapRef.current.get(v.id);

        if (!entry) {
          const initialPos = interpolateRoutePosition(
            route.waypoints,
            v.routeProgress ?? 0
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

        const pos = interpolateRoutePosition(route.waypoints, entry.progress);
        entry.headingDeg = lerpAngle(entry.headingDeg, pos.headingDeg, 0.14);

        // Geofence entry detection
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
                message: `${v.name} (${v.plate}) crossed into ${zone.name} at ${speedLabel} km/h.`,
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
              toast.info(`${v.name} entered ${zone.name}`, {
                description: `${v.plate} · ${speedLabel} km/h`,
              });
            } else if (!isInside && wasInside) {
              entry.insideGeofences.delete(zone.id);
            }
          }
        }

        nextFrames[v.id] = {
          vehicleId: v.id,
          x: pos.x,
          y: pos.y,
          latitude: pos.latitude,
          longitude: pos.longitude,
          headingDeg: entry.headingDeg,
          speedKmh: entry.speedKmh,
          routeProgress: entry.progress,
          coveredPoints: pos.coveredPoints,
          remainingPoints: pos.remainingPoints,
        };
      }

      setFrames(nextFrames);

      // Throttled Zustand persistence every 1.2s
      if (now - lastCommitTs >= 1200 && running) {
        lastCommitTs = now;
        const updates: SimulationTickUpdate[] = [];
        const commitNow = Date.now();

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
            timestamp: commitNow,
          });
          entry.accumulatedDistKm = 0;
          entry.accumulatedFuelPct = 0;
        }

        if (updates.length > 0) {
          applySimulationTick(updates);
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, [hydrated, applySimulationTick, addFleetAlert, showGeofenceBanner]);

  const handleStartTrip = (vehicleId: string) => {
    const res = startTripForVehicle(vehicleId);
    if (!res.ok) {
      toast.error(res.error ?? "Could not start live trip.");
      return;
    }
    const v = vehiclesById.get(vehicleId);
    toast.success(`Live corridor trip started for ${v?.name ?? "vehicle"}.`);
  };

  const handleEndTrip = (vehicleId: string) => {
    setChecklistState({ phase: "post", vehicleId });
  };

  const handleStartBooking = (booking: TripBooking) => {
    const targetVehId = booking.vehicleId ?? effectiveSelectedId;
    if (!targetVehId) {
      toast.error("Admin must assign a vehicle before starting this trip.");
      return;
    }
    setChecklistState({
      phase: "pre",
      vehicleId: targetVehId,
      bookingId: booking.id,
      purpose: booking.purpose,
    });
  };

  const handleFinishBooking = (booking: TripBooking) => {
    const targetVehId = booking.vehicleId ?? effectiveSelectedId;
    if (!targetVehId) return;
    setChecklistState({
      phase: "post",
      vehicleId: targetVehId,
      bookingId: booking.id,
    });
  };

  const handleChecklistConfirm = (checklist: TripChecklist) => {
    if (!checklistState) return;
    const { phase, vehicleId, bookingId, purpose } = checklistState;
    setChecklistState(null);

    if (phase === "pre") {
      const res = bookingId
        ? startAssignedBooking(bookingId, checklist)
        : startTripForVehicle(vehicleId, undefined, purpose, {
            preTripChecklist: checklist,
          });
      if (!res.ok) {
        toast.error(res.error ?? "Unable to start trip.");
        return;
      }
      toast.success("Pre-trip walkaround passed. Live trip started!");
    } else {
      endActiveTripForVehicle(vehicleId, checklist);
      toast.success("Post-trip inspection saved. Trip completed!");
    }
  };

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-12">
          <Skeleton className="h-[600px] rounded-2xl xl:col-span-8" />
          <Skeleton className="h-[600px] rounded-2xl xl:col-span-4" />
        </div>
      </div>
    );
  }

  const selectedActiveTrip = trips.find(
    (t) => t.vehicleId === effectiveSelectedId && t.status === "active"
  );

  const effectiveTab =
    !canManageGeofences && activeTab === "geofences" ? "bookings" : activeTab;

  return (
    <div className="space-y-6">
      {/* Main Live Vector Map + Telemetry Inspector (Strictly Role-Scoped) */}
      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-cyan-500/35 bg-cyan-500/6 p-6 text-center">
          <p className="text-base font-bold text-foreground">
            {activeRole === "employee"
              ? "No Active Ride to Track Yet"
              : "No Assigned Vehicles Active"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeRole === "employee"
              ? "Once Admin assigns a driver to your trip request and the driver starts the trip, live GPS tracking for your ride will appear here."
              : "Vehicles assigned to your account or active trips will appear on your live map."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="flex flex-col gap-3 xl:col-span-8">
            <div className="h-[520px] lg:h-[600px]">
              <LiveVectorMap
                vehicles={vehicles}
                frames={frames}
                geofences={canManageGeofences ? vectorGeofences : []}
                selectedVehicleId={effectiveSelectedId}
                initialFollowCamera={Boolean(queryVehicleId)}
                onSelectVehicle={setSelectedVehicle}
                onToggleGeofence={toggleVectorGeofence}
                isSimulating={isSimulating}
                onToggleSimulating={() => setIsSimulating(!isSimulating)}
                simSpeedMultiplier={simSpeedMultiplier}
                onChangeSimSpeed={setSimSpeedMultiplier}
                activeBanner={activeBanner}
              />
            </div>

            {canOperateTrips ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <ObdDiagnosticsStrip
                  ignitionOn={selectedVehicle?.status === "on_trip"}
                  distanceKm={selectedActiveTrip?.distanceKm ?? 0}
                />
              </div>
            ) : null}
          </div>

          <div className="xl:col-span-4 xl:h-[668px]">
            <TelemetryInspector
              vehicles={vehicles}
              drivers={drivers}
              selectedVehicle={selectedVehicle}
              frame={frames[effectiveSelectedId]}
              frames={frames}
              canOperate={canOperateTrips}
              pendingWaypoint={selectedActiveTrip?.waypoints?.find(
                (wp) => !wp.arrivedAt
              )}
              onCapturePod={(wp) => setPodWaypoint(wp)}
              onSelectVehicle={setSelectedVehicle}
              onStartTrip={handleStartTrip}
              onEndTrip={handleEndTrip}
            />
          </div>
        </div>
      )}

      {/* Bottom Operations Tabs: Scoped to Active Role */}
      <Tabs
        value={effectiveTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList
          className={`grid w-full rounded-xl sm:max-w-xl ${
            canManageGeofences ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <TabsTrigger value="bookings" className="rounded-lg">
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            {activeRole === "driver"
              ? `Assigned Trips (${bookings.length})`
              : activeRole === "employee"
                ? `My Requests (${bookings.length})`
                : `Trip Requests (${bookings.length})`}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <Route className="mr-1.5 h-3.5 w-3.5" />
            {activeRole === "driver" || activeRole === "employee"
              ? `My History (${completedTrips.length})`
              : `Trip History (${completedTrips.length})`}
          </TabsTrigger>
          {canManageGeofences ? (
            <TabsTrigger value="geofences" className="rounded-lg">
              <Radar className="mr-1.5 h-3.5 w-3.5" />
              Geofences ({geofences.length})
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="bookings">
          <BookingsPanel
            onStartBooking={handleStartBooking}
            onFinishBooking={handleFinishBooking}
            onTrackVehicle={(vehId) => {
              setSelectedVehicle(vehId);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onViewCompletedTrip={(tripId) => {
              const found = trips.find((t) => t.id === tripId);
              if (found) setSelectedHistoryTrip(found);
              else toast.info("Trip telemetry preview unavailable.");
            }}
          />
        </TabsContent>

        <TabsContent value="history">
          <TripHistoryTable
            completedTrips={completedTrips}
            vehicles={vehicles}
            drivers={drivers}
            onSelectTrip={setSelectedHistoryTrip}
          />
        </TabsContent>

        {canManageGeofences ? (
          <TabsContent value="geofences">
            <GeofencesPanel />
          </TabsContent>
        ) : null}
      </Tabs>

      {/* Pre/Post-Trip Inspection Checklist Dialog */}
      <TripChecklistDialog
        open={checklistState !== null}
        phase={checklistState?.phase ?? "post"}
        onOpenChange={(open) => {
          if (!open) setChecklistState(null);
        }}
        onConfirm={handleChecklistConfirm}
      />

      {/* Proof of Delivery (POD) Digital Signature Dialog */}
      <WaypointPodDialog
        waypoint={podWaypoint}
        onOpenChange={(open) => {
          if (!open) setPodWaypoint(null);
        }}
        onSavePod={(waypointId, pod) => {
          completeWaypointPod(waypointId, pod);
          toast.success(
            `POD captured and signed by ${pod.recipientName}. Stop marked delivered!`
          );
        }}
      />

      {/* Interactive Trip Route Playback Modal */}
      <Dialog
        open={selectedHistoryTrip !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedHistoryTrip(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-3xl">
          {selectedHistoryTrip ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle>{selectedHistoryTrip.purpose}</DialogTitle>
                    <DialogDescription>
                      {vehiclesById.get(selectedHistoryTrip.vehicleId)?.name ??
                        "Unknown vehicle"}{" "}
                      · {formatDateTime(selectedHistoryTrip.startedAt)}
                      {selectedHistoryTrip.driverId
                        ? ` · Driver: ${driversById.get(selectedHistoryTrip.driverId)?.name ?? "Unknown"}`
                        : ""}
                    </DialogDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ok = openPrintableTripManifest(
                        selectedHistoryTrip,
                        vehiclesById.get(selectedHistoryTrip.vehicleId),
                        selectedHistoryTrip.driverId
                          ? driversById.get(selectedHistoryTrip.driverId)
                          : undefined
                      );
                      if (!ok) {
                        toast.error("Allow popups to open the printable PDF manifest.");
                      }
                    }}
                    className="gap-1.5 rounded-xl"
                  >
                    <Printer className="size-3.5 text-primary" />
                    Print / PDF Manifest
                  </Button>
                </div>
              </DialogHeader>

              <RoutePlayback
                key={selectedHistoryTrip.id}
                trip={selectedHistoryTrip}
                geofences={geofences}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-5 xl:grid-cols-12">
          <Skeleton className="h-[600px] rounded-2xl xl:col-span-8" />
          <Skeleton className="h-[600px] rounded-2xl xl:col-span-4" />
        </div>
      }
    >
      <TripsTrackingContent />
    </Suspense>
  );
}
