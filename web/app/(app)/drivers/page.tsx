"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
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
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { computeDriverStats, getLicenseStatus } from "@/lib/drivers";
import { formatKm, formatShortDate, offsetIsoDate } from "@/lib/format";
import type { Driver } from "@/types";

const UNASSIGNED_VALUE = "__unassigned__";

interface DriverFormState {
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  assignedVehicleId: string;
}

export default function DriversPage() {
  const hydrated = useHydrated();
  const drivers = useFleetStore((s) => s.drivers);
  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);

  const addDriver = useFleetStore((s) => s.addDriver);
  const updateDriver = useFleetStore((s) => s.updateDriver);
  const removeDriver = useFleetStore((s) => s.removeDriver);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState<DriverFormState>({
    name: "",
    phone: "",
    licenseNumber: "",
    licenseExpiry: "",
    assignedVehicleId: UNASSIGNED_VALUE,
  });
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = { [UNASSIGNED_VALUE]: "Unassigned" };
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const openAddDialog = () => {
    setEditingDriver(null);
    setError(null);
    setForm({
      name: "",
      phone: "",
      licenseNumber: "",
      licenseExpiry: offsetIsoDate(180),
      assignedVehicleId: UNASSIGNED_VALUE,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setError(null);
    setForm({
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      licenseExpiry: driver.licenseExpiry,
      assignedVehicleId: driver.assignedVehicleId ?? UNASSIGNED_VALUE,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Driver name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!form.licenseNumber.trim()) {
      setError("License number is required.");
      return;
    }
    if (!form.licenseExpiry) {
      setError("License expiry date is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      licenseNumber: form.licenseNumber.trim().toUpperCase(),
      licenseExpiry: form.licenseExpiry,
      assignedVehicleId:
        form.assignedVehicleId === UNASSIGNED_VALUE
          ? undefined
          : form.assignedVehicleId,
    };

    if (editingDriver) {
      updateDriver(editingDriver.id, payload);
      toast.success(`Updated driver ${payload.name}.`);
    } else {
      addDriver(payload);
      toast.success(`Added driver ${payload.name}.`);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingDriver) return;
    removeDriver(deletingDriver.id);
    toast.success(`Removed driver ${deletingDriver.name}.`);
    setDeletingDriver(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Drivers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage drivers, monitor license expirations, and review per-driver
            trip totals.
          </p>
        </div>

        <Button
          type="button"
          onClick={openAddDialog}
          className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add driver
        </Button>
      </div>

      {drivers.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="h-8 w-8 text-[var(--brand-teal)]" />
            <p className="mt-3 text-base font-medium text-foreground">
              No drivers added yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add drivers to track license expirations and assign them when
              starting trips.
            </p>
            <Button
              type="button"
              onClick={openAddDialog}
              className="mt-4 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add driver
            </Button>
          </CardContent>
        </Card>
      ) : (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const licenseStatus = getLicenseStatus(driver.licenseExpiry);
            const assignedVehicle = driver.assignedVehicleId
              ? vehiclesById.get(driver.assignedVehicleId)
              : undefined;
            const stats = computeDriverStats(driver.id, trips);

            return (
              <StaggerItem key={driver.id} hoverLift>
                <Card className="flex h-full flex-col rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">
                        {driver.name}
                      </CardTitle>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {driver.phone}
                      </p>
                    </div>
                    <Badge
                      variant={
                        licenseStatus === "expired"
                          ? "destructive"
                          : "secondary"
                      }
                      className={
                        licenseStatus === "expiring_soon"
                          ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                          : licenseStatus === "valid"
                            ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                            : ""
                      }
                    >
                      {licenseStatus === "expired"
                        ? "License expired"
                        : licenseStatus === "expiring_soon"
                          ? "Expires within 30d"
                          : "Valid license"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 text-sm">
                  <div className="space-y-1 rounded-xl border border-border/70 bg-muted/35 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License no.</span>
                      <span className="font-mono font-medium text-foreground">
                        {driver.licenseNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expiry</span>
                      <span className="font-medium text-foreground">
                        {formatShortDate(driver.licenseExpiry)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Assigned vehicle
                      </span>
                      <span className="font-medium text-foreground">
                        {assignedVehicle ? assignedVehicle.name : "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                      <p className="font-display text-sm font-semibold text-foreground">
                        {stats.completedTrips}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Trips</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                      <p className="font-display text-sm font-semibold text-foreground">
                        {formatKm(stats.totalDistanceKm)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">km</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                      <p className="font-display text-sm font-semibold text-foreground">
                        {stats.topSpeedKmh}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Max km/h
                      </p>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex justify-end gap-1.5 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Edit ${driver.name}`}
                    onClick={() => openEditDialog(driver)}
                    className="rounded-lg"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Delete ${driver.name}`}
                    onClick={() => setDeletingDriver(driver)}
                    className="rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {/* Add / Edit Driver Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? "Edit driver" : "Add driver"}
            </DialogTitle>
            <DialogDescription>
              Store driver contact details, license expiry, and default vehicle.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Full name</Label>
              <Input
                id="driver-name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Rafiq Hasan"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-phone">Phone number</Label>
              <Input
                id="driver-phone"
                required
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+880 1711-234567"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-license">License number</Label>
                <Input
                  id="driver-license"
                  required
                  value={form.licenseNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      licenseNumber: e.target.value,
                    }))
                  }
                  placeholder="DL-DHK-904821"
                  className="h-10 rounded-xl uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-expiry">License expiry</Label>
                <DatePicker
                  id="driver-expiry"
                  value={form.licenseExpiry}
                  onChange={(licenseExpiry) =>
                    setForm((prev) => ({
                      ...prev,
                      licenseExpiry,
                    }))
                  }
                  placeholder="Select expiry date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-vehicle">
                Assigned vehicle (optional)
              </Label>
              <Select
                value={form.assignedVehicleId}
                items={vehicleSelectItems}
                onValueChange={(value) => {
                  if (value)
                    setForm((prev) => ({ ...prev, assignedVehicleId: value }));
                }}
              >
                <SelectTrigger id="driver-vehicle" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {editingDriver ? "Save changes" : "Add driver"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingDriver !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingDriver(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete driver?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingDriver?.name} from your roster. Completed
              trip records remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
