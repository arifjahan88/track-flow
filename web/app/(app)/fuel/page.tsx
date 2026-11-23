"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Fuel, Pencil, Plus, RotateCcw, Search, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { Sparkline } from "@/components/sparkline";
import { TablePagination, usePagination } from "@/components/table-pagination";
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
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
import {
  formatCurrency,
  formatKm,
  formatShortDate,
  toIsoDate,
} from "@/lib/format";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import type { FuelLog } from "@/types";

const ALL_VEHICLES = "__all__";
const ALL_TANKS = "__all_tanks__";

const TANK_FILTER_ITEMS: Record<string, string> = {
  [ALL_TANKS]: "All tank types",
  full: "Full tank",
  partial: "Partial fill",
};

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
    date: toIsoDate(),
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
  const [tankFilter, setTankFilter] = useState(ALL_TANKS);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FuelLog | null>(null);
  const [form, setForm] = useState<FuelFormState>({
    vehicleId: "",
    date: "",
    liters: "40",
    pricePerLiter: "1.25",
    odometerKm: "0",
    fullTank: true,
  });
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const vehicleFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_VEHICLES]: "All vehicles" };
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = fuelLogs.filter((l) => {
      if (vehicleFilter !== ALL_VEHICLES && l.vehicleId !== vehicleFilter) {
        return false;
      }
      if (tankFilter === "full" && !l.fullTank) return false;
      if (tankFilter === "partial" && l.fullTank) return false;
      const logDay = l.date.slice(0, 10);
      if (fromDate && logDay < fromDate) return false;
      if (toDate && logDay > toDate) return false;
      if (q) {
        const vehicle = vehiclesById.get(l.vehicleId);
        const hay = `${vehicle?.name ?? ""} ${vehicle?.plate ?? ""} ${l.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [fuelLogs, vehicleFilter, tankFilter, fromDate, toDate, search, vehiclesById]);

  const pagination = usePagination(filteredLogs, 10);

  const hasActiveFilters =
    vehicleFilter !== ALL_VEHICLES ||
    tankFilter !== ALL_TANKS ||
    search.trim() !== "" ||
    fromDate !== "" ||
    toDate !== "";

  const clearFilters = () => {
    setVehicleFilter(ALL_VEHICLES);
    setTankFilter(ALL_TANKS);
    setSearch("");
    setFromDate("");
    setToDate("");
    pagination.setPage(1);
  };

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

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <Select
            value={vehicleFilter}
            items={vehicleFilterItems}
            onValueChange={(value) => {
              if (value) {
                setVehicleFilter(value);
                pagination.setPage(1);
              }
            }}
          >
            <SelectTrigger
              aria-label="Filter fuel logs by vehicle"
              className="w-full sm:w-52"
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
            className="h-10 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Log fuel
          </Button>
        </div>
      </div>

      {/* Summary KPIs + Sparkline */}
      <StaggerGrid className="grid gap-4 md:grid-cols-3">
        <StaggerItem>
          <Card className="h-full rounded-2xl">
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
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full rounded-2xl">
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
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full rounded-2xl">
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
        </StaggerItem>
      </StaggerGrid>

      {/* Fuel log table */}
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-lg">Fill-up history</CardTitle>
            <CardDescription>
              Full-tank logs display the calculated km/L for the interval since
              the previous full tank.
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-4">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search fuel logs"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.setPage(1);
                }}
                placeholder="Search vehicle or plate..."
                className="pl-10"
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                value={tankFilter}
                items={TANK_FILTER_ITEMS}
                onValueChange={(value) => {
                  if (value) {
                    setTankFilter(value);
                    pagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger aria-label="Filter by tank type" className="w-full">
                  <SelectValue placeholder="All tank types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TANKS}>All tank types</SelectItem>
                  <SelectItem value="full">Full tank</SelectItem>
                  <SelectItem value="partial">Partial fill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-4">
              <DateRangePicker
                aria-label="Filter fuel logs by date range"
                fromDate={fromDate}
                toDate={toDate}
                onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
                  setFromDate(nextFrom);
                  setToDate(nextTo);
                  pagination.setPage(1);
                }}
                placeholder="Filter by date range"
              />
            </div>

            <div className="flex items-center lg:col-span-1">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  className="h-10 w-full rounded-xl px-2.5"
                  aria-label="Reset filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <Fuel className="h-8 w-8 text-[var(--brand-teal)]" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {hasActiveFilters ? "No fuel logs match your filters" : "No fuel logs yet"}
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting or clearing your vehicle, tank, or date range filters."
                  : "Record your first fill-up to start tracking fuel spend and km/L efficiency."}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl"
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
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
                    {pagination.pageItems.map((log) => {
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
              <TablePagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                totalPages={pagination.totalPages}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                itemLabel="fuel logs"
              />
            </>
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
                items={vehicleSelectItems}
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
                <SelectTrigger id="fuel-vehicle" className="w-full">
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
                <DatePicker
                  id="fuel-date"
                  value={form.date}
                  onChange={(date) => setForm((prev) => ({ ...prev, date }))}
                  placeholder="Select fill-up date"
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
