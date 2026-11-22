"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Gauge,
  GitMerge,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  Route,
  Square,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActiveWaypointTelemetry,
  RouteMap,
} from "@/components/route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTripTracker } from "@/hooks/use-trip-tracker";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
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
import type { Trip } from "@/types";

const NO_DRIVER_VALUE = "__none__";

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
  const activeTripId = useFleetStore((s) => s.activeTripId);

  const startTrip = useFleetStore((s) => s.startTrip);
  const pauseTrip = useFleetStore((s) => s.pauseTrip);
  const resumeTrip = useFleetStore((s) => s.resumeTrip);
  const endTrip = useFleetStore((s) => s.endTrip);

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState(NO_DRIVER_VALUE);
  const [purpose, setPurpose] = useState("Client delivery");
  const [simulateGps, setSimulateGps] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedHistoryTrip, setSelectedHistoryTrip] = useState<Trip | null>(
    null
  );

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

  // Live 1-second clock for active trip duration display
  useEffect(() => {
    if (!activeTrip) return;
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTrip]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

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
    const driverId =
      selectedDriverId === NO_DRIVER_VALUE ? undefined : selectedDriverId;
    const res = startTrip(effectiveVehicleId, purpose, driverId);
    if (!res.ok) {
      toast.error(res.error ?? "Unable to start trip.");
      return;
    }
    setNowMs(Date.now());
    const vehicle = vehiclesById.get(effectiveVehicleId);
    toast.success(`Live navigation started for ${vehicle?.name ?? "vehicle"}.`);
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
    const distance = activeTrip?.distanceKm ?? 0;
    endTrip();
    toast.success(
      `Navigation ended. Added ${formatKm(distance)} km to the vehicle odometer.`
    );
  };

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
          <div className="relative h-[560px] w-full sm:h-[600px]">
            <RouteMap
              points={activeTrip?.points ?? []}
              live={activeTrip?.status === "active"}
              showPlannedRoute={true}
              activeWaypointIndex={
                activeTrip ? navTelemetry.nextWaypointIndex : 0
              }
              headingDeg={liveHeadingDeg}
              className="h-full w-full rounded-none border-0"
            />

            {/* TOP-LEFT OVERLAY: Highway Turn-by-Turn Maneuver Sign */}
            <div className="absolute top-3.5 left-3.5 z-20 max-w-[360px] sm:max-w-md">
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
                    onValueChange={handleVehicleChange}
                    disabled={vehicles.length === 0}
                  >
                    <SelectTrigger
                      id="trip-vehicle"
                      className="h-10 w-full rounded-xl"
                    >
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
                    onValueChange={(value) => {
                      if (value) setSelectedDriverId(value);
                    }}
                  >
                    <SelectTrigger
                      id="trip-driver"
                      className="h-10 w-full rounded-xl"
                    >
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

      {/* Trip History Table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Recorded Navigation Logs</CardTitle>
          <CardDescription>
            Select any completed trip to inspect its GPS route replay and
            telemetry summary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <Route className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No completed trips recorded yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Start and finish a navigation run above to log the route and
                automatically update the vehicle odometer.
              </p>
            </div>
          ) : (
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
                  {completedTrips.map((trip) => {
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
          )}
        </CardContent>
      </Card>

      {/* Trip Route Replay Modal */}
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

              <RouteMap
                points={selectedHistoryTrip.points}
                live={false}
                showPlannedRoute={true}
                activeWaypointIndex={ROUTE_WAYPOINTS.length}
                className="min-h-[340px]"
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/35 p-3">
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Route className="h-3.5 w-3.5 text-primary" />
                    Distance
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {formatKm(selectedHistoryTrip.distanceKm)} km
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/35 p-3">
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-[var(--brand-blue)]" />
                    Duration
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {formatDuration(
                      selectedHistoryTrip.endedAt
                        ? Math.max(
                            0,
                            new Date(selectedHistoryTrip.endedAt).getTime() -
                              new Date(selectedHistoryTrip.startedAt).getTime()
                          )
                        : 0
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/35 p-3">
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Gauge className="h-3.5 w-3.5 text-[var(--brand-amber)]" />
                    Top speed
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {formatSpeed(selectedHistoryTrip.maxSpeedKmh)} km/h
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
