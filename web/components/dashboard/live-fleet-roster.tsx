"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Fuel,
  Gauge,
  Info,
  Navigation,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRouteById } from "@/lib/city-routes";
import type { Driver, FleetAlert, Vehicle } from "@/types";
import { cn } from "@/lib/utils";

interface LiveFleetRosterProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  alerts: FleetAlert[];
  onMarkAlertRead: (id: string) => void;
}

export function LiveFleetRoster({
  vehicles,
  drivers,
  alerts,
  onMarkAlertRead,
}: LiveFleetRosterProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Live Fleet Roster */}
      <Card className="fp-glass rounded-2xl xl:col-span-7">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Live Fleet Roster
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Real-time telemetry snapshot — click Track to lock camera
            </p>
          </div>
          <Link
            href="/vehicles"
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
          >
            All Vehicles
            <ArrowUpRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {vehicles.map((vehicle) => {
            const route = getRouteById(vehicle.routeId);
            const driverName =
              drivers.find((d) => d.assignedVehicleId === vehicle.id)?.name ??
              "Unassigned";
            const isMoving = vehicle.status === "on_trip";
            const speed = Math.round(vehicle.lastKnownLocation?.speed ?? 0);
            const fuelPct = Math.round(vehicle.fuelLevelPercent ?? 75);

            return (
              <div
                key={vehicle.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-3 transition-colors hover:border-cyan-500/35 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                      isMoving
                        ? "border-cyan-500/35 bg-cyan-500/12 text-cyan-600 dark:text-cyan-400"
                        : vehicle.status === "under_maintenance"
                          ? "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-400"
                          : "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    <Truck className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {vehicle.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0 text-[10px] font-semibold",
                          isMoving
                            ? "border-cyan-500/35 bg-cyan-500/12 text-cyan-600 dark:text-cyan-300"
                            : vehicle.status === "under_maintenance"
                              ? "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300"
                              : "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                        )}
                      >
                        {isMoving
                          ? "In Trip"
                          : vehicle.status === "under_maintenance"
                            ? "Maintenance"
                            : "Standby"}
                      </Badge>
                    </div>
                    <p className="fp-telemetry mt-0.5 truncate text-[11px] text-muted-foreground">
                      {vehicle.plate} · {driverName} · {route.code}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <div className="fp-telemetry flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Gauge className="size-3.5 text-cyan-500" />
                      {speed} km/h
                    </span>
                    <span className="hidden sm:inline">
                      {Math.round(vehicle.odometerKm).toLocaleString()} km
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        fuelPct <= 25 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      <Fuel className="size-3.5" />
                      {fuelPct}%
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/trips?vehicle=${vehicle.id}`)}
                    className="h-8 gap-1.5 rounded-lg border-cyan-500/35 bg-cyan-500/10 px-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
                  >
                    <Navigation className="size-3" />
                    Track
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent Alerts Feed */}
      <Card className="fp-glass rounded-2xl xl:col-span-5">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold">
              Recent Alerts Feed
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Geofence crossings, service locks, and fuel warnings
            </p>
          </div>
          <Badge variant="outline" className="fp-telemetry text-[11px]">
            {alerts.length} total
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {alerts.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No active fleet alerts.
            </p>
          ) : (
            alerts.slice(0, 6).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  onMarkAlertRead(alert.id);
                  if (alert.vehicleId) {
                    router.push(`/trips?vehicle=${alert.vehicleId}`);
                  }
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-cyan-500/35",
                  !alert.read
                    ? "border-cyan-500/25 bg-cyan-500/[0.04]"
                    : "border-border bg-muted/20"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    alert.severity === "critical"
                      ? "bg-rose-500/15 text-rose-500"
                      : alert.severity === "warning"
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-cyan-500/15 text-cyan-500"
                  )}
                >
                  {alert.severity === "info" ? (
                    <Info className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {alert.title}
                    </p>
                    {!alert.read ? (
                      <span className="size-2 shrink-0 rounded-full bg-cyan-500" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {alert.message}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
