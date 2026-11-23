"use client";

import { useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  FileCheck2,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { SinglePhotoUpload } from "@/components/photo-upload";
import { Sparkline } from "@/components/sparkline";
import {
  LIFECYCLE_STATUS_LABELS,
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
import { DatePicker } from "@/components/ui/date-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  COMPLIANCE_DOC_LABELS,
  COMPLIANCE_DOC_TYPES,
  getComplianceStatus,
} from "@/lib/compliance";
import {
  formatCurrency,
  formatKm,
  formatShortDate,
  offsetIsoDate,
  toIsoDate,
} from "@/lib/format";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { can } from "@/lib/rbac";
import type {
  ComplianceDocType,
  Vehicle,
  VehicleLifecycleStatus,
  VehicleType,
} from "@/types";

const VEHICLE_IMAGES: Partial<Record<VehicleType, string>> = {
  Van: "/images/vehicle-van.jpg",
  Sedan: "/images/vehicle-sedan.jpg",
  Pickup: "/images/vehicle-pickup.jpg",
};

const ALL_STATUSES = "__all_status__";
const STATUS_FILTER_ITEMS: Record<string, string> = {
  [ALL_STATUSES]: "All statuses",
  ...LIFECYCLE_STATUS_LABELS,
};

function statusBadgeStyle(status: VehicleLifecycleStatus): string {
  switch (status) {
    case "available":
      return "border-[#22d3ee]/30 bg-[#07131c]/80 text-[#22d3ee] backdrop-blur-sm";
    case "on_trip":
      return "border-[var(--brand-amber)]/40 bg-[#07131c]/85 text-[#f59e0b] backdrop-blur-sm";
    case "under_maintenance":
      return "border-amber-500/40 bg-amber-950/85 text-amber-300 backdrop-blur-sm";
    case "out_of_service":
      return "border-destructive/50 bg-destructive/85 text-white backdrop-blur-sm";
    case "decommissioned":
      return "border-border bg-muted/90 text-muted-foreground backdrop-blur-sm";
  }
}

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
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);

  const addVehicle = useFleetStore((s) => s.addVehicle);
  const updateVehicle = useFleetStore((s) => s.updateVehicle);
  const setVehicleStatus = useFleetStore((s) => s.setVehicleStatus);
  const removeVehicle = useFleetStore((s) => s.removeVehicle);
  const addComplianceDoc = useFleetStore((s) => s.addComplianceDoc);
  const removeComplianceDoc = useFleetStore((s) => s.removeComplianceDoc);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [addOpen, setAddOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);

  // Compliance doc form state
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [docType, setDocType] = useState<ComplianceDocType>("insurance");
  const [docNumber, setDocNumber] = useState("");
  const [docIssuer, setDocIssuer] = useState("");
  const [docIssueDate, setDocIssueDate] = useState("");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [docCost, setDocCost] = useState("");
  const [docAttachment, setDocAttachment] = useState<string | undefined>(
    undefined
  );

  const activeTripVehicleId = useMemo(() => {
    const activeTrip = trips.find(
      (t) => t.id === activeTripId && t.status !== "done"
    );
    return activeTrip?.vehicleId ?? null;
  }, [trips, activeTripId]);

  const getEffectiveStatus = (v: Vehicle): VehicleLifecycleStatus => {
    if (activeTripVehicleId === v.id) return "on_trip";
    return v.status ?? "available";
  };

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
    if (!res.ok) {
      toast.error(res.error ?? "Unable to delete vehicle.");
    } else {
      toast.success(`Deleted ${deletingVehicle.name}.`);
    }
    setDeletingVehicle(null);
  };

  const openAddDoc = () => {
    setDocType("insurance");
    setDocNumber("");
    setDocIssuer("");
    setDocIssueDate(toIsoDate());
    setDocExpiryDate(offsetIsoDate(365));
    setDocCost("");
    setDocAttachment(undefined);
    setDocFormOpen(true);
  };

  const handleAddComplianceDoc = (e: FormEvent) => {
    e.preventDefault();
    if (!detailsVehicle) return;
    if (!docNumber.trim() || !docIssuer.trim() || !docExpiryDate) {
      toast.error("Provide document number, issuer, and expiry date.");
      return;
    }
    addComplianceDoc({
      vehicleId: detailsVehicle.id,
      docType,
      documentNumber: docNumber.trim(),
      issuer: docIssuer.trim(),
      issueDate: docIssueDate || toIsoDate(),
      expiryDate: docExpiryDate,
      cost: docCost ? Number(docCost) : undefined,
      attachmentDataUrl: docAttachment,
    });
    toast.success("Compliance document added to vault.");
    setDocFormOpen(false);
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

  const detailsCompliance = detailsVehicle
    ? complianceDocs.filter((c) => c.vehicleId === detailsVehicle.id)
    : [];

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

      {/* Compliance Expiration Alert Strip (30/15/7d) */}
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
                  className={
                    status.level === "warning_15d"
                      ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/20 text-[var(--brand-amber)]"
                      : ""
                  }
                >
                  {status.label}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Search & Status Lifecycle Filter */}
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
                : "No vehicles match your filter"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {vehicles.length === 0
                ? "Add your first vehicle to begin tracking GPS trips, compliance, fuel, and maintenance."
                : "Try a different plate, VIN, or lifecycle status."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => {
            const inTrip = activeTripVehicleId === vehicle.id;
            const effStatus = getEffectiveStatus(vehicle);
            const imgSrc = VEHICLE_IMAGES[vehicle.type];

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

            const vCompAlerts = complianceDocs
              .filter((c) => c.vehicleId === vehicle.id)
              .filter((c) => getComplianceStatus(c.expiryDate).level !== "valid");

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
                      <Badge className={statusBadgeStyle(effStatus)}>
                        {LIFECYCLE_STATUS_LABELS[effStatus]}
                      </Badge>
                      {hasOverdue ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Service overdue
                        </Badge>
                      ) : hasDueSoon ? (
                        <Badge className="gap-1 border-[#ffb020]/40 bg-[#ffb020]/20 text-[#ffb020]">
                          <Wrench className="h-3 w-3" />
                          Due soon
                        </Badge>
                      ) : null}
                      {vCompAlerts.length > 0 ? (
                        <Badge className="gap-1 border-amber-400/40 bg-amber-950/85 text-amber-300">
                          <FileCheck2 className="h-3 w-3" />
                          {vCompAlerts.length} doc alert
                          {vCompAlerts.length > 1 ? "s" : ""}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {vehicle.name}
                      </CardTitle>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {vehicle.plate} · {vehicle.type}
                        {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
                      </p>
                      {vehicle.make || vehicle.model ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[vehicle.year, vehicle.make, vehicle.model]
                            .filter(Boolean)
                            .join(" ")}
                          {vehicle.engineCapacityCc
                            ? ` · ${vehicle.engineCapacityCc} cc`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-2.5 pb-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Gauge className="h-3 w-3 text-[var(--brand-teal)]" />
                          Odometer
                        </span>
                        <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
                          {formatKm(vehicle.odometerKm)} km
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2">
                        <span className="text-[11px] text-muted-foreground">
                          Engine / Tank
                        </span>
                        <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
                          {vehicle.engineHours ?? 0}h ·{" "}
                          {vehicle.tankCapacityLiters ?? 60}L
                        </p>
                      </div>
                    </div>

                    {vehicle.vin ? (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        VIN: {vehicle.vin}
                      </p>
                    ) : null}

                    {canEditVehicles && !inTrip ? (
                      <Select
                        value={effStatus}
                        items={LIFECYCLE_STATUS_LABELS}
                        onValueChange={(next) => {
                          if (!next) return;
                          setVehicleStatus(
                            vehicle.id,
                            next as VehicleLifecycleStatus
                          );
                          toast.success(
                            `${vehicle.name} marked ${LIFECYCLE_STATUS_LABELS[next as VehicleLifecycleStatus]}.`
                          );
                        }}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.entries(LIFECYCLE_STATUS_LABELS) as [
                              VehicleLifecycleStatus,
                              string,
                            ][]
                          )
                            .filter(([k]) => k !== "on_trip")
                            .map(([k, label]) => (
                              <SelectItem key={k} value={k}>
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </CardContent>

                  <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailsVehicle(vehicle)}
                      className="rounded-xl"
                    >
                      Vault &amp; logs
                    </Button>

                    {canEditVehicles ? (
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
                    ) : null}
                  </CardFooter>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {/* Add vehicle dialog */}
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

      {/* Edit vehicle dialog */}
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

      {/* Per-vehicle Vault, Fuel & Maintenance details dialog */}
      <Dialog
        open={detailsVehicle !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsVehicle(null);
            setDocFormOpen(false);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailsVehicle?.name} ({detailsVehicle?.plate})
            </DialogTitle>
            <DialogDescription>
              {[
                detailsVehicle?.year,
                detailsVehicle?.make,
                detailsVehicle?.model,
                detailsVehicle?.fuelType,
              ]
                .filter(Boolean)
                .join(" · ") || detailsVehicle?.type}{" "}
              · Odometer{" "}
              {detailsVehicle ? formatKm(detailsVehicle.odometerKm) : "0.00"} km
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="compliance" className="mt-2">
            <TabsList className="grid w-full grid-cols-3 rounded-xl">
              <TabsTrigger value="compliance" className="rounded-lg">
                <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                Vault ({detailsCompliance.length})
              </TabsTrigger>
              <TabsTrigger value="fuel" className="rounded-lg">
                <Fuel className="mr-1.5 h-3.5 w-3.5" />
                Fuel ({detailsFuelLogs.length})
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg">
                <Wrench className="mr-1.5 h-3.5 w-3.5" />
                Service ({detailsMaintenance.length})
              </TabsTrigger>
            </TabsList>

            {/* COMPLIANCE DOCUMENT VAULT TAB */}
            <TabsContent value="compliance" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Automated expiry alerts at 30, 15, and 7 days prior.
                </p>
                {canEditCompliance ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={openAddDoc}
                    className="rounded-xl"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add document
                  </Button>
                ) : null}
              </div>

              {docFormOpen ? (
                <form
                  onSubmit={handleAddComplianceDoc}
                  className="space-y-3 rounded-xl border border-border bg-muted/25 p-3.5"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Document type</Label>
                      <Select
                        value={docType}
                        items={COMPLIANCE_DOC_LABELS}
                        onValueChange={(val) => {
                          if (val) setDocType(val as ComplianceDocType);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPLIANCE_DOC_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {COMPLIANCE_DOC_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Document / Policy #</Label>
                      <Input
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        placeholder="INS-BD-2026-9001"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Issuer / Authority</Label>
                      <Input
                        value={docIssuer}
                        onChange={(e) => setDocIssuer(e.target.value)}
                        placeholder="BRTA / Green Delta"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Annual cost ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={docCost}
                        onChange={(e) => setDocCost(e.target.value)}
                        placeholder="350"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Issue date</Label>
                      <DatePicker
                        value={docIssueDate}
                        onChange={setDocIssueDate}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expiry date</Label>
                      <DatePicker
                        value={docExpiryDate}
                        onChange={setDocExpiryDate}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Scan / Certificate photo (optional)</Label>
                    <SinglePhotoUpload
                      value={docAttachment}
                      onChange={setDocAttachment}
                      label="Attach document image"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDocFormOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm">
                      Save document
                    </Button>
                  </div>
                </form>
              ) : null}

              {detailsCompliance.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No compliance documents stored for this vehicle yet.
                </p>
              ) : (
                <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {detailsCompliance.map((doc) => {
                    const st = getComplianceStatus(doc.expiryDate);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {COMPLIANCE_DOC_LABELS[doc.docType]}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {doc.documentNumber} · {doc.issuer} · Exp{" "}
                            {formatShortDate(doc.expiryDate)}
                            {doc.cost ? ` · ${formatCurrency(doc.cost)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              st.level === "expired" ||
                              st.level === "critical_7d"
                                ? "destructive"
                                : "secondary"
                            }
                            className={
                              st.level === "warning_15d" ||
                              st.level === "notice_30d"
                                ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                                : st.level === "valid"
                                  ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                                  : ""
                            }
                          >
                            {st.label}
                          </Badge>
                          {canEditCompliance ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Delete document"
                              onClick={() => {
                                removeComplianceDoc(doc.id);
                                toast.success("Document removed.");
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* FUEL TAB */}
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

            {/* MAINTENANCE TAB */}
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
                      detailsVehicle?.odometerKm ?? 0,
                      undefined,
                      detailsVehicle?.engineHours
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
