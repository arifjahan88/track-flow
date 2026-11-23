"use client";

import {
  Compass,
  Fuel,
  Gauge,
  MapPin,
  Navigation,
  Play,
  Route,
  Square,
  User,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  Driver,
  LiveVehicleFrame,
  Vehicle,
  VehicleLifecycleStatus,
} from "@/types";
import { SpeedGauge } from "@/components/trips/speed-gauge";
import { headingToCardinal } from "@/lib/geo-sim";
import { getRouteById } from "@/lib/city-routes";

interface TelemetryInspectorProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  selectedVehicle: Vehicle | undefined;
  frame: LiveVehicleFrame | undefined;
  frames: Record<string, LiveVehicleFrame>;
  onSelectVehicle: (vehicleId: string) => void;
  onStartTrip: (vehicleId: string) => void;
  onEndTrip: (vehicleId: string) => void;
}

const STATUS_BADGE: Record<
  VehicleLifecycleStatus,
  { label: string; className: string }
> = {
  on_trip: {
    label: "IN TRIP",
    className:
      "border-cyan-500/35 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  },
  available: {
    label: "STANDBY",
    className:
      "border-emerald-500/35 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  under_maintenance: {
    label: "MAINTENANCE",
    className:
      "border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  out_of_service: {
    label: "OUT OF SERVICE",
    className:
      "border-rose-500/35 bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  decommissioned: {
    label: "DECOMMISSIONED",
    className:
      "border-slate-500/35 bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
};

export function TelemetryInspector({
  vehicles,
  drivers,
  selectedVehicle,
  frame,
  frames,
  onSelectVehicle,
  onStartTrip,
  onEndTrip,
}: TelemetryInspectorProps) {
  if (!selectedVehicle) {
    return (
      <div className="fp-glass flex h-full items-center justify-center rounded-2xl p-6 text-sm text-muted-foreground">
        No vehicles registered. Add a vehicle to inspect telemetry.
      </div>
    );
  }

  const route = getRouteById(selectedVehicle.routeId);
  const driverName =
    drivers.find((d) => d.assignedVehicleId === selectedVehicle.id)?.name ??
    "Unassigned";
  const status: VehicleLifecycleStatus = selectedVehicle.status ?? "available";
  const speed =
    frame?.speedKmh ?? selectedVehicle.lastKnownLocation?.speed ?? 0;
  const heading =
    frame?.headingDeg ?? selectedVehicle.lastKnownLocation?.heading ?? 0;
  const lat =
    frame?.latitude ?? selectedVehicle.lastKnownLocation?.latitude ?? 37.7749;
  const lng =
    frame?.longitude ??
    selectedVehicle.lastKnownLocation?.longitude ??
    -122.4194;
  const progressPct = Math.round(
    ((frame?.routeProgress ?? selectedVehicle.routeProgress ?? 0) % 1) * 100
  );
  const fuelPct = selectedVehicle.fuelLevelPercent ?? 75;
  const isMoving = status === "on_trip";
  const isLocked =
    status === "under_maintenance" ||
    status === "out_of_service" ||
    status === "decommissioned";
  const lowFuel = fuelPct <= 25;

  return (
    <div className="fp-glass flex h-full flex-col overflow-hidden rounded-2xl">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold tracking-tight">
                {selectedVehicle.name}
              </h2>
              <Badge
                variant="outline"
                className={cn(
                  "fp-telemetry text-[10px] font-semibold",
                  STATUS_BADGE[status].className
                )}
              >
                {STATUS_BADGE[status].label}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="fp-telemetry font-semibold text-foreground/80">
                {selectedVehicle.plate}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="size-3" />
                {driverName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Telemetry Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Semicircular Speed Gauge */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 dark:bg-slate-950/60">
          <SpeedGauge speedKmh={speed} isMoving={isMoving} />
        </div>

        {/* Telemetry Readout Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-border bg-muted/35 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Compass className="size-3.5 text-cyan-500" />
              Heading
            </div>
            <p className="fp-telemetry mt-1 text-sm font-bold">
              {Math.round(heading)}° {headingToCardinal(heading)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/35 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Gauge className="size-3.5 text-emerald-500" />
              Odometer
            </div>
            <p className="fp-telemetry mt-1 text-sm font-bold">
              {selectedVehicle.odometerKm.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}{" "}
              km
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-border bg-muted/35 p-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-cyan-500" />
                Live GPS Coordinates
              </span>
              <span className="fp-telemetry text-[10px] font-semibold text-emerald-500">
                GPS LOCK
              </span>
            </div>
            <p className="fp-telemetry mt-1 text-xs font-semibold">
              {lat.toFixed(5)}° N, {Math.abs(lng).toFixed(5)}° W
            </p>
          </div>
        </div>

        {/* Route Corridor & Progress */}
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
              <Route
                className="size-3.5 shrink-0"
                style={{ color: route.color }}
              />
              <span className="truncate">{route.name}</span>
            </div>
            <span className="fp-telemetry text-xs font-bold text-cyan-600 dark:text-cyan-400">
              {progressPct}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(2, progressPct)}%`,
                backgroundColor: route.color,
              }}
            />
          </div>
          <p className="fp-telemetry mt-1.5 text-[10px] text-muted-foreground">
            {route.code} · {route.distanceKm} km corridor · Est.{" "}
            {route.estimatedMinutes} min
          </p>
        </div>

        {/* Fuel Telemetry Bar */}
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Fuel
                className={cn(
                  "size-3.5",
                  lowFuel ? "text-rose-500" : "text-emerald-500"
                )}
              />
              Fuel Tank Level
            </span>
            <span
              className={cn(
                "fp-telemetry text-xs font-bold",
                lowFuel
                  ? "text-rose-500"
                  : fuelPct < 45
                    ? "text-amber-500"
                    : "text-emerald-500"
              )}
            >
              {Math.round(fuelPct)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                lowFuel
                  ? "bg-rose-500"
                  : fuelPct < 45
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              )}
              style={{ width: `${Math.max(2, Math.min(100, fuelPct))}%` }}
            />
          </div>
          {lowFuel ? (
            <p className="mt-1.5 text-[11px] font-medium text-rose-500">
              Low fuel warning — log a fill-up to restore tank level.
            </p>
          ) : null}
        </div>

        {/* Primary Trip Action Button */}
        <div>
          {isMoving ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onEndTrip(selectedVehicle.id)}
              className="h-10 w-full gap-2 rounded-xl font-semibold"
            >
              <Square className="size-3.5 fill-current" />
              End Active Trip
            </Button>
          ) : isLocked ? (
            <Button
              type="button"
              disabled
              variant="outline"
              className="h-10 w-full gap-2 rounded-xl border-amber-500/30 text-amber-500"
            >
              <Wrench className="size-4" />
              In Maintenance Bay (Locked)
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onStartTrip(selectedVehicle.id)}
              className="h-10 w-full gap-2 rounded-xl bg-cyan-500 font-semibold text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-cyan-400"
            >
              <Play className="size-3.5 fill-current" />
              Start Live Trip on {route.code}
            </Button>
          )}
        </div>

        {/* Fleet Selector Roster */}
        <div className="pt-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fleet Units ({vehicles.length})
            </span>
            <Navigation className="size-3.5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            {vehicles.map((v) => {
              const vFrame = frames[v.id];
              const active = v.id === selectedVehicle.id;
              const vDriver =
                drivers.find((d) => d.assignedVehicleId === v.id)?.name ??
                "Unassigned";
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVehicle(v.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all",
                    active
                      ? "border-cyan-500/45 bg-cyan-500/12 shadow-sm"
                      : "border-border bg-transparent hover:border-cyan-500/25 hover:bg-muted/60"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          v.status === "on_trip"
                            ? "animate-fp-pulse-dot bg-cyan-400"
                            : v.status === "available"
                              ? "bg-emerald-500"
                              : v.status === "under_maintenance"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                        )}
                      />
                      <span className="truncate text-xs font-semibold">
                        {v.name}
                      </span>
                    </div>
                    <p className="fp-telemetry mt-0.5 pl-4 text-[10px] text-muted-foreground">
                      {v.plate} · {vDriver}
                    </p>
                  </div>
                  <span className="fp-telemetry text-xs font-semibold text-foreground/85">
                    {Math.round(vFrame?.speedKmh ?? 0)} km/h
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
