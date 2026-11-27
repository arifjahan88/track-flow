"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, Truck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFleetStore } from "@/store/fleet-store";
import { checkDriverAvailability, computeDriverSafetyScore } from "@/lib/drivers";
import { formatShortDate } from "@/lib/format";
import type { TripBooking } from "@/types";
import { cn } from "@/lib/utils";

interface AssignDriverDialogProps {
  booking: TripBooking | null;
  onClose: () => void;
}

export function AssignDriverDialog({ booking, onClose }: AssignDriverDialogProps) {
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const assignBooking = useFleetStore((s) => s.assignBooking);

  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [dispatchNotes, setDispatchNotes] = useState<string>("");

  const effectiveDriverId = useMemo(() => {
    if (selectedDriverId && drivers.some((d) => d.id === selectedDriverId)) {
      return selectedDriverId;
    }
    if (booking?.driverId && drivers.some((d) => d.id === booking.driverId)) {
      return booking.driverId;
    }
    const freeDriver = booking
      ? drivers.find(
          (d) => checkDriverAvailability(d, booking.requestedDate, trips).available
        )
      : undefined;
    return freeDriver?.id ?? drivers[0]?.id ?? "";
  }, [selectedDriverId, booking, drivers, trips]);

  const effectiveVehicleId = useMemo(() => {
    if (selectedVehicleId && vehicles.some((v) => v.id === selectedVehicleId)) {
      return selectedVehicleId;
    }
    if (booking?.vehicleId && vehicles.some((v) => v.id === booking.vehicleId)) {
      return booking.vehicleId;
    }
    const driverDefault = drivers.find((d) => d.id === effectiveDriverId)?.assignedVehicleId;
    const defaultVeh = vehicles.find(
      (v) => v.id === driverDefault && (v.status ?? "available") === "available"
    );
    if (defaultVeh) return defaultVeh.id;
    const firstAvail = vehicles.find((v) => (v.status ?? "available") === "available");
    return firstAvail?.id ?? vehicles[0]?.id ?? "";
  }, [selectedVehicleId, booking, vehicles, drivers, effectiveDriverId]);

  if (!booking) return null;

  const selectedDriver = drivers.find((d) => d.id === effectiveDriverId);
  const selectedDriverAvail = selectedDriver
    ? checkDriverAvailability(selectedDriver, booking.requestedDate, trips)
    : { available: true };

  const handleSelectDriver = (drvId: string) => {
    setSelectedDriverId(drvId);
    const drv = drivers.find((d) => d.id === drvId);
    if (drv?.assignedVehicleId) {
      const assignedVeh = vehicles.find(
        (v) => v.id === drv.assignedVehicleId && (v.status ?? "available") === "available"
      );
      if (assignedVeh) {
        setSelectedVehicleId(assignedVeh.id);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveDriverId || !effectiveVehicleId) {
      toast.error("Select both a driver and an available vehicle.");
      return;
    }

    const res = assignBooking(booking.id, {
      driverId: effectiveDriverId,
      vehicleId: effectiveVehicleId,
      notes: dispatchNotes.trim() || undefined,
      allowQueuedDriver: !selectedDriverAvail.available,
    });

    if (!res.ok) {
      toast.error(res.error ?? "Unable to assign driver.");
      return;
    }

    const drv = drivers.find((d) => d.id === effectiveDriverId);
    const veh = vehicles.find((v) => v.id === effectiveVehicleId);
    toast.success(
      `Assigned ${drv?.name ?? "driver"} (${veh?.plate ?? "vehicle"}) — driver notified to start trip.`
    );
    setSelectedDriverId("");
    setSelectedVehicleId("");
    setDispatchNotes("");
    onClose();
  };

  return (
    <Dialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedDriverId("");
          setSelectedVehicleId("");
          setDispatchNotes("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-4 text-primary" />
            Assign Driver &amp; Vehicle
          </DialogTitle>
          <DialogDescription>
            Review request details and dispatch an available driver &amp; vehicle.
          </DialogDescription>
        </DialogHeader>

        {/* Request Summary Card */}
        <div className="rounded-xl border border-border bg-muted/35 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{booking.purpose}</p>
            <Badge variant="outline" className="fp-telemetry">
              Est. {booking.estimatedKm} km
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Requested by <strong className="text-foreground">{booking.requesterName}</strong>
            {booking.department ? ` (${booking.department})` : ""} ·{" "}
            {formatShortDate(booking.requestedDate)}
            {booking.requestedTime ? ` at ${booking.requestedTime}` : ""}
          </p>
          <p className="mt-1.5 text-foreground">
            <span className="text-muted-foreground">Route:</span>{" "}
            {booking.pickupLocation ?? "Central Hub"} → {booking.dropoffLocation ?? booking.purpose}
          </p>
          {booking.notes ? (
            <p className="mt-1 text-muted-foreground">Note: {booking.notes}</p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Select Driver */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. Choose Driver
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {drivers.map((drv) => {
                const avail = checkDriverAvailability(drv, booking.requestedDate, trips);
                const safety = computeDriverSafetyScore(drv.id, trips);
                const targetDay = booking.requestedDate.slice(0, 10);
                const onLeave = (drv.leaveLogs ?? []).some(
                  (l) => targetDay >= l.fromDate && targetDay <= l.toDate
                );
                const isSelected = effectiveDriverId === drv.id;

                return (
                  <button
                    key={drv.id}
                    type="button"
                    disabled={onLeave}
                    onClick={() => handleSelectDriver(drv.id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {drv.name}
                      </span>
                      <Badge
                        variant={onLeave ? "destructive" : "outline"}
                        className={cn(
                          "px-1.5 py-0 text-[10px]",
                          avail.available
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : !onLeave
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : ""
                        )}
                      >
                        {onLeave ? "On Leave" : avail.available ? "Available" : "Queued"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="size-3 text-primary" />
                        Score {safety.score}/100
                      </span>
                      <span>{drv.phone}</span>
                    </div>
                    {!avail.available ? (
                      <p className="line-clamp-1 text-[10px] text-amber-600 dark:text-amber-400">
                        {avail.reason}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {!selectedDriverAvail.available ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>
                  Note: {selectedDriverAvail.reason}. Assigning queues this trip for{" "}
                  {selectedDriver?.name} once ready.
                </span>
              </div>
            ) : null}
          </div>

          {/* Step 2: Select Vehicle */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              2. Choose Vehicle
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicles.map((veh) => {
                const st = veh.status ?? "available";
                const locked =
                  st === "under_maintenance" ||
                  st === "out_of_service" ||
                  st === "decommissioned";
                const isSelected = effectiveVehicleId === veh.id;

                return (
                  <button
                    key={veh.id}
                    type="button"
                    disabled={locked}
                    onClick={() => setSelectedVehicleId(veh.id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                        <Truck className="size-3.5 text-primary" />
                        {veh.name}
                      </span>
                      <Badge
                        variant={locked ? "destructive" : "outline"}
                        className={cn(
                          "px-1.5 py-0 text-[10px]",
                          st === "available"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : st === "on_trip"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : ""
                        )}
                      >
                        {st === "available"
                          ? "Ready"
                          : st === "on_trip"
                            ? "In Trip"
                            : "Locked"}
                      </Badge>
                    </div>
                    <p className="fp-telemetry text-[11px] text-muted-foreground">
                      {veh.plate} · Fuel {Math.round(veh.fuelLevelPercent ?? 75)}% ·{" "}
                      {Math.round(veh.odometerKm).toLocaleString()} km
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-notes">Dispatcher instructions for driver (optional)</Label>
            <Input
              id="assign-notes"
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="Call requester 10 min before pickup..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <CheckCircle2 className="size-4" />
              Confirm &amp; Assign Driver
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
