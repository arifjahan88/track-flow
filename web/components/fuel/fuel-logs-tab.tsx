"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Fuel,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SinglePhotoUpload } from "@/components/photo-upload";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, formatKm, formatShortDate, toIsoDate } from "@/lib/format";
import { kmPerLiterToMpg, type FuelAnomaly } from "@/lib/fuel";
import type { FuelLog } from "@/types";

const ALL_TANKS = "__all_tanks__";

const TANK_FILTER_ITEMS: Record<string, string> = {
  [ALL_TANKS]: "All tank types",
  full: "Full tank",
  partial: "Partial fill",
  anomalies: "Anomalies only",
};

interface FuelFormState {
  vehicleId: string;
  date: string;
  station: string;
  liters: string;
  pricePerLiter: string;
  odometerKm: string;
  fullTank: boolean;
  receiptPhotoDataUrl?: string;
}

interface FuelLogsTabProps {
  vehicleFilter: string;
  allVehiclesSentinel: string;
  unit: "kml" | "mpg";
  canWrite: boolean;
  tankFilter: string;
  onTankFilterChange: (val: string) => void;
  efficiencyByLogId: ReadonlyMap<string, number>;
  anomaliesByLogId: ReadonlyMap<string, FuelAnomaly[]>;
  onPreviewReceipt: (url: string) => void;
}

