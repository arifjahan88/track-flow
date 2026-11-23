"use client";

import { useMemo, useState } from "react";
import { Car, Plus, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import {
  LIFECYCLE_STATUS_LABELS,
  VehicleForm,
  type VehicleFormValues,
} from "@/components/vehicle-form";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { VehicleDetailsDialog } from "@/components/vehicles/vehicle-details-dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { COMPLIANCE_DOC_LABELS, getComplianceStatus } from "@/lib/compliance";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { can } from "@/lib/rbac";
import type { Vehicle, VehicleLifecycleStatus } from "@/types";

const ALL_STATUSES = "__all_status__";
const STATUS_FILTER_ITEMS: Record<string, string> = {
  [ALL_STATUSES]: "All statuses",
  ...LIFECYCLE_STATUS_LABELS,
};

export default function VehiclesPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canEditVehicles = can(currentRole, "vehicles:write");
  const canEditCompliance = can(currentRole, "compliance:write");

  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const activeTripId = useFleetStore((s) => s.activeTripId);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);

  const addVehicle = useFleetStore((s) => s.addVehicle);
  const updateVehicle = useFleetStore((s) => s.updateVehicle);
  const setVehicleStatus = useFleetStore((s) => s.setVehicleStatus);
  const removeVehicle = useFleetStore((s) => s.removeVehicle);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
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

  const getEffectiveStatus = (v: Vehicle): VehicleLifecycleStatus =>
    activeTripVehicleId === v.id ? "on_trip" : (v.status ?? "available");

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      const effStatus =
        activeTripVehicleId === v.id ? "on_trip" : (v.status ?? "available");
      if (statusFilter !== ALL_STATUSES && effStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${v.name} ${v.plate} ${v.type} ${v.vin ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vehicles, search, statusFilter, activeTripVehicleId]);

  const complianceAlerts = useMemo(() => {
    if (!hydrated) return [];
    const vehiclesById = new Map(vehicles.map((v) => [v.id, v]));
    return complianceDocs
      .map((doc) => ({
        doc,
        vehicle: vehiclesById.get(doc.vehicleId),
        status: getComplianceStatus(doc.expiryDate),
      }))
      .filter((item) => item.status.level !== "valid")
      .sort((a, b) => a.status.daysRemaining - b.status.daysRemaining);
  }, [hydrated, complianceDocs, vehicles]);

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
    if (!res.ok) toast.error(res.error ?? "Unable to delete vehicle.");
    else toast.success(`Deleted ${deletingVehicle.name}.`);
    setDeletingVehicle(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Vehicle &amp; Asset Registry
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage asset specs, VINs, status lifecycle, compliance vault alerts
            (30/15/7d), fuel, and service schedules.
          </p>
        </div>

        {canEditVehicles ? (
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add vehicle
          </Button>
        ) : null}
      </div>

      {complianceAlerts.length > 0 ? (
        <div className="rounded-2xl border border-[var(--brand-amber)]/35 bg-[var(--brand-amber)]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4 text-[var(--brand-amber)]" />
            Compliance Vault Alerts ({complianceAlerts.length})
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {complianceAlerts.slice(0, 6).map(({ doc, vehicle, status }) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => {
                  if (vehicle) setDetailsVehicle(vehicle);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-1.5 text-xs transition-colors hover:border-primary"
              >
                <span className="font-medium text-foreground">
                  {vehicle?.name ?? "Vehicle"}
                </span>
                <span className="text-muted-foreground">
                  {COMPLIANCE_DOC_LABELS[doc.docType]}
                </span>
                <Badge
                  variant={
                    status.level === "expired" || status.level === "critical_7d"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {status.label}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-7 lg:col-span-5">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search vehicles"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, plate, VIN, make, or model..."
            className="pl-10"
          />
        </div>
        <div className="sm:col-span-5 lg:col-span-3">
          <Select
            value={statusFilter}
            items={STATUS_FILTER_ITEMS}
            onValueChange={(v) => {
              if (v) setStatusFilter(v);
            }}
          >
            <SelectTrigger aria-label="Filter by lifecycle status" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_FILTER_ITEMS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredVehicles.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-[var(--brand-teal)]">
              <Car className="h-6 w-6" />
            </div>
            <p className="mt-3 text-base font-medium text-foreground">
              {vehicles.length === 0
                ? "No vehicles in your fleet"
                : "No vehicles match your filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const inTrip = activeTripVehicleId === vehicle.id;
            const vehicleMaint = maintenanceRecords.filter(
              (m) => m.vehicleId === vehicle.id && !m.completedDate
            );
            const hasOverdue = vehicleMaint.some(
              (m) =>
                getMaintenanceStatus(
                  m,
                  vehicle.odometerKm,
                  undefined,
                  vehicle.engineHours
                ) === "overdue"
            );
            const hasDueSoon =
              !hasOverdue &&
              vehicleMaint.some(
                (m) =>
                  getMaintenanceStatus(
                    m,
                    vehicle.odometerKm,
                    undefined,
                    vehicle.engineHours
                  ) === "due_soon"
              );
            const compAlertCount = complianceDocs
              .filter((c) => c.vehicleId === vehicle.id)
              .filter((c) => getComplianceStatus(c.expiryDate).level !== "valid")
              .length;

            return (
              <StaggerItem key={vehicle.id} hoverLift>
                <VehicleCard
                  vehicle={vehicle}
                  inTrip={inTrip}
                  effectiveStatus={getEffectiveStatus(vehicle)}
                  hasOverdue={hasOverdue}
                  hasDueSoon={hasDueSoon}
                  complianceAlertCount={compAlertCount}
                  canEdit={canEditVehicles}
                  onStatusChange={(next) => {
                    setVehicleStatus(vehicle.id, next);
                    toast.success(
                      `${vehicle.name} marked ${LIFECYCLE_STATUS_LABELS[next]}.`
                    );
                  }}
                  onOpenDetails={() => setDetailsVehicle(vehicle)}
                  onEdit={() => setEditingVehicle(vehicle)}
                  onDelete={() => setDeletingVehicle(vehicle)}
                />
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
            <DialogDescription>
              Register full vehicle specifications, lifecycle status, and TCO
              baselines.
            </DialogDescription>
          </DialogHeader>
          <VehicleForm
            submitLabel="Add vehicle"
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingVehicle !== null}
        onOpenChange={(open) => {
          if (!open) setEditingVehicle(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
            <DialogDescription>
              Update specifications, odometer, engine hours, and lifecycle
              state.
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
                vin: editingVehicle.vin,
                make: editingVehicle.make,
                model: editingVehicle.model,
                year: editingVehicle.year,
                fuelType: editingVehicle.fuelType,
                engineCapacityCc: editingVehicle.engineCapacityCc,
                tankCapacityLiters: editingVehicle.tankCapacityLiters,
                engineHours: editingVehicle.engineHours,
                status: editingVehicle.status,
                purchaseCost: editingVehicle.purchaseCost,
                monthlyDepreciation: editingVehicle.monthlyDepreciation,
              }}
              submitLabel="Save changes"
              onSubmit={handleEdit}
              onCancel={() => setEditingVehicle(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

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
              along with its compliance vault, fuel logs, and maintenance
              records.
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

      <VehicleDetailsDialog
        vehicle={detailsVehicle}
        canEditCompliance={canEditCompliance}
        onClose={() => setDetailsVehicle(null)}
      />
    </div>
  );
}
