"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { Sparkline } from "@/components/sparkline";
import {
  VehicleForm,
  type VehicleFormValues,
} from "@/components/vehicle-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatCurrency, formatKm, formatShortDate } from "@/lib/format";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import type { Vehicle, VehicleType } from "@/types";

const VEHICLE_IMAGES: Partial<Record<VehicleType, string>> = {
  Van: "/images/vehicle-van.jpg",
  Sedan: "/images/vehicle-sedan.jpg",
  Pickup: "/images/vehicle-pickup.jpg",
};

export default function VehiclesPage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const activeTripId = useFleetStore((s) => s.activeTripId);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);

  const addVehicle = useFleetStore((s) => s.addVehicle);
  const updateVehicle = useFleetStore((s) => s.updateVehicle);
  const removeVehicle = useFleetStore((s) => s.removeVehicle);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);

  const activeTripVehicleId = useMemo(() => {
    const activeTrip = trips.find(
      (t) => t.id === activeTripId && t.status !== "done"
    );
    return activeTrip?.vehicleId ?? null;
  }, [trips, activeTripId]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const handleAdd = (values: VehicleFormValues) => {
    const created = addVehicle(values);
    setAddOpen(false);
    toast.success(`Added ${created.name} (${created.plate}).`);
  };

  const handleEdit = (values: VehicleFormValues) => {
    if (!editingVehicle) return;
    updateVehicle(editingVehicle.id, values);
    toast.success(`Updated ${values.name}.`);
    setEditingVehicle(null);
  };

  const handleDelete = () => {
    if (!deletingVehicle) return;
    const res = removeVehicle(deletingVehicle.id);
    if (!res.ok) {
      toast.error(res.error ?? "Unable to delete vehicle.");
    } else {
      toast.success(`Deleted ${deletingVehicle.name}.`);
    }
    setDeletingVehicle(null);
  };

  const detailsFuelLogs = detailsVehicle
    ? fuelLogs
        .filter((f) => f.vehicleId === detailsVehicle.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const detailsEfficiency = computeFuelEfficiency(detailsFuelLogs);
  const detailsAvgEfficiency = getAverageEfficiency(detailsEfficiency);

  const detailsMaintenance = detailsVehicle
    ? maintenanceRecords.filter((m) => m.vehicleId === detailsVehicle.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Vehicles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage fleet vehicles, odometer totals, fuel efficiency, and service
            alerts.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add vehicle
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search vehicles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, plate, or type..."
          className="h-10 rounded-xl pl-10"
        />
      </div>

      {/* Vehicle grid */}
      {filteredVehicles.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-[var(--brand-teal)]">
              <Car className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-medium text-foreground">
              {vehicles.length === 0
                ? "No vehicles in your fleet"
                : "No vehicles match your search"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {vehicles.length === 0
                ? "Add your first vehicle to begin tracking GPS trips, fuel logs, and maintenance."
                : "Try a different plate number, vehicle name, or type."}
            </p>
            {vehicles.length === 0 ? (
              <Button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-4 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add vehicle
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const inTrip = activeTripVehicleId === vehicle.id;
            const imgSrc = VEHICLE_IMAGES[vehicle.type];

            const vehicleMaint = maintenanceRecords.filter(
              (m) => m.vehicleId === vehicle.id && !m.completedDate
            );
            const hasOverdue = vehicleMaint.some(
              (m) => getMaintenanceStatus(m, vehicle.odometerKm) === "overdue"
            );
            const hasDueSoon =
              !hasOverdue &&
              vehicleMaint.some(
                (m) =>
                  getMaintenanceStatus(m, vehicle.odometerKm) === "due_soon"
              );

            return (
              <StaggerItem key={vehicle.id} hoverLift>
                <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-border bg-card">
                <div className="relative h-36 w-full overflow-hidden border-b border-border bg-[#12202f]">
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={`${vehicle.name} (${vehicle.type})`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#0c1d2b]">
                      <Car className="h-12 w-12 text-[#22d3ee]/70" />
                    </div>
                  )}

                  <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1.5">
                    <Badge
                      className={
                        inTrip
                          ? "border-[var(--brand-amber)]/40 bg-[#07131c]/85 text-[#f59e0b] backdrop-blur-sm"
                          : "border-[#22d3ee]/30 bg-[#07131c]/80 text-[#22d3ee] backdrop-blur-sm"
                      }
                    >
                      {inTrip ? "In trip" : "Available"}
                    </Badge>
                    {hasOverdue ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Service overdue
                      </Badge>
                    ) : hasDueSoon ? (
                      <Badge className="gap-1 border-[#ffb020]/40 bg-[#ffb020]/20 text-[#ffb020]">
                        <Wrench className="h-3 w-3" />
                        Service due soon
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {vehicle.name}
                      </CardTitle>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {vehicle.plate} · {vehicle.type}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-3">
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
                      Odometer
                    </span>
                    <span className="font-display text-sm font-semibold text-foreground">
                      {formatKm(vehicle.odometerKm)} km
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setDetailsVehicle(vehicle)}
                    className="rounded-xl"
                  >
                    Fuel &amp; service
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Edit ${vehicle.name}`}
                      onClick={() => setEditingVehicle(vehicle)}
                      className="rounded-lg"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {inTrip ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="inline-flex" tabIndex={0} />
                          }
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled
                            aria-label={`Cannot delete ${vehicle.name} while in a trip`}
                            className="rounded-lg text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          End the active trip before deleting this vehicle.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Delete ${vehicle.name}`}
                        onClick={() => setDeletingVehicle(vehicle)}
                        className="rounded-lg text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {/* Add vehicle dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
            <DialogDescription>
              Register a vehicle in your local fleet store.
            </DialogDescription>
          </DialogHeader>
          <VehicleForm
            submitLabel="Add vehicle"
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit vehicle dialog */}
      <Dialog
        open={editingVehicle !== null}
        onOpenChange={(open) => {
          if (!open) setEditingVehicle(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
            <DialogDescription>
              Update vehicle details and current odometer reading.
            </DialogDescription>
          </DialogHeader>
          {editingVehicle ? (
            <VehicleForm
              key={editingVehicle.id}
              initialValues={{
                name: editingVehicle.name,
                plate: editingVehicle.plate,
                type: editingVehicle.type,
                odometerKm: editingVehicle.odometerKm,
              }}
              submitLabel="Save changes"
              onSubmit={handleEdit}
              onCancel={() => setEditingVehicle(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingVehicle !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingVehicle(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deletingVehicle?.name} ({deletingVehicle?.plate})
              </span>{" "}
              along with its fuel logs and maintenance schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              Delete vehicle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-vehicle Fuel & Maintenance details dialog */}
      <Dialog
        open={detailsVehicle !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsVehicle(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {detailsVehicle?.name} ({detailsVehicle?.plate})
            </DialogTitle>
            <DialogDescription>
              {detailsVehicle?.type} · Odometer{" "}
              {detailsVehicle ? formatKm(detailsVehicle.odometerKm) : "0.00"} km
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="fuel" className="mt-2">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="fuel" className="rounded-lg">
                <Fuel className="mr-1.5 h-3.5 w-3.5" />
                Fuel logs ({detailsFuelLogs.length})
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg">
                <Wrench className="mr-1.5 h-3.5 w-3.5" />
                Maintenance ({detailsMaintenance.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fuel" className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Average efficiency
                  </p>
                  <p className="font-display text-xl font-semibold text-foreground">
                    {detailsAvgEfficiency !== null
                      ? `${detailsAvgEfficiency} km/L`
                      : "N/A"}
                  </p>
                </div>
                <Link href="/fuel" onClick={() => setDetailsVehicle(null)}>
                  <Button size="sm" variant="outline" className="rounded-xl">
                    Open fuel logs
                  </Button>
                </Link>
              </div>

              <Sparkline
                values={detailsEfficiency.map((p) => p.kmPerLiter)}
                labels={detailsEfficiency.map((p) => formatShortDate(p.date))}
              />

              {detailsFuelLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No fuel logs recorded for this vehicle yet.
                </p>
              ) : (
                <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {detailsFuelLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {formatShortDate(log.date)} · {log.liters} L
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Odometer {formatKm(log.odometerKm)} km ·{" "}
                          {log.fullTank ? "Full tank" : "Partial fill"}
                        </p>
                      </div>
                      <span className="font-medium text-foreground">
                        {formatCurrency(log.totalCost)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Link
                  href="/maintenance"
                  onClick={() => setDetailsVehicle(null)}
                >
                  <Button size="sm" variant="outline" className="rounded-xl">
                    Manage maintenance
                  </Button>
                </Link>
              </div>
              {detailsMaintenance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No maintenance records scheduled for this vehicle.
                </p>
              ) : (
                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {detailsMaintenance.map((rec) => {
                    const status = getMaintenanceStatus(
                      rec,
                      detailsVehicle?.odometerKm ?? 0
                    );
                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {rec.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rec.type}
                            {rec.scheduledDate
                              ? ` · Due ${formatShortDate(rec.scheduledDate)}`
                              : ""}
                            {rec.dueOdometerKm
                              ? ` · ${rec.dueOdometerKm.toLocaleString("en-US")} km`
                              : ""}
                          </p>
                        </div>
                        <Badge
                          variant={
                            status === "overdue" ? "destructive" : "secondary"
                          }
                          className={
                            status === "due_soon"
                              ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                              : ""
                          }
                        >
                          {status === "due_soon"
                            ? "Due soon"
                            : status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
