"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  Fuel,
  History,
  MapPin,
  Navigation,
  Phone,
  Play,
  Plus,
  Route,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Square,
  Truck,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { FleetCharts } from "@/components/dashboard/fleet-charts";
import { LiveFleetRoster } from "@/components/dashboard/live-fleet-roster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { COMPLIANCE_DOC_LABELS, getComplianceStatus } from "@/lib/compliance";
import {
  checkDriverAvailability,
  computeDriverSafetyScore,
} from "@/lib/drivers";
import { formatDateTime, formatKm, formatShortDate, toIsoDate } from "@/lib/format";
import { detectFuelAnomalies } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { ROLE_LABELS } from "@/lib/rbac";
import type {
  BookingStatus,
  TripBooking,
  WorkOrderStatus,
} from "@/types";
import { cn } from "@/lib/utils";

const NEXT_WO_STATUS: Record<WorkOrderStatus, WorkOrderStatus> = {
  open: "in_progress",
  in_progress: "waiting_parts",
  waiting_parts: "completed",
  completed: "completed",
};

const BOOKING_STEP: Record<BookingStatus, { step: number; label: string; badge: string }> = {
  pending: {
    step: 1,
    label: "Pending Admin Review",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  assigned: {
    step: 2,
    label: "Driver Assigned",
    badge: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  in_progress: {
    step: 3,
    label: "Trip In Progress",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  completed: {
    step: 4,
    label: "Completed",
    badge: "border-slate-500/35 bg-slate-500/12 text-slate-700 dark:text-slate-300",
  },
  rejected: {
    step: 0,
    label: "Rejected",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

export interface RoleDashboardActions {
  onOpenRequestTrip: () => void;
  onAssignBooking: (booking: TripBooking) => void;
  onStartBooking: (booking: TripBooking) => void;
  onFinishTrip: (vehicleId: string) => void;
}

/* ============================================================================
 * 1. EMPLOYEE / USER DASHBOARD (Trip Requester Portal)
 * ========================================================================== */
export function EmployeeDashboard({ onOpenRequestTrip }: RoleDashboardActions) {
  const router = useRouter();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const bookings = useFleetStore((s) => s.bookings);
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const removeBooking = useFleetStore((s) => s.removeBooking);

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
  const driversById = new Map(drivers.map((d) => [d.id, d]));

  const myBookings = bookings.filter(
    (b) =>
      !currentUser ||
      b.requesterUserId === currentUser.id ||
      b.requesterName.toLowerCase() === currentUser.name.toLowerCase()
  );

  const pendingCount = myBookings.filter((b) => b.status === "pending").length;
  const activeCount = myBookings.filter(
    (b) => b.status === "assigned" || b.status === "in_progress"
  ).length;
  const completedCount = myBookings.filter((b) => b.status === "completed").length;

  return (
    <div className="space-y-5">
      {/* Hero Request CTA */}
      <Card className="rounded-2xl border-cyan-500/35 bg-cyan-500/6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Badge
              variant="outline"
              className="border-cyan-500/40 bg-cyan-500/12 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300"
            >
              Employee Trip Portal
            </Badge>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Need a vehicle for your next trip, {currentUser?.name ?? "User"}?
            </h2>
            <p className="max-w-xl text-xs text-muted-foreground">
              Submit your pickup &amp; drop-off details. Dispatch assigns a verified driver &amp;
              vehicle, and you can track your ride live until completion.
            </p>
          </div>
          <Button
            type="button"
            onClick={onOpenRequestTrip}
            className="h-10 shrink-0 gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Request a Trip
          </Button>
        </CardContent>
      </Card>

      {/* 3 Personal KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Admin Review</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">{pendingCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Awaiting driver assignment</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <CalendarClock className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned / Live Rides</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">{activeCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Driver ready or en route</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
              <Navigation className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Completed Trips</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">
                {completedCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Verified drop-offs</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live 4-Step My Trip Requests Tracker */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">My Trip Requests ({myBookings.length})</CardTitle>
            <CardDescription>
              Live status: Requested → Admin Assigns Driver → Driver Starts → Completed
            </CardDescription>
          </div>
          <Link href="/trips?tab=bookings">
            <Button type="button" variant="outline" size="sm" className="rounded-xl">
              Full History
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {myBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm font-medium text-foreground">No trip requests yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click &ldquo;Request a Trip&rdquo; above to book a fleet vehicle and driver.
              </p>
            </div>
          ) : (
            myBookings.map((b) => {
              const meta = BOOKING_STEP[b.status] ?? BOOKING_STEP.pending;
              const drv = b.driverId ? driversById.get(b.driverId) : undefined;
              const veh = b.vehicleId ? vehiclesById.get(b.vehicleId) : undefined;

              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={meta.badge}>
                          {meta.label}
                        </Badge>
                        <span className="fp-telemetry text-xs text-muted-foreground">
                          {formatShortDate(b.requestedDate)}
                          {b.requestedTime ? ` · ${b.requestedTime}` : ""} · Est. {b.estimatedKm} km
                        </span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{b.purpose}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0 text-primary" />
                        <span>
                          {b.pickupLocation ?? "Central Hub"} → {b.dropoffLocation ?? b.purpose}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {b.status === "in_progress" && b.vehicleId ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => router.push(`/trips?vehicle=${b.vehicleId}`)}
                          className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <Navigation className="size-3.5" />
                          Track Driver Live
                        </Button>
                      ) : null}
                      {b.status === "pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            removeBooking(b.id);
                            toast.info("Pending trip request cancelled.");
                          }}
                          className="rounded-xl text-destructive hover:bg-destructive/10"
                        >
                          Cancel Request
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* 4-Step Progress Bar */}
                  {b.status !== "rejected" ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {[
                        { num: 1, title: "Requested" },
                        { num: 2, title: "Driver Assigned" },
                        { num: 3, title: "In Progress" },
                        { num: 4, title: "Completed" },
                      ].map((s) => (
                        <div key={s.num} className="space-y-1">
                          <div
                            className={cn(
                              "h-1.5 w-full rounded-full",
                              s.num <= meta.step ? "bg-primary" : "bg-muted"
                            )}
                          />
                          <p
                            className={cn(
                              "text-[10px] font-medium",
                              s.num <= meta.step ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {s.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Assigned Driver Info */}
                  {drv && veh ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-4 text-primary" />
                        <span>
                          Driver: <strong className="text-foreground">{drv.name}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Phone className="size-3" />
                          {drv.phone}
                        </span>
                      </div>
                      <span className="fp-telemetry font-semibold text-foreground">
                        {veh.name} ({veh.plate})
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================================
 * 2. DRIVER DASHBOARD (Assigned Trips Ready to Start + Live Duty Cockpit)
 * ========================================================================== */
export function DriverDashboard({
  onStartBooking,
  onFinishTrip,
  onOpenRequestTrip,
}: RoleDashboardActions) {
  const router = useRouter();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const bookings = useFleetStore((s) => s.bookings);

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
  const activeDriver =
    drivers.find((d) => d.id === currentUser?.driverId) ??
    drivers.find((d) => d.name === currentUser?.name) ??
    drivers[0];

  const assignedVehicle = vehicles.find(
    (v) => v.id === (currentUser?.assignedVehicleId ?? activeDriver?.assignedVehicleId ?? "veh-1")
  );
  const safety = activeDriver
    ? computeDriverSafetyScore(activeDriver.id, trips)
    : { score: 100, grade: "Excellent", harshBraking: 0, speedingIncidents: 0, idleMinutes: 0, onTimeRatePct: 100 };

  const myAssignedBookings = bookings.filter(
    (b) => b.status === "assigned" && (!activeDriver || b.driverId === activeDriver.id)
  );
  const myActiveTrips = trips.filter(
    (t) =>
      t.status !== "done" &&
      (t.driverId === activeDriver?.id || t.vehicleId === assignedVehicle?.id)
  );

  return (
    <div className="space-y-5">
      {/* Header + Quick Field Tools */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Driver Duty Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Signed in as <strong className="text-foreground">{currentUser?.name}</strong> — start
            Admin-assigned trips, log fuel/expenses, and complete post-trip checks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/fuel">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Fuel className="size-3.5 text-primary" />
              Log Fuel / Expense
            </Button>
          </Link>
          <Link href="/maintenance">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <AlertOctagon className="size-3.5 text-rose-500" />
              Report SOS
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={onOpenRequestTrip}
            className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Request Trip
          </Button>
        </div>
      </div>

      {/* Priority 1: Admin-Assigned Trips Ready to Start */}
      <Card className="rounded-2xl border-cyan-500/40 bg-cyan-500/6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4 text-primary" />
                Assigned Trips Ready to Start ({myAssignedBookings.length})
              </CardTitle>
              <CardDescription>
                Trips dispatched to you by Admin — complete the 5-point Pre-Trip Check to depart.
              </CardDescription>
            </div>
            <Badge className="bg-primary text-primary-foreground">ACTION REQUIRED</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {myAssignedBookings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/60 py-6 text-center text-xs text-muted-foreground">
              No pending assigned trips right now. You will be alerted as soon as Admin assigns a
              trip.
            </p>
          ) : (
            myAssignedBookings.map((b) => {
              const veh = b.vehicleId ? vehiclesById.get(b.vehicleId) : undefined;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-cyan-500/40 text-cyan-600 dark:text-cyan-300">
                        Assigned by {b.assignedBy ?? "Admin"}
                      </Badge>
                      <span className="fp-telemetry text-xs text-muted-foreground">
                        {formatShortDate(b.requestedDate)}
                        {b.requestedTime ? ` · ${b.requestedTime}` : ""} · {b.estimatedKm} km
                      </span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{b.purpose}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 text-primary" />
                      {b.pickupLocation ?? "Central Hub"} → {b.dropoffLocation ?? b.purpose}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requester: <strong className="text-foreground">{b.requesterName}</strong> ·
                      Vehicle:{" "}
                      <strong className="text-foreground">
                        {veh ? `${veh.name} (${veh.plate})` : "Assigned Unit"}
                      </strong>
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => onStartBooking(b)}
                    className="h-10 shrink-0 gap-1.5 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                  >
                    <Play className="size-4" />
                    Start Trip (Pre-Check)
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Priority 2: Active Running Trips */}
      {myActiveTrips.length > 0 ? (
        <Card className="rounded-2xl border-emerald-500/35 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="animate-fp-pulse-dot size-2.5 rounded-full bg-emerald-500" />
              Active Live Trips ({myActiveTrips.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myActiveTrips.map((trip) => {
              const veh = vehiclesById.get(trip.vehicleId);
              return (
                <div
                  key={trip.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{trip.purpose}</p>
                      {veh ? (
                        <Badge variant="outline" className="fp-telemetry text-[10px]">
                          {veh.plate}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {veh?.name} · {formatKm(trip.distanceKm)} km covered · Max{" "}
                      {Math.round(trip.maxSpeedKmh)} km/h
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/trips?vehicle=${trip.vehicleId}`)}
                      className="gap-1.5 rounded-xl"
                    >
                      <Navigation className="size-3.5 text-primary" />
                      Open Live Map
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onFinishTrip(trip.vehicleId)}
                      className="gap-1.5 rounded-xl"
                    >
                      <Square className="size-3.5" />
                      Finish Trip (Post-Check)
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* Vehicle Health + Driver Safety Score */}
      <div className="grid gap-4 md:grid-cols-2">
        {assignedVehicle ? (
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="size-4 text-primary" />
                My Assigned Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{assignedVehicle.name}</span>
                <Badge variant="outline" className="fp-telemetry">
                  {assignedVehicle.plate}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="fp-telemetry text-base font-bold text-foreground">
                    {Math.round(assignedVehicle.fuelLevelPercent ?? 75)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">Fuel</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="fp-telemetry text-base font-bold text-foreground">
                    {Math.round(assignedVehicle.odometerKm).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Odometer km</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <p className="text-sm font-bold capitalize text-primary">
                    {(assignedVehicle.status ?? "available").replaceAll("_", " ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                My Safety Score
              </span>
              <span className="fp-telemetry text-lg font-bold text-primary">
                {safety.score}/100 · {safety.grade}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-xl bg-muted/50 p-2.5">
              <p className="fp-telemetry text-base font-bold">{safety.harshBraking}</p>
              <p className="text-[10px] text-muted-foreground">Harsh Brk</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5">
              <p className="fp-telemetry text-base font-bold">{safety.speedingIncidents}</p>
              <p className="text-[10px] text-muted-foreground">Speeding</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5">
              <p className="fp-telemetry text-base font-bold">{safety.idleMinutes}m</p>
              <p className="text-[10px] text-muted-foreground">Idle</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2.5">
              <p className="fp-telemetry text-base font-bold">{safety.onTimeRatePct}%</p>
              <p className="text-[10px] text-muted-foreground">On-Time</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. MECHANIC DASHBOARD (Service Bay, Work Orders & Incidents)
 * ========================================================================== */
export function MechanicDashboard() {
  const vehicles = useFleetStore((s) => s.vehicles);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const incidents = useFleetStore((s) => s.incidents);
  const updateWorkOrderStatus = useFleetStore((s) => s.updateWorkOrderStatus);
  const completeMaintenanceRecord = useFleetStore((s) => s.completeMaintenanceRecord);
  const setVehicleStatus = useFleetStore((s) => s.setVehicleStatus);

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));

  const dueServices = maintenanceRecords.filter((rec) => {
    const v = vehiclesById.get(rec.vehicleId);
    const st = getMaintenanceStatus(rec, v?.odometerKm ?? 0, undefined, v?.engineHours);
    return st === "overdue" || st === "due_soon";
  });
  const openWorkOrders = workOrders.filter((w) => w.status !== "completed");
  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const maintenanceVehicles = vehicles.filter((v) => v.status === "under_maintenance");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Mechanic Service Bay Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Advance active repair work orders, close due preventive services, and release repaired
            vehicles back to dispatch.
          </p>
        </div>
        <Link href="/maintenance">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Wrench className="size-3.5" />
            Open Full Maintenance Hub
          </Button>
        </Link>
      </div>

      {/* 4 Workshop KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Work Orders</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-primary">
                {openWorkOrders.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">In bay / waiting parts</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/12 text-primary">
              <ClipboardList className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Due / Overdue Services</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                {dueServices.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Date, km or engine hours</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Wrench className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">In Service Bay</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">
                {maintenanceVehicles.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Vehicles locked from dispatch</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-500/12 text-muted-foreground">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Open Incidents</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-rose-600 dark:text-rose-400">
                {openIncidents.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Roadside / damage cases</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline Actionable Work Orders + Maintenance-Locked Vehicles */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Active Work Orders ({openWorkOrders.length})</CardTitle>
            <CardDescription>Advance workshop status directly from your dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openWorkOrders.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                All repair work orders are completed.
              </p>
            ) : (
              openWorkOrders.map((wo) => {
                const veh = vehiclesById.get(wo.vehicleId);
                const next = NEXT_WO_STATUS[wo.status];
                return (
                  <div
                    key={wo.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/25 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="uppercase">
                          {wo.priority}
                        </Badge>
                        <Badge variant="secondary">{wo.status.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-foreground">{wo.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {veh?.name} ({veh?.plate}) · Vendor: {wo.vendorName}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        updateWorkOrderStatus(
                          wo.id,
                          next,
                          next === "completed" ? toIsoDate() : undefined
                        );
                        toast.success(`Work order moved to ${next.replaceAll("_", " ")}.`);
                      }}
                      className="shrink-0 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Move to {next.replaceAll("_", " ")}
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              Due Services &amp; Bay Hold Release
            </CardTitle>
            <CardDescription>
              Complete preventive checks or release repaired vehicles to Available
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {maintenanceVehicles.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {v.name} ({v.plate})
                  </p>
                  <p className="text-xs text-muted-foreground">Currently locked in maintenance</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setVehicleStatus(v.id, "available");
                    toast.success(`${v.name} released to Available for dispatch.`);
                  }}
                  className="shrink-0 rounded-xl"
                >
                  Release to Available
                </Button>
              </div>
            ))}

            {dueServices.slice(0, 4).map((rec) => {
              const veh = vehiclesById.get(rec.vehicleId);
              return (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/25 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {veh?.name} ({veh?.plate}) · {rec.type}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      completeMaintenanceRecord(rec.id, toIsoDate(), rec.cost ?? 120);
                      toast.success(`Marked "${rec.title}" completed.`);
                    }}
                    className="shrink-0 rounded-xl"
                  >
                    Mark Completed
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. SHARED PENDING TRIP REQUESTS CARD (For Admin, Fleet Manager & Dispatcher)
 * ========================================================================== */
function PendingTripRequestsStrip({
  onAssignBooking,
}: {
  onAssignBooking: (booking: TripBooking) => void;
}) {
  const bookings = useFleetStore((s) => s.bookings);
  const rejectBooking = useFleetStore((s) => s.rejectBooking);
  const pending = bookings.filter((b) => b.status === "pending");

  if (pending.length === 0) return null;

  return (
    <Card className="rounded-2xl border-amber-500/40 bg-amber-500/8">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-amber-600 dark:text-amber-400" />
            Pending Trip Requests — Driver Assignment Needed ({pending.length})
          </CardTitle>
          <CardDescription>
            Users are waiting for you to review availability and assign a Driver &amp; Vehicle.
          </CardDescription>
        </div>
        <Link href="/trips?tab=bookings">
          <Button type="button" variant="outline" size="sm" className="gap-1 rounded-xl">
            All Bookings
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {pending.slice(0, 4).map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">{b.purpose}</span>
                <Badge variant="outline" className="fp-telemetry text-[10px]">
                  {formatShortDate(b.requestedDate)}
                  {b.requestedTime ? ` · ${b.requestedTime}` : ""} · {b.estimatedKm} km
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested by <strong className="text-foreground">{b.requesterName}</strong> ·{" "}
                {b.pickupLocation ?? "Central Hub"} → {b.dropoffLocation ?? b.purpose}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => onAssignBooking(b)}
                className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <UserCheck className="size-3.5" />
                Assign Driver
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Reject request"
                onClick={() => {
                  rejectBooking(b.id, "Declined from dashboard");
                  toast.info("Trip request rejected.");
                }}
                className="rounded-xl text-destructive hover:bg-destructive/10"
              >
                <XCircle className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * 5. DISPATCHER DASHBOARD (Live Dispatch Queue, Available Pool & Radar)
 * ========================================================================== */
export function DispatcherDashboard({
  onAssignBooking,
  onOpenRequestTrip,
}: RoleDashboardActions) {
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const bookings = useFleetStore((s) => s.bookings);
  const alerts = useFleetStore((s) => s.alerts);
  const markAlertRead = useFleetStore((s) => s.markAlertRead);

  const todayIso = toIsoDate();
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const liveCount = vehicles.filter((v) => v.status === "on_trip").length;
  const availableVehicles = vehicles.filter((v) => (v.status ?? "available") === "available");
  const availableDrivers = drivers.filter(
    (d) => checkDriverAvailability(d, todayIso, trips).available
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Dispatch Control Center
          </h2>
          <p className="text-xs text-muted-foreground">
            Assign drivers to incoming trip requests, balance standby units, and monitor live GPS
            corridors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/trips">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Compass className="size-4 text-primary" />
              Live GPS Radar
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={onOpenRequestTrip}
            className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Pending Requests Priority Strip */}
      <PendingTripRequestsStrip onAssignBooking={onAssignBooking} />

      {/* 4 Dispatch KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pending Requests</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                {pendingCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Needs driver assignment</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <CalendarClock className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Live Corridors</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {liveCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Vehicles currently en route</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <Compass className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Ready Vehicles</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">
                {availableVehicles.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Standby for immediate dispatch</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/12 text-primary">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Available Drivers</p>
              <p className="fp-telemetry mt-2 text-3xl font-bold text-foreground">
                {availableDrivers.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Clear of leave &amp; active trips</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
              <Users className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Fleet Roster & Recent Alerts */}
      <LiveFleetRoster
        vehicles={vehicles}
        drivers={drivers}
        alerts={alerts}
        onMarkAlertRead={markAlertRead}
      />
    </div>
  );
}

/* ============================================================================
 * 6. EXECUTIVE DASHBOARD (Super Admin & Fleet Manager — Role-Enhanced)
 * ========================================================================== */
export function ExecutiveDashboard({
  mode,
  onAssignBooking,
  onOpenRequestTrip,
}: RoleDashboardActions & { mode: "super_admin" | "fleet_manager" }) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const alerts = useFleetStore((s) => s.alerts);
  const auditLogs = useFleetStore((s) => s.auditLogs);
  const markAlertRead = useFleetStore((s) => s.markAlertRead);

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
  const totalUnits = vehicles.length;
  const inTripCount = vehicles.filter((v) => v.status === "on_trip").length;
  const standbyCount = vehicles.filter((v) => (v.status ?? "available") === "available").length;
  const maintenanceCount = vehicles.filter((v) => v.status === "under_maintenance").length;
  const inactiveCount = vehicles.filter(
    (v) => v.status === "out_of_service" || v.status === "decommissioned"
  ).length;
  const totalDistanceKm = trips.reduce((sum, t) => sum + t.distanceKm, 0);
  const unreadAlerts = alerts.filter((a) => !a.read).length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;

  const expiringCompliance = complianceDocs.filter(
    (doc) => getComplianceStatus(doc.expiryDate).level !== "valid"
  );
  const fuelAnomaliesCount = Array.from(
    detectFuelAnomalies(fuelLogs, vehiclesById).values()
  ).reduce((s, arr) => s + arr.length, 0);

  const pct = (n: number) => (totalUnits > 0 ? Math.round((n / totalUnits) * 100) : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {mode === "super_admin"
              ? "Super Admin Command Center"
              : "Fleet Operations & Cost Control"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Signed in as{" "}
            <strong className="text-foreground">{currentUser?.name ?? "Alex Morgan"}</strong> (
            {ROLE_LABELS[mode]}) — approve trip requests, monitor compliance &amp; live telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/trips">
            <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl">
              <Compass className="size-4 text-primary" />
              Live GPS Map
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={onOpenRequestTrip}
            className="h-9 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            New Trip Request
          </Button>
        </div>
      </div>

      {/* Actionable Pending Trip Requests Strip */}
      <PendingTripRequestsStrip onAssignBooking={onAssignBooking} />

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="fp-glass rounded-2xl">
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Fleet</p>
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
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/12 text-primary">
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
                <span className="text-xs text-emerald-600 dark:text-emerald-400">live</span>
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
              <p className="text-xs font-medium text-muted-foreground">Distance Covered</p>
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
              <p className="text-xs font-medium text-muted-foreground">Active Alerts</p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="fp-telemetry text-3xl font-bold text-foreground">
                  {unreadAlerts}
                </span>
                <span className="text-xs text-muted-foreground">unread</span>
              </div>
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                {criticalAlerts} critical · {expiringCompliance.length} compliance
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-Specific Intelligence Strip: Compliance + Fuel Anomalies (Fleet Mgr / Admin) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="size-4 text-amber-500" />
              Compliance Vault Watchlist ({expiringCompliance.length})
            </CardTitle>
            <Link href="/vehicles" className="text-xs font-semibold text-primary hover:underline">
              Inspect Vault
            </Link>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {expiringCompliance.length === 0 ? (
              <p className="text-xs text-muted-foreground">All fleet documents are valid.</p>
            ) : (
              expiringCompliance.slice(0, 4).map((doc) => {
                const v = vehiclesById.get(doc.vehicleId);
                const st = getComplianceStatus(doc.expiryDate);
                return (
                  <Badge key={doc.id} variant="outline" className="gap-1.5 py-1 text-xs">
                    <span className="font-semibold">{v?.name ?? "Unit"}</span>
                    <span className="text-muted-foreground">
                      {COMPLIANCE_DOC_LABELS[doc.docType]}
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {st.label}
                    </span>
                  </Badge>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              {mode === "super_admin" ? (
                <>
                  <Shield className="size-4 text-primary" />
                  RBAC &amp; Governance ({users.length} users)
                </>
              ) : (
                <>
                  <Fuel className="size-4 text-primary" />
                  Fuel Anomalies &amp; Cost Health
                </>
              )}
            </CardTitle>
            <Link
              href={mode === "super_admin" ? "/settings" : "/fuel"}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {mode === "super_admin" ? "Manage RBAC" : "Review Fuel"}
            </Link>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {mode === "super_admin" ? (
              <div className="space-y-1.5">
                <p>
                  {users.length} active user accounts across 6 RBAC roles ·{" "}
                  <strong className="text-foreground">{auditLogs.length}</strong> recorded audit
                  events.
                </p>
                {auditLogs[0] ? (
                  <p className="flex items-center gap-1.5 truncate text-[11px] text-foreground">
                    <History className="size-3.5 shrink-0 text-primary" />
                    Latest: {auditLogs[0].summary} ({formatDateTime(auditLogs[0].timestamp)})
                  </p>
                ) : null}
              </div>
            ) : (
              <p>
                <strong className="text-foreground">{fuelAnomaliesCount}</strong> fuel efficiency /
                capacity anomalies flagged across {fuelLogs.length} logged fill-ups. Review TCO &amp;
                CPK in Reports.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet Status Distribution Bar */}
      <Card className="fp-glass rounded-2xl">
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Fleet Status Distribution</p>
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
                Standby:{" "}
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

      {/* Analytics & Live Fleet Roster */}
      <FleetCharts vehicles={vehicles} trips={trips} fuelLogs={fuelLogs} />
      <LiveFleetRoster
        vehicles={vehicles}
        drivers={drivers}
        alerts={alerts}
        onMarkAlertRead={markAlertRead}
      />
    </div>
  );
}
