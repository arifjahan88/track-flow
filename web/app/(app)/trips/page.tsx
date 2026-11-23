"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  BatteryCharging,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Cpu,
  Flag,
  Fuel,
  GitMerge,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  Power,
  Radar,
  Radio,
  RotateCcw,
  Route,
  Search,
  Square,
  Thermometer,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActiveWaypointTelemetry,
  RouteMap,
} from "@/components/route-map";
import { RoutePlayback } from "@/components/route-playback";
import { TablePagination, usePagination } from "@/components/table-pagination";
import {
  BookingsPanel,
  GeofencesPanel,
  TripChecklistDialog,
  WaypointPodDialog,
} from "@/components/trip-operations-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTripTracker } from "@/hooks/use-trip-tracker";
import { checkDriverAvailability } from "@/lib/drivers";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
  toIsoDate,
} from "@/lib/format";
import {
  computeBearingDegrees,
  formatCardinalDirection,
  haversineKm,
  PLANNED_ROUTE_TOTAL_KM,
  ROUTE_WAYPOINTS,
  SIM_ROUTE,
  type RouteWaypoint,
} from "@/lib/geo";
import type { Trip, TripBooking, TripChecklist, TripWaypoint } from "@/types";

const NO_DRIVER_VALUE = "__none__";
const ALL_VEHICLES = "__all__";
const ALL_DRIVERS = "__all_drivers__";

const PURPOSE_PRESETS = [
  "Client delivery",
  "Airport transfer",
  "Depot shuttle",
  "Express freight",
] as const;

function ManeuverIcon({
  maneuver,
  className = "h-5 w-5",
}: {
  maneuver: RouteWaypoint["maneuver"];
  className?: string;
}) {
  switch (maneuver) {
    case "right":
      return <CornerUpRight className={className} />;
    case "left":
      return <CornerUpLeft className={className} />;
    case "merge":
      return <GitMerge className={className} />;
    case "arrive":
      return <Flag className={className} />;
    case "depart":
    case "straight":
    default:
      return <ArrowUp className={className} />;
  }
}

