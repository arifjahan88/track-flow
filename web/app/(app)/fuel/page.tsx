"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Fuel, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Sparkline } from "@/components/sparkline";
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
  CardDescription,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatCurrency, formatKm, formatShortDate } from "@/lib/format";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import type { FuelLog } from "@/types";

const ALL_VEHICLES = "__all__";

interface FuelFormState {
  vehicleId: string;
  date: string;
  liters: string;
  pricePerLiter: string;
  odometerKm: string;
  fullTank: boolean;
}

function defaultFormState(vehicleId: string, odometerKm: number): FuelFormState {
  return {
    vehicleId,
    date: new Date().toISOString().slice(0, 10),
    liters: "40",
    pricePerLiter: "1.25",
    odometerKm: String(Math.round(odometerKm)),
    fullTank: true,
  };
}

export default function FuelPage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const addFuelLog = useFleetStore((s) => s.addFuelLog);
  const updateFuelLog = useFleetStore((s) => s.updateFuelLog);
  const removeFuelLog = useFleetStore((s) => s.removeFuelLog);

  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FuelLog | null>(null);
  const [form, setForm] = useState<FuelFormState>(() =>
    defaultFormState(vehicles[0]?.id ?? "", vehicles[0]?.odometerKm ?? 0)
  );
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const filteredLogs = useMemo(() => {
    const list =
      vehicleFilter === ALL_VEHICLES
        ? fuelLogs
        : fuelLogs.filter((l) => l.vehicleId === vehicleFilter);
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [fuelLogs, vehicleFilter]);

  // Compute per-vehicle efficiency points so intervals never mix vehicles
  const efficiencyPoints = useMemo(() => {
    if (vehicleFilter !== ALL_VEHICLES) {
      return computeFuelEfficiency(filteredLogs);
    }
    const grouped = new Map<string, FuelLog[]>();
    for (const log of fuelLogs) {
      const arr = grouped.get(log.vehicleId) ?? [];
      arr.push(log);
      grouped.set(log.vehicleId, arr);
    }
    return Array.from(grouped.values())
      .flatMap((logs) => computeFuelEfficiency(logs))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [fuelLogs, filteredLogs, vehicleFilter]);

  const efficiencyByLogId = useMemo(
    () => new Map(efficiencyPoints.map((p) => [p.logId, p.kmPerLiter])),
    [efficiencyPoints]
  );

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const totalSpend = filteredLogs.reduce((sum, l) => sum + l.totalCost, 0);
  const totalLiters = filteredLogs.reduce((sum, l) => sum + l.liters, 0);
  const avgEfficiency = getAverageEfficiency(efficiencyPoints);

  const openAddDialog = () => {
    const initialVehicle =
      vehicleFilter !== ALL_VEHICLES
        ? vehiclesById.get(vehicleFilter)
        : vehicles[0];
    setEditingLog(null);
    setError(null);
    setForm(
      defaultFormState(initialVehicle?.id ?? "", initialVehicle?.odometerKm ?? 0)
    );
    setDialogOpen(true);
  };

  const openEditDialog = (log: FuelLog) => {
    setEditingLog(log);
    setError(null);
    setForm({
      vehicleId: log.vehicleId,
      date: log.date,
      liters: String(log.liters),
      pricePerLiter: String(log.pricePerLiter),
      odometerKm: String(log.odometerKm),
      fullTank: log.fullTank,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const liters = Number(form.liters);
    const pricePerLiter = Number(form.pricePerLiter);
    const odometerKm = Number(form.odometerKm);

    if (!form.vehicleId) {
      setError("Select a vehicle.");
      return;
    }
    if (!form.date) {
      setError("Enter a fill-up date.");
      return;
    }
    if (Number.isNaN(liters) || liters <= 0) {
      setError("Liters must be greater than 0.");
      return;
    }
    if (Number.isNaN(pricePerLiter) || pricePerLiter < 0) {
      setError("Price per liter must be 0 or greater.");
      return;
    }
    if (Number.isNaN(odometerKm) || odometerKm < 0) {
      setError("Odometer must be 0 or greater.");
      return;
    }

    const payload = {
      vehicleId: form.vehicleId,
      date: form.date,
      liters,
      pricePerLiter,
      totalCost: Number((liters * pricePerLiter).toFixed(2)),
      odometerKm,
      fullTank: form.fullTank,
    };

    if (editingLog) {
      updateFuelLog(editingLog.id, payload);
      toast.success("Fuel log updated.");
    } else {
      addFuelLog(payload);
      toast.success("Fuel log added.");
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingLog) return;
    removeFuelLog(deletingLog.id);
    toast.success("Fuel log removed.");
    setDeletingLog(null);
  };

  const computedTotalCost =
    Math.max(0, Number(form.liters) || 0) *
    Math.max(0, Number(form.pricePerLiter) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Fuel logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track fill-ups, fuel spend, and full-tank efficiency trends in km/L.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={vehicleFilter}
            onValueChange={(value) => {
              if (value) setVehicleFilter(value);
            }}
          >
            <SelectTrigger
              aria-label="Filter fuel logs by vehicle"
              className="h-10 w-48 rounded-xl"
            >
              <SelectValue placeholder="All vehicles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({v.plate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            onClick={openAddDialog}
            disabled={vehicles.length === 0}
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Log fuel
          </Button>
        </div>
      </div>

      {/* Summary KPIs + Sparkline */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Total fuel spend</CardDescription>
            <CardTitle className="font-display text-2xl">
              {formatCurrency(totalSpend)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalLiters.toFixed(1)} liters across {filteredLogs.length} fill-ups
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Average efficiency</CardDescription>
            <CardTitle className="font-display text-2xl">
              {avgEfficiency !== null ? `${avgEfficiency} km/L` : "N/A"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Computed between consecutive full-tank fill-ups
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Efficiency trend</CardDescription>
            <TrendingUp className="h-4 w-4 text-[var(--brand-teal)]" />
          </CardHeader>
          <CardContent>
            <Sparkline
              values={efficiencyPoints.map((p) => p.kmPerLiter)}
              labels={efficiencyPoints.map((p) => formatShortDate(p.date))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Fuel log table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Fill-up history</CardTitle>
          <CardDescription>
            Full-tank logs display the calculated km/L for the interval since
            the previous full tank.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <Fuel className="h-8 w-8 text-[var(--brand-teal)]" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No fuel logs yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Record your first fill-up to start tracking fuel spend and km/L
                efficiency.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Liters</TableHead>
                    <TableHead className="text-right">Price / L</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead>Tank</TableHead>
                    <TableHead className="text-right">Efficiency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const vehicle = vehiclesById.get(log.vehicleId);
                    const eff = efficiencyByLogId.get(log.id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatShortDate(log.date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {vehicle?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.liters.toFixed(1)} L
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(log.pricePerLiter)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(log.totalCost)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatKm(log.odometerKm)} km
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.fullTank ? "secondary" : "outline"}
                            className="rounded-lg"
                          >
                            {log.fullTank ? "Full" : "Partial"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {eff !== undefined ? (
                            <Badge className="rounded-lg border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]">
                              {eff} km/L
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Edit fuel log"
                              onClick={() => openEditDialog(log)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete fuel log"
                              onClick={() => setDeletingLog(log)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Fuel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLog ? "Edit fuel log" : "Add fuel log"}
            </DialogTitle>
            <DialogDescription>
              Total cost is calculated automatically from liters and unit price.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fuel-vehicle">Vehicle</Label>
              <Select
                value={form.vehicleId}
                onValueChange={(value) => {
                  if (!value) return;
                  const veh = vehiclesById.get(value);
                  setForm((prev) => ({
                    ...prev,
                    vehicleId: value,
                    odometerKm:
                      !editingLog && veh
                        ? String(Math.round(veh.odometerKm))
                        : prev.odometerKm,
                  }));
                }}
              >
                <SelectTrigger
                  id="fuel-vehicle"
                  className="h-10 w-full rounded-xl"
                >
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fuel-date">Date</Label>
                <Input
                  id="fuel-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel-odometer">Odometer (km)</Label>
                <Input
                  id="fuel-odometer"
                  type="number"
                  min={0}
                  step="0.1"
                  required
                  value={form.odometerKm}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, odometerKm: e.target.value }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fuel-liters">Liters</Label>
                <Input
                  id="fuel-liters"
                  type="number"
                  min={0.1}
                  step="0.1"
                  required
                  value={form.liters}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, liters: e.target.value }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel-price">Price per liter</Label>
                <Input
                  id="fuel-price"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.pricePerLiter}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pricePerLiter: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/35 px-3.5 py-2.5">
              <div>
                <Label htmlFor="fuel-full-tank" className="text-sm font-medium">
                  Full tank fill-up
                </Label>
                <p className="text-xs text-muted-foreground">
                  Total cost: {formatCurrency(computedTotalCost)}
                </p>
              </div>
              <Switch
                id="fuel-full-tank"
                checked={form.fullTank}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, fullTank: checked }))
                }
              />
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
                {editingLog ? "Save changes" : "Add fuel log"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingLog !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLog(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fuel log?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this fill-up entry from your browser
              storage.
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
