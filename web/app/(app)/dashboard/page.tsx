"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Navigation,
  Route,
  Wrench,
} from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { COMPLIANCE_DOC_LABELS, getComplianceStatus } from "@/lib/compliance";
import { formatDuration, formatKm, formatShortDate } from "@/lib/format";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { ROLE_LABELS } from "@/lib/rbac";

export default function DashboardPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);

  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const activeTripId = useFleetStore((s) => s.activeTripId);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const bookings = useFleetStore((s) => s.bookings);
  const workOrders = useFleetStore((s) => s.workOrders);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const currentUser = users.find((u) => u.id === currentUserId);
  const firstName = currentUser?.name.split(" ")[0] ?? "Admin";

  const completedTrips = trips.filter((t) => t.status === "done");
  const totalDistanceKm = completedTrips.reduce((sum, t) => sum + t.distanceKm, 0);
  const activeTrip = trips.find((t) => t.id === activeTripId && t.status !== "done");
  const activeVehicle = activeTrip
    ? vehicles.find((v) => v.id === activeTrip.vehicleId)
    : undefined;

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
  const recentTrips = completedTrips.slice(0, 6);

  const maintenanceAlerts = maintenanceRecords
    .map((record) => {
      const vehicle = vehiclesById.get(record.vehicleId);
      const status = getMaintenanceStatus(
        record,
        vehicle?.odometerKm ?? 0,
        undefined,
        vehicle?.engineHours,
      );
      return { record, vehicle, status };
    })
    .filter((item) => item.status === "overdue" || item.status === "due_soon")
    .sort((a, b) => (a.status === "overdue" ? -1 : b.status === "overdue" ? 1 : 0));

  const complianceAlerts = complianceDocs
    .map((doc) => ({
      doc,
      vehicle: vehiclesById.get(doc.vehicleId),
      status: getComplianceStatus(doc.expiryDate),
    }))
    .filter((item) => item.status.level !== "valid")
    .sort((a, b) => a.status.daysRemaining - b.status.daysRemaining);

  const pendingBookingsCount = bookings.filter((b) => b.status === "pending").length;
  const openWorkOrdersCount = workOrders.filter((w) => w.status !== "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Fleet overview · {currentUser?.role ? ROLE_LABELS[currentUser.role] : "Super Admin"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h1>
        </div>
        <Link href="/trips">
          <Button className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
            <Navigation className="mr-2 h-4 w-4" />
            {activeTrip ? "Open live tracker" : "Start a trip"}
          </Button>
        </Link>
      </div>

      {/* Active trip banner */}
      {activeTrip ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-(--brand-amber)/40 bg-(--brand-amber)/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="tf-live-pulse absolute inline-flex h-full w-full rounded-full bg-brand-amber" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-amber" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeTrip.status === "active" ? "Live trip in progress" : "Trip paused"} —{" "}
                {activeVehicle?.name ?? "Vehicle"} ({activeVehicle?.plate})
              </p>
              <p className="text-xs text-muted-foreground">
                {activeTrip.purpose} · {formatKm(activeTrip.distanceKm)} km recorded ·{" "}
                {activeTrip.points.length} points
              </p>
            </div>
          </div>
          bg-(--brand-amber)/10
          <Link href="/trips">
            <Button size="sm" variant="outline" className="rounded-xl">
              View tracking
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ) : null}

      {/* 4 KPI cards */}
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem hoverLift>
          <Card className="h-full rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vehicles</CardTitle>
              <Car className="h-4 w-4 text-brand-teal" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-semibold tracking-tight text-foreground">
                <AnimatedNumber value={vehicles.length} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Registered in your fleet</p>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem hoverLift>
          <Card className="h-full rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed trips
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-brand-blue" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-semibold tracking-tight text-foreground">
                <AnimatedNumber value={completedTrips.length} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Logged in browser history</p>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem hoverLift>
          <Card className="h-full rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Distance driven
              </CardTitle>
              <Route className="h-4 w-4 text-brand-teal" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-semibold tracking-tight text-foreground">
                <AnimatedNumber value={totalDistanceKm} decimals={1} suffix=" km" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Across all completed trips</p>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem hoverLift>
          <Card className="h-full rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active trip status
              </CardTitle>
              <Navigation className="h-4 w-4 text-brand-amber" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {activeTrip ? (activeTrip.status === "active" ? "Live" : "Paused") : "Idle"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeTrip
                  ? `${activeVehicle?.name ?? "Vehicle"} · ${formatKm(activeTrip.distanceKm)} km`
                  : "Ready to track next route"}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      {/* Main grid: Recent trips + Maintenance alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent trips</CardTitle>
              <CardDescription>Last six completed trips across your fleet</CardDescription>
            </div>
            <Link href="/trips">
              <Button variant="ghost" size="sm" className="rounded-xl">
                All trips
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentTrips.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-brand-teal">
                  <Route className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">No completed trips yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Start a simulated Dhaka route or live GPS trip to record distance, speed, and
                  route history.
                </p>
                <Link href="/trips" className="mt-4">
                  <Button
                    size="sm"
                    className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Go to trips and tracking
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTrips.map((trip) => {
                  const vehicle = vehiclesById.get(trip.vehicleId);
                  const durationMs = trip.endedAt
                    ? Math.max(
                        0,
                        new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime(),
                      )
                    : 0;
                  return (
                    <div
                      key={trip.id}
                      className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {trip.purpose}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {vehicle?.name ?? "Unknown vehicle"}
                          {vehicle ? ` (${vehicle.plate})` : ""} · {formatShortDate(trip.startedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <Badge variant="secondary" className="rounded-lg">
                          {formatKm(trip.distanceKm)} km
                        </Badge>
                        <span className="text-muted-foreground">{formatDuration(durationMs)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Maintenance alerts</CardTitle>
              <CardDescription>Overdue and due within 14 days</CardDescription>
            </div>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {maintenanceAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-brand-teal" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  All vehicles are up to date
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No overdue or upcoming services require immediate action.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {maintenanceAlerts.map(({ record, vehicle, status }) => (
                  <div key={record.id} className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{record.title}</p>
                      <Badge
                        variant={status === "overdue" ? "destructive" : "secondary"}
                        className={
                          status === "due_soon"
                            ? "border-(--brand-amber)/40 bg-(--brand-amber)/15 text-brand-amber"
                            : ""
                        }
                      >
                        {status === "overdue" ? "Overdue" : "Due soon"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {vehicle?.name ?? "Vehicle"} ({vehicle?.plate})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {record.scheduledDate ? (
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Due {formatShortDate(record.scheduledDate)}
                        </span>
                      ) : null}
                      {typeof record.dueOdometerKm === "number" ? (
                        <span>At {record.dueOdometerKm.toLocaleString("en-US")} km</span>
                      ) : null}
                    </div>
                  </div>
                ))}
                <Link href="/maintenance" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full rounded-xl">
                    Manage maintenance
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance & Operations Pulse Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Compliance Vault Alerts</CardTitle>
              <CardDescription>Documents expiring within 30 / 15 / 7 days</CardDescription>
            </div>
            <FileWarning className="h-4 w-4 text-brand-amber" />
          </CardHeader>
          <CardContent>
            {complianceAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All tax tokens, fitness certificates, permits, and insurance policies are current.
              </p>
            ) : (
              <div className="space-y-2">
                {complianceAlerts.slice(0, 4).map(({ doc, vehicle, status }) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/25 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {vehicle?.name ?? "Vehicle"} · {COMPLIANCE_DOC_LABELS[doc.docType]}
                      </p>
                      <p className="text-muted-foreground">Exp {formatShortDate(doc.expiryDate)}</p>
                    </div>
                    <Badge
                      variant={
                        status.level === "expired" || status.level === "critical_7d"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {status.label}
                    </Badge>
                  </div>
                ))}
                <Link href="/vehicles" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full rounded-xl">
                    Open compliance vault
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Operations Queue</CardTitle>
              <CardDescription>Pending dispatch approvals and active shop repairs</CardDescription>
            </div>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-3.5 py-2.5 text-sm">
              <span>Pending trip bookings</span>
              <Link href="/trips">
                <Badge variant="secondary" className="rounded-lg">
                  {pendingBookingsCount} pending
                </Badge>
              </Link>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-3.5 py-2.5 text-sm">
              <span>Active maintenance work orders</span>
              <Link href="/maintenance">
                <Badge variant="secondary" className="rounded-lg">
                  {openWorkOrdersCount} open
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