export default function TripsPage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const bookings = useFleetStore((s) => s.bookings);
  const geofences = useFleetStore((s) => s.geofences);
  const geofenceAlerts = useFleetStore((s) => s.geofenceAlerts);
  const activeTripId = useFleetStore((s) => s.activeTripId);

  const startTrip = useFleetStore((s) => s.startTrip);
  const pauseTrip = useFleetStore((s) => s.pauseTrip);
  const resumeTrip = useFleetStore((s) => s.resumeTrip);
  const endTrip = useFleetStore((s) => s.endTrip);
  const addActiveTripWaypoint = useFleetStore((s) => s.addActiveTripWaypoint);
  const completeWaypointPod = useFleetStore((s) => s.completeWaypointPod);

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState(NO_DRIVER_VALUE);
  const [purpose, setPurpose] = useState("Client delivery");
  const [simulateGps, setSimulateGps] = useState(true);
  const [nowMs, setNowMs] = useState(0);
  const [selectedHistoryTrip, setSelectedHistoryTrip] = useState<Trip | null>(
    null
  );
  const [checklistPhase, setChecklistPhase] = useState<"pre" | "post" | null>(
    null
  );
  const [pendingBookingId, setPendingBookingId] = useState<string | undefined>(
    undefined
  );
  const [newStopLabel, setNewStopLabel] = useState("");
  const [podWaypoint, setPodWaypoint] = useState<TripWaypoint | null>(null);
  const lastAlertIdRef = useRef<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState(ALL_VEHICLES);
  const [historyDriverFilter, setHistoryDriverFilter] = useState(ALL_DRIVERS);
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");

  const effectiveVehicleId = selectedVehicleId || vehicles[0]?.id || "";

  const activeTrip = useMemo(
    () =>
      trips.find((t) => t.id === activeTripId && t.status !== "done") ?? null,
    [trips, activeTripId]
  );

  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "done"),
    [trips]
  );

  const handleAutoComplete = useCallback(() => {
    toast.success("Route destination reached. Trip logged to fleet history.");
  }, []);

  const { gpsError, wakeLockActive } = useTripTracker({
    activeTrip,
    source: simulateGps ? "simulate" : "gps",
    onAutoComplete: handleAutoComplete,
  });

  // Notify live when a new geofence alert fires
  useEffect(() => {
    const latest = geofenceAlerts[0];
    if (!latest) return;
    if (lastAlertIdRef.current && lastAlertIdRef.current !== latest.id) {
      toast.warning(
        `Geofence alert: ${latest.eventType.replaceAll("_", " ")} "${latest.zoneName}"`
      );
    }
    lastAlertIdRef.current = latest.id;
  }, [geofenceAlerts]);

  // Live 1-second clock for active trip duration display
  useEffect(() => {
    if (!activeTrip) return;
    const sync = () => setNowMs(Date.now());
    const init = window.setTimeout(sync, 0);
    const interval = window.setInterval(sync, 1000);
    return () => {
      window.clearTimeout(init);
      window.clearInterval(interval);
    };
  }, [activeTrip]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  const vehicleFilterItems = useMemo(
    () => ({ [ALL_VEHICLES]: "All vehicles", ...vehicleSelectItems }),
    [vehicleSelectItems]
  );

  const dispatchDriverItems = useMemo(() => {
    const items: Record<string, string> = { [NO_DRIVER_VALUE]: "Unassigned" };
    for (const d of drivers) {
      items[d.id] = d.name;
    }
    return items;
  }, [drivers]);

  const driverFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_DRIVERS]: "All drivers" };
    for (const d of drivers) {
      items[d.id] = d.name;
    }
    return items;
  }, [drivers]);

  const filteredCompletedTrips = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return completedTrips.filter((trip) => {
      if (
        historyVehicleFilter !== ALL_VEHICLES &&
        trip.vehicleId !== historyVehicleFilter
      ) {
        return false;
      }
      if (
        historyDriverFilter !== ALL_DRIVERS &&
        trip.driverId !== historyDriverFilter
      ) {
        return false;
      }
      const tripDay = trip.startedAt.slice(0, 10);
      if (historyFromDate && tripDay < historyFromDate) return false;
      if (historyToDate && tripDay > historyToDate) return false;
      if (q) {
        const vehicle = vehiclesById.get(trip.vehicleId);
        const driver = trip.driverId ? driversById.get(trip.driverId) : undefined;
        const hay = `${trip.purpose} ${vehicle?.name ?? ""} ${vehicle?.plate ?? ""} ${driver?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    completedTrips,
    historyVehicleFilter,
    historyDriverFilter,
    historyFromDate,
    historyToDate,
    historySearch,
    vehiclesById,
    driversById,
  ]);

  const historyPagination = usePagination(filteredCompletedTrips, 10);

  const hasHistoryFilters =
    historySearch.trim() !== "" ||
    historyVehicleFilter !== ALL_VEHICLES ||
    historyDriverFilter !== ALL_DRIVERS ||
    historyFromDate !== "" ||
    historyToDate !== "";

  const clearHistoryFilters = () => {
    setHistorySearch("");
    setHistoryVehicleFilter(ALL_VEHICLES);
    setHistoryDriverFilter(ALL_DRIVERS);
    setHistoryFromDate("");
    setHistoryToDate("");
    historyPagination.setPage(1);
  };

  // Live speed computed from last 2 points (capped at 160 km/h)
  const liveSpeedKmh = useMemo(() => {
    if (!activeTrip || activeTrip.status !== "active") return 0;
    const pts = activeTrip.points;
    if (pts.length < 2) return 0;
    const prev = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    const deltaHours = (curr.t - prev.t) / 3_600_000;
    if (deltaHours <= 0) return 0;
    return Math.min(160, haversineKm(prev, curr) / deltaHours);
  }, [activeTrip]);

  // Live compass heading in degrees
  const liveHeadingDeg = useMemo(() => {
    const pts = activeTrip?.points ?? [];
    if (pts.length >= 2) {
      return computeBearingDegrees(pts[pts.length - 2], pts[pts.length - 1]);
    }
    return computeBearingDegrees(ROUTE_WAYPOINTS[0], ROUTE_WAYPOINTS[1]);
  }, [activeTrip]);

  const latestPoint =
    activeTrip && activeTrip.points.length > 0
      ? activeTrip.points[activeTrip.points.length - 1]
      : null;

  // Turn-by-turn waypoint telemetry
  const navTelemetry = useMemo(() => {
    if (simulateGps && activeTrip) {
      // Determine exact segment index from simulator point count
      const ptCount = activeTrip.points.length;
      const segIdx = Math.min(
        ROUTE_WAYPOINTS.length - 1,
        Math.floor(ptCount / 60) + 1
      );
      const currentWp = ROUTE_WAYPOINTS[Math.max(0, segIdx - 1)];
      const nextWp = ROUTE_WAYPOINTS[segIdx];
      const distKm = latestPoint
        ? haversineKm(latestPoint, nextWp)
        : haversineKm(currentWp, nextWp);
      const progressPct = Math.min(
        100,
        Math.round((ptCount / SIM_ROUTE.length) * 100)
      );
      const remainingKm = Math.max(
        0,
        PLANNED_ROUTE_TOTAL_KM - activeTrip.distanceKm
      );
      return {
        currentWaypoint: currentWp,
        nextWaypoint: nextWp,
        nextWaypointIndex: segIdx,
        distanceToNextKm: distKm,
        progressPct,
        remainingKm,
      };
    }

    const base = getActiveWaypointTelemetry(latestPoint);
    const progressPct = activeTrip
      ? Math.min(
          99,
          Math.round((activeTrip.distanceKm / PLANNED_ROUTE_TOTAL_KM) * 100)
        )
      : 0;
    const remainingKm = Math.max(
      0,
      PLANNED_ROUTE_TOTAL_KM - (activeTrip?.distanceKm ?? 0)
    );
    return {
      ...base,
      progressPct,
      remainingKm,
    };
  }, [activeTrip, latestPoint, simulateGps]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72 rounded-xl" />
        <div className="grid gap-6 xl:grid-cols-12">
          <Skeleton className="h-[580px] rounded-2xl xl:col-span-8" />
          <Skeleton className="h-[580px] rounded-2xl xl:col-span-4" />
        </div>
      </div>
    );
  }

  const activeDurationMs = activeTrip
    ? Math.max(0, nowMs - new Date(activeTrip.startedAt).getTime())
    : 0;

  const activeVehicle = activeTrip
    ? vehiclesById.get(activeTrip.vehicleId)
    : vehiclesById.get(effectiveVehicleId);

  const activeDriver =
    activeTrip && activeTrip.driverId
      ? driversById.get(activeTrip.driverId)
      : selectedDriverId !== NO_DRIVER_VALUE
        ? driversById.get(selectedDriverId)
        : undefined;

  const etaMinutes =
    liveSpeedKmh > 5
      ? Math.max(1, Math.round((navTelemetry.remainingKm / liveSpeedKmh) * 60))
      : Math.max(1, Math.round((navTelemetry.remainingKm / 38) * 60));

  const distanceToNextLabel =
    navTelemetry.distanceToNextKm < 1
      ? `${Math.max(10, Math.round(navTelemetry.distanceToNextKm * 1000))} m`
      : `${navTelemetry.distanceToNextKm.toFixed(1)} km`;

  const speedLimit = navTelemetry.currentWaypoint.speedLimitKmh;
  const isOverSpeed = liveSpeedKmh > speedLimit;

  const handleVehicleChange = (nextVehicleId: string | null) => {
    if (!nextVehicleId) return;
    setSelectedVehicleId(nextVehicleId);
    const assignedDriver = drivers.find(
      (d) => d.assignedVehicleId === nextVehicleId
    );
    setSelectedDriverId(assignedDriver ? assignedDriver.id : NO_DRIVER_VALUE);
  };

  const handleStartTrip = () => {
    if (!effectiveVehicleId) {
      toast.error("Add a vehicle before starting navigation.");
      return;
    }
    if (selectedDriverId !== NO_DRIVER_VALUE) {
      const drv = driversById.get(selectedDriverId);
      if (drv) {
        const avail = checkDriverAvailability(drv, toIsoDate(), trips);
        if (!avail.available) {
          toast.error(`Driver shift/leave conflict: ${avail.reason}`);
          return;
        }
      }
    }
    setPendingBookingId(undefined);
    setChecklistPhase("pre");
  };

  const handleDispatchBooking = (booking: TripBooking) => {
    if (activeTrip) {
      toast.error("Finish the active trip before dispatching a new booking.");
      return;
    }
    if (booking.vehicleId) setSelectedVehicleId(booking.vehicleId);
    setSelectedDriverId(booking.driverId ?? NO_DRIVER_VALUE);
    setPurpose(booking.purpose);
    setPendingBookingId(booking.id);
    setChecklistPhase("pre");
  };

  const handleChecklistConfirm = (checklist: TripChecklist) => {
    setChecklistPhase(null);
    if (checklist.phase === "pre") {
      const driverId =
        selectedDriverId === NO_DRIVER_VALUE ? undefined : selectedDriverId;
      const res = startTrip(effectiveVehicleId, purpose, driverId, {
        bookingId: pendingBookingId,
        preTripChecklist: checklist,
        waypoints: [
          {
            id: `wp-init-1`,
            label: ROUTE_WAYPOINTS[3].name,
            address: ROUTE_WAYPOINTS[3].corridor,
            lat: ROUTE_WAYPOINTS[3].lat,
            lng: ROUTE_WAYPOINTS[3].lng,
          },
          {
            id: `wp-init-2`,
            label: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].name,
            address: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].corridor,
            lat: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].lat,
            lng: ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].lng,
          },
        ],
      });
      if (!res.ok) {
        toast.error(res.error ?? "Unable to start trip.");
        return;
      }
      setNowMs(Date.now());
      setPendingBookingId(undefined);
      const vehicle = vehiclesById.get(effectiveVehicleId);
      toast.success(
        `Pre-trip inspection passed. Live navigation started for ${vehicle?.name ?? "vehicle"}.`
      );
    } else {
      const distance = activeTrip?.distanceKm ?? 0;
      endTrip(checklist);
      toast.success(
        `Post-trip inspection saved. Added ${formatKm(distance)} km to odometer.`
      );
    }
  };

  const handlePause = () => {
    pauseTrip();
    toast.info("Navigation paused. Telemetry recording on hold.");
  };

  const handleResume = () => {
    resumeTrip();
    toast.success("Navigation resumed.");
  };

  const handleEnd = () => {
    setChecklistPhase("post");
  };

  const handleAddStop = () => {
    if (!newStopLabel.trim()) return;
    const refWp = ROUTE_WAYPOINTS[navTelemetry.nextWaypointIndex] ?? ROUTE_WAYPOINTS[0];
    addActiveTripWaypoint({
      label: newStopLabel.trim(),
      address: `${refWp.district}, Dhaka`,
      lat: refWp.lat,
      lng: refWp.lng,
    });
    setNewStopLabel("");
    toast.success("Waypoint added to active trip.");
  };

  // Simulated OBD-II diagnostics derived deterministically from live state
  const obdIgnitionOn = activeTrip?.status === "active";
  const obdBatteryVolts = obdIgnitionOn ? "14.1V" : "12.6V";
  const obdFuelPct = Math.max(
    18,
    Math.round(86 - (activeTrip?.distanceKm ?? 0) * 1.4)
  );
  const obdCoolantC = obdIgnitionOn ? 88 : 42;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="rounded-full border border-[#22d3ee]/30 bg-[#06b6d4]/15 text-[#22d3ee]">
              <Radio className="mr-1.5 h-3 w-3" />
              Real-Time GPS Navigator
            </Badge>
            {wakeLockActive ? (
              <Badge
                variant="outline"
                className="rounded-full text-[11px] text-muted-foreground"
              >
                <Zap className="mr-1 h-3 w-3 text-[#22d3ee]" />
                Wake lock active
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Live Fleet Maps &amp; Turn-by-Turn Navigator
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <span className="relative flex h-2.5 w-2.5">
              {activeTrip?.status === "active" ? (
                <span className="tf-live-pulse absolute inline-flex h-full w-full rounded-full bg-[#22d3ee]" />
              ) : null}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  activeTrip?.status === "active"
                    ? "bg-[#22d3ee]"
                    : activeTrip?.status === "paused"
                      ? "bg-[var(--brand-amber)]"
                      : "bg-muted-foreground"
                }`}
              />
            </span>
            <span className="font-medium text-foreground">
              {activeTrip?.status === "active"
                ? "TELEMETRY LIVE"
                : activeTrip?.status === "paused"
                  ? "NAVIGATION PAUSED"
                  : "STANDBY · READY"}
            </span>
            <span className="text-border">|</span>
            <span className="font-mono">
              {simulateGps ? "DHAKA SIM 1Hz" : "DEVICE GPS"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigator Cockpit Grid */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Interactive Map Cockpit (8 cols on XL) */}
        <Card className="relative overflow-hidden rounded-2xl border-border p-0 shadow-lg xl:col-span-8">
          <div className="relative h-[480px] w-full sm:h-[560px] lg:h-[600px]">
            <RouteMap
              points={activeTrip?.points ?? []}
              live={activeTrip?.status === "active"}
              showPlannedRoute={true}
              activeWaypointIndex={
                activeTrip ? navTelemetry.nextWaypointIndex : 0
              }
              headingDeg={liveHeadingDeg}
              geofences={geofences}
              className="h-full w-full rounded-none border-0"
            />

            {/* TOP-LEFT OVERLAY: Highway Turn-by-Turn Maneuver Sign */}
            <div className="absolute inset-x-3 top-3 z-20 sm:right-auto sm:top-3.5 sm:left-3.5 sm:max-w-md">
              <div className="overflow-hidden rounded-2xl border border-[#22d3ee]/40 bg-[#07131c]/92 text-[#e6f4fa] shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3.5 px-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <ManeuverIcon
                      maneuver={navTelemetry.nextWaypoint.maneuver}
                      className="h-6 w-6"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold tracking-tight text-[#22d3ee]">
                        {activeTrip ? `In ${distanceToNextLabel}` : "Route Ready"}
                      </span>
                      <span className="rounded-md bg-[#132a3d] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-[#38bdf8]">
                        {navTelemetry.nextWaypoint.district}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold text-white">
                      {navTelemetry.nextWaypoint.instruction}
                    </p>
                    <p className="truncate text-xs text-[#82a3b8]">
                      Next: {navTelemetry.nextWaypoint.name} ·{" "}
                      {navTelemetry.nextWaypoint.corridor}
                    </p>
                  </div>
                </div>

                {/* Progress Strip inside Turn-by-Turn Sign */}
                <div className="flex items-center justify-between border-t border-[#1b384f] bg-[#091722]/90 px-4 py-1.5 text-[11px] text-[#82a3b8]">
                  <span className="truncate">
                    Corridor:{" "}
                    <strong className="font-medium text-[#e6f4fa]">
                      {navTelemetry.currentWaypoint.corridor}
                    </strong>
                  </span>
                  <span className="ml-3 shrink-0 font-mono text-[#22d3ee]">
                    {navTelemetry.progressPct}% complete
                  </span>
                </div>
              </div>
            </div>

            {/* BOTTOM NAVIGATION TELEMETRY HUD DOCK */}
            <div className="absolute inset-x-3.5 bottom-3.5 z-20 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
              {/* Left: Speedometer + Road Speed Limit Sign */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#1b384f] bg-[#07131c]/92 px-4 py-3 text-[#e6f4fa] shadow-xl backdrop-blur-md">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#82a3b8]">
                    Speed
                  </p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span
                      className={`font-display text-3xl font-bold tracking-tight ${
                        isOverSpeed ? "text-[var(--brand-amber)]" : "text-white"
                      }`}
                    >
                      {formatSpeed(liveSpeedKmh)}
                    </span>
                    <span className="font-mono text-xs text-[#82a3b8]">
                      km/h
                    </span>
                  </div>
                </div>

                {/* Road Speed Limit Sign */}
                <div
                  title={`Corridor speed limit: ${speedLimit} km/h`}
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[#ff6b73] bg-white text-[#091a26] shadow-sm"
                >
                  <span className="text-[8px] font-bold uppercase leading-none text-[#466378]">
                    LIMIT
                  </span>
                  <span className="font-display text-sm font-extrabold leading-tight">
                    {speedLimit}
                  </span>
                </div>

                <div className="hidden border-l border-[#1b384f] pl-3 sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#82a3b8]">
                    Heading
                  </p>
                  <p className="mt-1 flex items-center gap-1 font-mono text-sm font-semibold text-[#22d3ee]">
                    <Compass className="h-3.5 w-3.5" />
                    {Math.round(liveHeadingDeg)}°{" "}
                    {formatCardinalDirection(liveHeadingDeg)}
                  </p>
                </div>
              </div>

              {/* Right: Trip Progress, ETA, and Live GPS Coordinates */}
              <div className="flex flex-1 flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1b384f] bg-[#07131c]/92 px-4 py-3 text-[#e6f4fa] shadow-xl backdrop-blur-md sm:max-w-md">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#82a3b8]">
                    Distance
                  </p>
                  <p className="mt-0.5 font-display text-lg font-bold text-white">
                    {formatKm(activeTrip?.distanceKm ?? 0)}{" "}
                    <span className="text-xs font-normal text-[#82a3b8]">
                      km
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#82a3b8]">
                    Duration
                  </p>
                  <p className="mt-0.5 font-display text-lg font-bold text-white">
                    {formatDuration(activeDurationMs)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#82a3b8]">
                    Est. Rem / ETA
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold text-[#22d3ee]">
                    {navTelemetry.remainingKm.toFixed(1)} km · ~{etaMinutes}m
                  </p>
                </div>

                <div className="w-full border-t border-[#1b384f] pt-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-mono text-[#82a3b8]">
                      <MapPin className="h-3 w-3 text-[#22d3ee]" />
                      {latestPoint
                        ? `${latestPoint.lat.toFixed(5)}, ${latestPoint.lng.toFixed(5)}`
                        : "23.79250, 90.40780"}
                    </span>
                    <span className="font-mono text-[#22d3ee]">
                      {activeTrip
                        ? `${activeTrip.points.length} pts`
                        : `${SIM_ROUTE.length} sim pts`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OBD-II & Live Vehicle Diagnostics Strip */}
          <div className="grid grid-cols-2 gap-2 border-t border-border bg-card px-4 py-3 text-xs sm:grid-cols-5">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
              <Power
                className={`h-3.5 w-3.5 ${obdIgnitionOn ? "text-[var(--brand-teal)]" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-[10px] text-muted-foreground">Ignition</p>
                <p className="font-mono font-semibold text-foreground">
                  {obdIgnitionOn ? "ON" : "OFF"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
              <BatteryCharging className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
              <div>
                <p className="text-[10px] text-muted-foreground">Battery</p>
                <p className="font-mono font-semibold text-foreground">
                  {obdBatteryVolts}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
              <Fuel className="h-3.5 w-3.5 text-[var(--brand-blue)]" />
              <div>
                <p className="text-[10px] text-muted-foreground">Fuel Level</p>
                <p className="font-mono font-semibold text-foreground">
                  {obdFuelPct}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
              <Thermometer className="h-3.5 w-3.5 text-[var(--brand-amber)]" />
              <div>
                <p className="text-[10px] text-muted-foreground">Coolant</p>
                <p className="font-mono font-semibold text-foreground">
                  {obdCoolantC}°C
                </p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2 sm:col-span-1">
              <Cpu className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
              <div>
                <p className="text-[10px] text-muted-foreground">OBD-II</p>
                <p className="font-mono font-semibold text-[var(--brand-teal)]">
                  0 DTC · OK
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Column: Navigator Dispatch & Live Route Timeline (4 cols on XL) */}
        <Card className="flex flex-col justify-between rounded-2xl xl:col-span-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {activeTrip ? "Active Route Console" : "Navigator Dispatch"}
              </CardTitle>
              <Badge
                variant="secondary"
                className="rounded-lg font-mono text-xs"
              >
                {activeVehicle?.plate ?? "NO-VEH"}
              </Badge>
            </div>
            <CardDescription>
              {activeTrip
                ? `${activeVehicle?.name ?? "Vehicle"} · ${activeTrip.purpose}${activeDriver ? ` · ${activeDriver.name}` : ""}`
                : "Configure vehicle, driver, and GPS telemetry source to begin navigation."}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            {/* GPS Source Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/35 px-3.5 py-2.5">
              <div className="space-y-0.5 pr-3">
                <Label htmlFor="simulate-gps" className="text-sm font-medium">
                  Dhaka Route Simulator
                </Label>
                <p className="text-xs text-muted-foreground">
                  {simulateGps
                    ? "Streams 7-checkpoint Dhaka corridor (1 pt/s)"
                    : "Uses live browser Geolocation sensor"}
                </p>
              </div>
              <Switch
                id="simulate-gps"
                checked={simulateGps}
                onCheckedChange={setSimulateGps}
              />
            </div>

            {gpsError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
            ) : null}

            {!activeTrip ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="trip-vehicle">Assigned Vehicle</Label>
                  <Select
                    value={effectiveVehicleId}
                    items={vehicleSelectItems}
                    onValueChange={handleVehicleChange}
                    disabled={vehicles.length === 0}
                  >
                    <SelectTrigger id="trip-vehicle" className="w-full">
                      <SelectValue placeholder="Select a vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} ({v.plate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trip-driver">Operator / Driver</Label>
                  <Select
                    value={selectedDriverId}
                    items={dispatchDriverItems}
                    onValueChange={(value) => {
                      if (value) setSelectedDriverId(value);
                    }}
                  >
                    <SelectTrigger id="trip-driver" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DRIVER_VALUE}>
                        Unassigned
                      </SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trip-purpose">Dispatch Purpose</Label>
                  <Input
                    id="trip-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Client delivery, airport run..."
                    className="h-10 rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PURPOSE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPurpose(preset)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          purpose === preset
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Planned Corridor Preview Box */}
                <div className="rounded-xl border border-border bg-muted/25 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Planned Corridor
                    </span>
                    <span className="font-mono text-primary">
                      {ROUTE_WAYPOINTS.length} stops ·{" "}
                      {PLANNED_ROUTE_TOTAL_KM.toFixed(1)} km
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ROUTE_WAYPOINTS[0].name} →{" "}
                    {ROUTE_WAYPOINTS[ROUTE_WAYPOINTS.length - 1].name}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleStartTrip}
                  disabled={vehicles.length === 0}
                  className="h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Start navigation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Progress Bar */}
                <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">
                      Corridor Progress
                    </span>
                    <span className="font-mono font-semibold text-primary">
                      {navTelemetry.progressPct}% · Peak{" "}
                      {formatSpeed(activeTrip.maxSpeedKmh)} km/h
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${navTelemetry.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Live Waypoint Timeline */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Corridor Checkpoints
                  </p>
                  <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2.5">
                    {ROUTE_WAYPOINTS.map((wp, idx) => {
                      const isPassed = idx < navTelemetry.nextWaypointIndex;
                      const isTarget = idx === navTelemetry.nextWaypointIndex;

                      return (
                        <div
                          key={wp.id}
                          className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                            isTarget
                              ? "border border-primary/40 bg-primary/10"
                              : isPassed
                                ? "opacity-75"
                                : "opacity-60"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isPassed ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : isTarget ? (
                              <span className="relative flex h-4 w-4 items-center justify-center">
                                <span className="tf-live-pulse absolute inline-flex h-full w-full rounded-full bg-primary" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                              </span>
                            ) : (
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border font-mono text-[10px] text-muted-foreground">
                                {idx + 1}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="truncate font-semibold text-foreground">
                                {wp.name}
                              </p>
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                {isPassed
                                  ? "PASSED"
                                  : isTarget
                                    ? distanceToNextLabel
                                    : `${wp.speedLimitKmh} km/h`}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {wp.instruction}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Multi-stop Waypoints & Proof of Delivery (POD) */}
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Stops &amp; POD ({activeTrip.waypoints?.length ?? 0})
                    </p>
                    <Badge variant="outline" className="rounded-md text-[10px]">
                      <ClipboardCheck className="mr-1 h-3 w-3 text-primary" />
                      Pre-trip OK
                    </Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      value={newStopLabel}
                      onChange={(e) => setNewStopLabel(e.target.value)}
                      placeholder="Add delivery stop..."
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleAddStop}
                      className="h-8 rounded-lg px-2.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {(activeTrip.waypoints ?? []).length > 0 ? (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto">
                      {(activeTrip.waypoints ?? []).map((wp) => (
                        <div
                          key={wp.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {wp.label}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {wp.recipientName
                                ? `POD: ${wp.recipientName}`
                                : wp.address}
                            </p>
                          </div>
                          {wp.arrivedAt ? (
                            <Badge className="shrink-0 rounded-md border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[10px] text-[var(--brand-teal)]">
                              Delivered
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setPodWaypoint(wp)}
                              className="shrink-0 rounded-md"
                            >
                              Capture POD
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Solid Action Controls */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {activeTrip.status === "active" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePause}
                      className="h-10 rounded-xl"
                    >
                      <Pause className="mr-1.5 h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleResume}
                      className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Play className="mr-1.5 h-4 w-4" />
                      Resume
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleEnd}
                    className="h-10 rounded-xl"
                  >
                    <Square className="mr-1.5 h-4 w-4" />
                    End trip
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Operations Tabs: Trip History, Bookings & Approvals, Geofences */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 rounded-xl sm:max-w-xl">
          <TabsTrigger value="history" className="rounded-lg">
            <Route className="mr-1.5 h-3.5 w-3.5" />
            Trip History ({filteredCompletedTrips.length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="rounded-lg">
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            Bookings ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="geofences" className="rounded-lg">
            <Radar className="mr-1.5 h-3.5 w-3.5" />
            Geofences ({geofences.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-lg">
              Recorded Navigation Logs ({filteredCompletedTrips.length})
            </CardTitle>
            <CardDescription>
              Select any completed trip to inspect its GPS route replay and
              telemetry summary.
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-3">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search trip history"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  historyPagination.setPage(1);
                }}
                placeholder="Search purpose, plate, driver..."
                className="pl-10"
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                value={historyVehicleFilter}
                items={vehicleFilterItems}
                onValueChange={(value) => {
                  if (value) {
                    setHistoryVehicleFilter(value);
                    historyPagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger aria-label="Filter trips by vehicle" className="w-full">
                  <SelectValue placeholder="All vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select
                value={historyDriverFilter}
                items={driverFilterItems}
                onValueChange={(value) => {
                  if (value) {
                    setHistoryDriverFilter(value);
                    historyPagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger aria-label="Filter trips by driver" className="w-full">
                  <SelectValue placeholder="All drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DRIVERS}>All drivers</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <DateRangePicker
                aria-label="Filter trips by date range"
                fromDate={historyFromDate}
                toDate={historyToDate}
                align="end"
                onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
                  setHistoryFromDate(nextFrom);
                  setHistoryToDate(nextTo);
                  historyPagination.setPage(1);
                }}
                placeholder="Filter by date range"
              />
            </div>

            <div className="flex items-center lg:col-span-1">
              {hasHistoryFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearHistoryFilters}
                  aria-label="Reset trip history filters"
                  className="h-10 w-full rounded-xl px-2.5"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCompletedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <Route className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {hasHistoryFilters
                  ? "No trips match your filters"
                  : "No completed trips recorded yet"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {hasHistoryFilters
                  ? "Try adjusting or clearing your search, vehicle, driver, or date range filters."
                  : "Start and finish a navigation run above to log the route and automatically update the vehicle odometer."}
              </p>
              {hasHistoryFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearHistoryFilters}
                  className="mt-4 rounded-xl"
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="text-right">Top speed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPagination.pageItems.map((trip) => {
                      const vehicle = vehiclesById.get(trip.vehicleId);
                      const driver = trip.driverId
                        ? driversById.get(trip.driverId)
                        : undefined;
                      const durationMs = trip.endedAt
                        ? Math.max(
                            0,
                            new Date(trip.endedAt).getTime() -
                              new Date(trip.startedAt).getTime()
                          )
                        : 0;

                      return (
                        <TableRow
                          key={trip.id}
                          tabIndex={0}
                          role="button"
                          onClick={() => setSelectedHistoryTrip(trip)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedHistoryTrip(trip);
                            }
                          }}
                          className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(trip.startedAt)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {vehicle?.name ?? "Unknown"}
                            {vehicle ? (
                              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                {vehicle.plate}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {driver?.name ?? "Unassigned"}
                          </TableCell>
                          <TableCell>{trip.purpose}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatKm(trip.distanceKm)} km
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatDuration(durationMs)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="rounded-lg">
                              {formatSpeed(trip.maxSpeedKmh)} km/h
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={historyPagination.page}
                pageSize={historyPagination.pageSize}
                totalItems={historyPagination.totalItems}
                totalPages={historyPagination.totalPages}
                startIndex={historyPagination.startIndex}
                endIndex={historyPagination.endIndex}
                onPageChange={historyPagination.setPage}
                onPageSizeChange={historyPagination.setPageSize}
                itemLabel="trips"
              />
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsPanel onDispatchBooking={handleDispatchBooking} />
        </TabsContent>

        <TabsContent value="geofences">
          <GeofencesPanel />
        </TabsContent>
      </Tabs>

      {/* Pre-Trip / Post-Trip Walkaround Checklist Dialog */}
      <TripChecklistDialog
        open={checklistPhase !== null}
        phase={checklistPhase ?? "pre"}
        onOpenChange={(open) => {
          if (!open) setChecklistPhase(null);
        }}
        onConfirm={handleChecklistConfirm}
      />

      {/* Proof of Delivery (POD) Dialog */}
      <WaypointPodDialog
        waypoint={podWaypoint}
        onOpenChange={(open) => {
          if (!open) setPodWaypoint(null);
        }}
        onSavePod={(waypointId, pod) => {
          completeWaypointPod(waypointId, pod);
          toast.success("Proof of Delivery signature & arrival recorded.");
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
                <DialogTitle>{selectedHistoryTrip.purpose}</DialogTitle>
                <DialogDescription>
                  {vehiclesById.get(selectedHistoryTrip.vehicleId)?.name ??
                    "Unknown vehicle"}{" "}
                  · {formatDateTime(selectedHistoryTrip.startedAt)}
                  {selectedHistoryTrip.driverId
                    ? ` · Driver: ${driversById.get(selectedHistoryTrip.driverId)?.name ?? "Unknown"}`
                    : ""}
                </DialogDescription>
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
