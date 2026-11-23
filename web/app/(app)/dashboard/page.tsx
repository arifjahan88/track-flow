"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Compass,
  Navigation,
  Plus,
  Route,
  Truck,
} from "lucide-react";
import { FleetCharts } from "@/components/dashboard/fleet-charts";
import { LiveFleetRoster } from "@/components/dashboard/live-fleet-roster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { ROLE_LABELS } from "@/lib/rbac";

export default function DashboardPage() {
  const hydrated = useHydrated();
  const router = useRouter();

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const alerts = useFleetStore((s) => s.alerts);
  const markAlertRead = useFleetStore((s) => s.markAlertRead);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    );
  }

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "super_admin";
  const assignedVehicle =
    activeRole === "driver"
      ? vehicles.find(
          (v) => v.id === (currentUser?.assignedVehicleId ?? "veh-1")
        )
      : undefined;

  const totalUnits = vehicles.length;
  const inTripCount = vehicles.filter((v) => v.status === "on_trip").length;
  const standbyCount = vehicles.filter(
    (v) => (v.status ?? "available") === "available"
  ).length;
  const maintenanceCount = vehicles.filter(
    (v) => v.status === "under_maintenance"
  ).length;
  const inactiveCount = vehicles.filter(
    (v) => v.status === "out_of_service" || v.status === "decommissioned"
  ).length;

  const totalDistanceKm = trips.reduce((sum, t) => sum + t.distanceKm, 0);
  const unreadAlerts = alerts.filter((a) => !a.read).length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;

  const pct = (n: number) =>
    totalUnits > 0 ? Math.round((n / totalUnits) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Driver Role Assignment Spotlight Banner */}
      {assignedVehicle ? (
        <Card className="rounded-2xl border-cyan-500/35 bg-cyan-500/[0.06]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Truck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">
                    Assigned Vehicle: {assignedVehicle.name}
                  </p>
                  <Badge variant="outline" className="fp-telemetry text-[10px]">
                    {assignedVehicle.plate}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fuel {Math.round(assignedVehicle.fuelLevelPercent ?? 75)}% ·
                  Odometer{" "}
                  {Math.round(assignedVehicle.odometerKm).toLocaleString()} km ·
                  Status:{" "}
                  {(assignedVehicle.status ?? "available").replaceAll("_", " ")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                router.push(`/trips?vehicle=${assignedVehicle.id}`)
              }
              className="gap-1.5 rounded-xl bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Navigation className="size-3.5" />
              Open Live Cockpit
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Operations Overview Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Operations Overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {currentUser?.name ?? "Alex Morgan"}
            </span>{" "}
            ({ROLE_LABELS[activeRole]}) — real-time local telemetry persisted to
            browser storage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/trips">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
            >
              <Compass className="size-4 text-cyan-500" />
              Live GPS Map
            </Button>
          </Link>
          <Link href="/trips">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 rounded-xl bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Plus className="size-4" />
              Dispatch Trip
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="fp-glass rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total Fleet
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="fp-telemetry text-3xl font-bold text-foreground">
                  {totalUnits}
                </span>
                <span className="text-xs text-muted-foreground">units</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {standbyCount} ready on standby
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="fp-glass rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Active Trips
                {inTripCount > 0 ? (
                  <span className="animate-fp-pulse-dot size-2 rounded-full bg-emerald-500" />
                ) : null}
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="fp-telemetry text-3xl font-bold text-foreground">
                  {inTripCount}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  live
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {inTripCount} ongoing corridors
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Compass className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="fp-glass rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Distance Covered
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="fp-telemetry text-3xl font-bold text-foreground">
                  {totalDistanceKm.toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">km</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Across {trips.length} tracked manifests
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
              <Route className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="fp-glass rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Active Alerts
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="fp-telemetry text-3xl font-bold text-foreground">
                  {unreadAlerts}
                </span>
                <span className="text-xs text-muted-foreground">unread</span>
              </div>
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                {criticalAlerts} critical threshold
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Status Distribution Segmented Bar */}
      <Card className="fp-glass rounded-2xl">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Fleet Status Distribution
              </p>
              <p className="text-xs text-muted-foreground">
                Live operational availability across all {totalUnits} units
              </p>
            </div>
            <div className="fp-telemetry flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-cyan-500" />
                In Trip:{" "}
                <strong className="text-foreground">
                  {inTripCount} ({pct(inTripCount)}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Active:{" "}
                <strong className="text-foreground">
                  {standbyCount} ({pct(standbyCount)}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                Maintenance:{" "}
                <strong className="text-foreground">
                  {maintenanceCount} ({pct(maintenanceCount)}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-slate-400" />
                Inactive:{" "}
                <strong className="text-foreground">
                  {inactiveCount} ({pct(inactiveCount)}%)
                </strong>
              </span>
            </div>
          </div>

          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {inTripCount > 0 ? (
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${pct(inTripCount)}%` }}
              />
            ) : null}
            {standbyCount > 0 ? (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct(standbyCount)}%` }}
              />
            ) : null}
            {maintenanceCount > 0 ? (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${pct(maintenanceCount)}%` }}
              />
            ) : null}
            {inactiveCount > 0 ? (
              <div
                className="h-full bg-slate-400 transition-all duration-500"
                style={{ width: `${pct(inactiveCount)}%` }}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Row: Area Chart + Status Donut */}
      <FleetCharts vehicles={vehicles} trips={trips} fuelLogs={fuelLogs} />

      {/* Live Fleet Roster & Recent Alerts Feed */}
      <LiveFleetRoster
        vehicles={vehicles}
        drivers={drivers}
        alerts={alerts}
        onMarkAlertRead={markAlertRead}
      />
    </div>
  );
}