export function FuelLogsTab({
  vehicleFilter,
  allVehiclesSentinel,
  unit,
  canWrite,
  tankFilter,
  onTankFilterChange,
  efficiencyByLogId,
  anomaliesByLogId,
  onPreviewReceipt,
}: FuelLogsTabProps) {
  const vehicles = useFleetStore((s) => s.vehicles);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const addFuelLog = useFleetStore((s) => s.addFuelLog);
  const updateFuelLog = useFleetStore((s) => s.updateFuelLog);
  const removeFuelLog = useFleetStore((s) => s.removeFuelLog);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FuelLog | null>(null);
  const [form, setForm] = useState<FuelFormState>({
    vehicleId: "",
    date: "",
    station: "",
    liters: "40",
    pricePerLiter: "1.25",
    odometerKm: "0",
    fullTank: true,
  });
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fuelLogs
      .filter((l) => {
        if (vehicleFilter !== allVehiclesSentinel && l.vehicleId !== vehicleFilter) {
          return false;
        }
        if (tankFilter === "full" && !l.fullTank) return false;
        if (tankFilter === "partial" && l.fullTank) return false;
        if (tankFilter === "anomalies" && !anomaliesByLogId.has(l.id)) return false;
        const logDay = l.date.slice(0, 10);
        if (fromDate && logDay < fromDate) return false;
        if (toDate && logDay > toDate) return false;
        if (q) {
          const vehicle = vehiclesById.get(l.vehicleId);
          const hay =
            `${vehicle?.name ?? ""} ${vehicle?.plate ?? ""} ${l.station ?? ""} ${l.date}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    fuelLogs,
    vehicleFilter,
    allVehiclesSentinel,
    tankFilter,
    fromDate,
    toDate,
    search,
    vehiclesById,
    anomaliesByLogId,
  ]);

  const pagination = usePagination(filteredLogs, 10);

  const hasFilters =
    tankFilter !== ALL_TANKS || search.trim() !== "" || fromDate !== "" || toDate !== "";

  const clearFilters = () => {
    onTankFilterChange(ALL_TANKS);
    setSearch("");
    setFromDate("");
    setToDate("");
    pagination.setPage(1);
  };

  const formatEff = (kml: number) =>
    unit === "mpg" ? `${kmPerLiterToMpg(kml)} MPG` : `${kml} km/L`;

  const openAddDialog = () => {
    const initialVehicle =
      vehicleFilter !== allVehiclesSentinel ? vehiclesById.get(vehicleFilter) : vehicles[0];
    setEditingLog(null);
    setError(null);
    setForm({
      vehicleId: initialVehicle?.id ?? "",
      date: toIsoDate(),
      station: "",
      liters: "40",
      pricePerLiter: "1.25",
      odometerKm: String(Math.round(initialVehicle?.odometerKm ?? 0)),
      fullTank: true,
      receiptPhotoDataUrl: undefined,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (log: FuelLog) => {
    setEditingLog(log);
    setError(null);
    setForm({
      vehicleId: log.vehicleId,
      date: log.date,
      station: log.station ?? "",
      liters: String(log.liters),
      pricePerLiter: String(log.pricePerLiter),
      odometerKm: String(log.odometerKm),
      fullTank: log.fullTank,
      receiptPhotoDataUrl: log.receiptPhotoDataUrl,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const liters = Number(form.liters);
    const pricePerLiter = Number(form.pricePerLiter);
    const odometerKm = Number(form.odometerKm);

    if (!form.vehicleId) return setError("Select a vehicle.");
    if (!form.date) return setError("Enter a fill-up date.");
    if (Number.isNaN(liters) || liters <= 0) return setError("Liters must be greater than 0.");
    if (Number.isNaN(pricePerLiter) || pricePerLiter < 0)
      return setError("Price per liter must be 0 or greater.");
    if (Number.isNaN(odometerKm) || odometerKm < 0)
      return setError("Odometer must be 0 or greater.");

    const payload = {
      vehicleId: form.vehicleId,
      date: form.date,
      station: form.station.trim() || undefined,
      liters,
      pricePerLiter,
      totalCost: Number((liters * pricePerLiter).toFixed(2)),
      odometerKm,
      fullTank: form.fullTank,
      receiptPhotoDataUrl: form.receiptPhotoDataUrl,
    };

    const veh = vehiclesById.get(form.vehicleId);
    if (veh?.tankCapacityLiters && liters > veh.tankCapacityLiters) {
      toast.warning(
        `Anomaly flagged: ${liters} L exceeds ${veh.name}'s ${veh.tankCapacityLiters} L tank capacity!`,
      );
    }

    if (editingLog) {
      updateFuelLog(editingLog.id, payload);
      toast.success("Fuel log updated.");
    } else {
      addFuelLog(payload);
      toast.success("Fuel log added.");
    }
    setDialogOpen(false);
  };

  const computedTotalCost =
    Math.max(0, Number(form.liters) || 0) * Math.max(0, Number(form.pricePerLiter) || 0);

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Fill-up history</CardTitle>
              <CardDescription>
                Includes station details, receipt uploads, and automatic leak/theft anomaly
                detection.
              </CardDescription>
            </div>
            {canWrite ? (
              <Button
                type="button"
                onClick={openAddDialog}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Log fuel
              </Button>
            ) : null}
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
                placeholder="Search vehicle, plate, or station..."
                className="pl-10"
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                value={tankFilter}
                items={TANK_FILTER_ITEMS}
                onValueChange={(value) => {
                  if (value) {
                    onTankFilterChange(value);
                    pagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger aria-label="Filter by tank type" className="w-full">
                  <SelectValue placeholder="All tank types" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TANK_FILTER_ITEMS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
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
              {hasFilters ? (
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
              <Fuel className="h-8 w-8 text-brand-teal" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {hasFilters ? "No fuel logs match your filters" : "No fuel logs yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle / Station</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Odometer</TableHead>
                      <TableHead>Tank / Flags</TableHead>
                      <TableHead className="text-right">Efficiency</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((log) => {
                      const vehicle = vehiclesById.get(log.vehicleId);
                      const eff = efficiencyByLogId.get(log.id);
                      const logAnomalies = anomaliesByLogId.get(log.id) ?? [];
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatShortDate(log.date)}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{vehicle?.name ?? "Unknown"}</p>
                            {log.station ? (
                              <p className="text-xs text-muted-foreground">{log.station}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">{log.liters.toFixed(1)} L</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(log.totalCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatKm(log.odometerKm)} km
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                variant={log.fullTank ? "secondary" : "outline"}
                                className="rounded-lg"
                              >
                                {log.fullTank ? "Full" : "Partial"}
                              </Badge>
                              {logAnomalies.map((a, idx) => (
                                <Badge
                                  key={idx}
                                  variant="destructive"
                                  className="gap-1 rounded-lg"
                                  title={a.message}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {a.type === "over_capacity" ? "Over tank" : "Eff drop"}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {eff !== undefined ? (
                              <Badge className="rounded-lg border-(--brand-teal)/30 bg-(--brand-teal)/15 text-brand-teal">
                                {formatEff(eff)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              {log.receiptPhotoDataUrl ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="View receipt"
                                  onClick={() => onPreviewReceipt(log.receiptPhotoDataUrl ?? "")}
                                >
                                  <Receipt className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              ) : null}
                              {canWrite ? (
                                <>
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
                                </>
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
            <DialogTitle>{editingLog ? "Edit fuel log" : "Add fuel log"}</DialogTitle>
            <DialogDescription>
              Total cost and tank-capacity anomaly alerts are computed automatically.
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
                      !editingLog && veh ? String(Math.round(veh.odometerKm)) : prev.odometerKm,
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

            <div className="space-y-2">
              <Label htmlFor="fuel-station">Fuel station (optional)</Label>
              <Input
                id="fuel-station"
                value={form.station}
                onChange={(e) => setForm((prev) => ({ ...prev, station: e.target.value }))}
                placeholder="Gulshan Ave Filling Station"
              />
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
                  onChange={(e) => setForm((prev) => ({ ...prev, odometerKm: e.target.value }))}
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
                  onChange={(e) => setForm((prev) => ({ ...prev, liters: e.target.value }))}
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
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Receipt photo (optional)</Label>
              <SinglePhotoUpload
                value={form.receiptPhotoDataUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, receiptPhotoDataUrl: url }))}
                label="Upload fuel receipt"
              />
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
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, fullTank: checked }))}
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
              <Button type="submit" className="rounded-xl">
                {editingLog ? "Save changes" : "Add fuel log"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
              This permanently removes this fill-up entry from your browser storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deletingLog) return;
                removeFuelLog(deletingLog.id);
                toast.success("Fuel log removed.");
                setDeletingLog(null);
              }}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
