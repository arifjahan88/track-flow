"use client";

import { useMemo, useState } from "react";
import {
  MapPin,
  Navigation,
  Play,
  Plus,
  Route,
  Square,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { AssignDriverDialog } from "@/components/trips/assign-driver-dialog";
import { RequestTripDialog } from "@/components/trips/request-trip-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { formatShortDate } from "@/lib/format";
import { can } from "@/lib/rbac";
import { getScopedBookings, resolveUserDriverId } from "@/lib/rbac-scope";
import type { BookingStatus, TripBooking } from "@/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | BookingStatus;

const STATUS_META: Record<
  BookingStatus,
  { label: string; step: number; badgeClass: string }
> = {
  pending: {
    label: "Pending Admin",
    step: 1,
    badgeClass:
      "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  assigned: {
    label: "Driver Assigned",
    step: 2,
    badgeClass:
      "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  in_progress: {
    label: "In Progress",
    step: 3,
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  completed: {
    label: "Completed",
    step: 4,
    badgeClass:
      "border-slate-500/35 bg-slate-500/12 text-slate-700 dark:text-slate-300",
  },
  rejected: {
    label: "Rejected",
    step: 0,
    badgeClass:
      "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

export function BookingsPanel({
  onStartBooking,
  onFinishBooking,
  onTrackVehicle,
  onViewCompletedTrip,
}: {
  onStartBooking: (booking: TripBooking) => void;
  onFinishBooking?: (booking: TripBooking) => void;
  onTrackVehicle?: (vehicleId: string) => void;
  onViewCompletedTrip?: (tripId: string) => void;
}) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole = currentUser?.role ?? "super_admin";
  const canApprove = can(activeRole, "dispatch:approve");
  const canRequest = can(activeRole, "bookings:request");
  const canOperate = can(activeRole, "trips:operate");

  const bookings = useFleetStore((s) => s.bookings);
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const rejectBooking = useFleetStore((s) => s.rejectBooking);
  const removeBooking = useFleetStore((s) => s.removeBooking);

  const [requestOpen, setRequestOpen] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState<TripBooking | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  // Strict RBAC record scoping:
  // - employee: ONLY their own trip requests
  // - driver: ONLY bookings assigned to this driver (or requested by them)
  // - admin / dispatcher / fleet_manager: all fleet bookings
  const scopedBookings = useMemo(
    () => getScopedBookings(currentUser, drivers, bookings),
    [currentUser, drivers, bookings]
  );

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return scopedBookings;
    return scopedBookings.filter((b) => b.status === statusFilter);
  }, [scopedBookings, statusFilter]);

  const counts = useMemo(() => {
    const map = {
      all: scopedBookings.length,
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      rejected: 0,
    };
    for (const b of scopedBookings) {
      if (b.status in map) map[b.status] += 1;
    }
    return map;
  }, [scopedBookings]);

  const pagination = usePagination(filteredBookings, 8);

  const currentDriverId = resolveUserDriverId(currentUser, drivers);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">
            {activeRole === "employee"
              ? `My Trip Requests (${scopedBookings.length})`
              : activeRole === "driver"
                ? `My Assigned Trips & Bookings (${scopedBookings.length})`
                : `Trip Requests, Driver Assignment & Dispatch (${scopedBookings.length})`}
          </CardTitle>
          <CardDescription>
            {activeRole === "driver"
              ? "Only trips assigned to you by Admin are visible here — complete Pre-Check to start and Post-Check to finish."
              : activeRole === "employee"
                ? "Track your personal trip requests from Admin driver assignment through live ride completion."
                : "User requests trip → Admin assigns Driver & Vehicle → Driver starts (Pre-Check) → Driver finishes (Post-Check)."}
          </CardDescription>
        </div>

        {canRequest ? (
          <Button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="h-10 gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Request a Trip
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["pending", "Pending Review"],
              ["assigned", "Assigned"],
              ["in_progress", "In Progress"],
              ["completed", "Completed"],
              ["rejected", "Rejected"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatusFilter(key);
                pagination.setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{label}</span>
              <span className="fp-telemetry rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-bold">
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No trip requests in this category.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester &amp; Schedule</TableHead>
                    <TableHead>Route &amp; Purpose</TableHead>
                    <TableHead>Assigned Driver &amp; Vehicle</TableHead>
                    <TableHead>Lifecycle Progress</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((b) => {
                    const veh = b.vehicleId
                      ? vehiclesById.get(b.vehicleId)
                      : undefined;
                    const drv = b.driverId
                      ? driversById.get(b.driverId)
                      : undefined;
                    const meta = STATUS_META[b.status] ?? STATUS_META.pending;
                    const isMyAssignedTrip =
                      activeRole !== "driver" ||
                      !currentDriverId ||
                      b.driverId === currentDriverId;

                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {b.requesterName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(b.requestedDate)}
                            {b.requestedTime ? ` · ${b.requestedTime}` : ""}
                            {b.department ? ` · ${b.department}` : ""}
                          </p>
                        </TableCell>

                        <TableCell className="max-w-65">
                          <p className="truncate font-medium text-foreground">
                            {b.purpose}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0 text-primary" />
                            <span>
                              {b.pickupLocation ?? "Central Hub"} →{" "}
                              {b.dropoffLocation ?? b.purpose}
                            </span>
                          </p>
                          <p className="fp-telemetry text-[11px] text-muted-foreground">
                            Est. {b.estimatedKm} km
                            {b.passengerCount ? ` · ${b.passengerCount} pax` : ""}
                          </p>
                        </TableCell>

                        <TableCell className="text-xs">
                          {drv && veh ? (
                            <>
                              <p className="font-semibold text-foreground">
                                {drv.name}
                              </p>
                              <p className="text-muted-foreground">
                                {veh.name} ({veh.plate})
                              </p>
                              {b.assignedBy ? (
                                <p className="text-[10px] text-muted-foreground">
                                  Assigned by {b.assignedBy}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="italic text-muted-foreground">
                              Awaiting Admin assignment
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1.5">
                            <Badge variant="outline" className={meta.badgeClass}>
                              {meta.label}
                            </Badge>
                            {b.status !== "rejected" ? (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4].map((step) => (
                                  <span
                                    key={step}
                                    className={cn(
                                      "h-1.5 w-6 rounded-full",
                                      step <= meta.step
                                        ? "bg-primary"
                                        : "bg-muted"
                                    )}
                                  />
                                ))}
                              </div>
                            ) : b.rejectionReason ? (
                              <p className="max-w-44 truncate text-[10px] text-rose-500">
                                {b.rejectionReason}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {/* Admin: Assign Driver / Reject */}
                            {b.status === "pending" && canApprove ? (
                              <>
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={() => setAssigningBooking(b)}
                                  className="gap-1 rounded-lg bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Assign Driver
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    rejectBooking(b.id, "Declined by dispatcher");
                                    toast.info("Trip request rejected.");
                                  }}
                                  className="rounded-lg text-destructive hover:bg-destructive/10"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : null}

                            {/* Assigned: Driver Start Trip (Pre-Check) + Admin Reassign */}
                            {b.status === "assigned" ? (
                              <>
                                {canOperate && isMyAssignedTrip ? (
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={() => onStartBooking(b)}
                                    className="gap-1 rounded-lg bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                                  >
                                    <Play className="h-3 w-3" />
                                    Start Trip
                                  </Button>
                                ) : null}
                                {canApprove ? (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setAssigningBooking(b)}
                                    className="rounded-lg"
                                  >
                                    Reassign
                                  </Button>
                                ) : null}
                              </>
                            ) : null}

                            {/* In Progress: Track Live + Driver Finish Trip */}
                            {b.status === "in_progress" ? (
                              <>
                                {b.vehicleId && onTrackVehicle ? (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() => onTrackVehicle(b.vehicleId!)}
                                    className="gap-1 rounded-lg"
                                  >
                                    <Navigation className="h-3 w-3 text-primary" />
                                    Track Live
                                  </Button>
                                ) : null}
                                {canOperate && isMyAssignedTrip && onFinishBooking ? (
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="destructive"
                                    onClick={() => onFinishBooking(b)}
                                    className="gap-1 rounded-lg"
                                  >
                                    <Square className="h-3 w-3" />
                                    Finish Trip
                                  </Button>
                                ) : null}
                              </>
                            ) : null}

                            {/* Completed: View Route Playback */}
                            {b.status === "completed" &&
                            b.tripId &&
                            onViewCompletedTrip ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() => onViewCompletedTrip(b.tripId!)}
                                className="gap-1 rounded-lg"
                              >
                                <Route className="h-3 w-3 text-primary" />
                                View Route
                              </Button>
                            ) : null}

                            {/* Delete / Cancel Pending */}
                            {(canApprove ||
                              (b.status === "pending" &&
                                b.requesterUserId === currentUser?.id)) ? (
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                aria-label="Remove booking"
                                onClick={() => {
                                  removeBooking(b.id);
                                  toast.info("Trip request removed.");
                                }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              itemLabel="trip requests"
            />
          </>
        )}
      </CardContent>

      <RequestTripDialog open={requestOpen} onOpenChange={setRequestOpen} />
      <AssignDriverDialog
        booking={assigningBooking}
        onClose={() => setAssigningBooking(null)}
      />
    </Card>
  );
}
