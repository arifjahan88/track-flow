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
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { SinglePhotoUpload } from "@/components/photo-upload";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  formatCurrency,
  formatKm,
  formatShortDate,
  toIsoDate,
} from "@/lib/format";
import {
  computeFuelEfficiency,
  detectFuelAnomalies,
  getAverageEfficiency,
  kmPerLiterToMpg,
} from "@/lib/fuel";
import { can } from "@/lib/rbac";
import type { ExpenseCategory, FuelLog } from "@/types";

const ALL_VEHICLES = "__all__";
const ALL_TANKS = "__all_tanks__";
const ALL_CATEGORIES = "__all_categories__";
const NO_TRIP = "__no_trip__";

const TANK_FILTER_ITEMS: Record<string, string> = {
  [ALL_TANKS]: "All tank types",
  full: "Full tank",
  partial: "Partial fill",
  anomalies: "Anomalies only",
};

const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "Tolls",
  "Parking",
  "Fines",
  "Driver allowance",
  "Other",
];
const EXPENSE_CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c, c])
);
const EXPENSE_CATEGORY_FILTER_ITEMS: Record<string, string> = {
  [ALL_CATEGORIES]: "All categories",
  ...EXPENSE_CATEGORY_ITEMS,
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

function defaultFormState(vehicleId: string, odometerKm: number): FuelFormState {
  return {
    vehicleId,
    date: toIsoDate(),
    station: "",
    liters: "40",
    pricePerLiter: "1.25",
    odometerKm: String(Math.round(odometerKm)),
    fullTank: true,
    receiptPhotoDataUrl: undefined,
  };
}

export default function FuelPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canLogFuel = can(currentRole, "fuel:write");
  const canLogExpenses = can(currentRole, "expenses:write");

  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const expenses = useFleetStore((s) => s.expenses);
  const addFuelLog = useFleetStore((s) => s.addFuelLog);
  const updateFuelLog = useFleetStore((s) => s.updateFuelLog);
  const removeFuelLog = useFleetStore((s) => s.removeFuelLog);
  const addExpense = useFleetStore((s) => s.addExpense);
  const removeExpense = useFleetStore((s) => s.removeExpense);

  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [tankFilter, setTankFilter] = useState(ALL_TANKS);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [unit, setUnit] = useState<"kml" | "mpg">("kml");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [deletingLog, setDeletingLog] = useState<FuelLog | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);
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

  // Operating Expenses state
  const [expSearch, setExpSearch] = useState("");
  const [expCategoryFilter, setExpCategoryFilter] = useState(ALL_CATEGORIES);
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expTripId, setExpTripId] = useState(NO_TRIP);
  const [expDate, setExpDate] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("Tolls");
  const [expAmount, setExpAmount] = useState("");
  const [expCostCenter, setExpCostCenter] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expReceipt, setExpReceipt] = useState<string | undefined>(undefined);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const tripsById = useMemo(
    () => new Map(trips.map((t) => [t.id, t])),
    [trips]
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

  const tripSelectItems = useMemo(() => {
    const items: Record<string, string> = { [NO_TRIP]: "Not linked to a trip" };
    for (const t of trips.slice(0, 25)) {
      items[t.id] = `${t.purpose} (${t.startedAt.slice(0, 10)})`;
    }
    return items;
  }, [trips]);

  const anomaliesByLogId = useMemo(
    () => detectFuelAnomalies(fuelLogs, vehiclesById),
    [fuelLogs, vehiclesById]
  );

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = fuelLogs.filter((l) => {
      if (vehicleFilter !== ALL_VEHICLES && l.vehicleId !== vehicleFilter) {
        return false;
      }
      if (tankFilter === "full" && !l.fullTank) return false;
      if (tankFilter === "partial" && l.fullTank) return false;
      if (tankFilter === "anomalies" && !anomaliesByLogId.has(l.id))
        return false;
      const logDay = l.date.slice(0, 10);
      if (fromDate && logDay < fromDate) return false;
      if (toDate && logDay > toDate) return false;
      if (q) {
        const vehicle = vehiclesById.get(l.vehicleId);
        const hay = `${vehicle?.name ?? ""} ${vehicle?.plate ?? ""} ${l.station ?? ""} ${l.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    fuelLogs,
    vehicleFilter,
    tankFilter,
    fromDate,
    toDate,
    search,
    vehiclesById,
    anomaliesByLogId,
  ]);

  const pagination = usePagination(filteredLogs, 10);

  const filteredExpenses = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (vehicleFilter !== ALL_VEHICLES && e.vehicleId !== vehicleFilter) {
          return false;
        }
        if (
          expCategoryFilter !== ALL_CATEGORIES &&
          e.category !== expCategoryFilter
        ) {
          return false;
        }
        if (q) {
          const v = vehiclesById.get(e.vehicleId);
          const hay = `${e.description} ${e.category} ${e.costCenter ?? ""} ${v?.name ?? ""} ${v?.plate ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, vehicleFilter, expCategoryFilter, expSearch, vehiclesById]);

  const expensePagination = usePagination(filteredExpenses, 10);

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
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgEfficiency = getAverageEfficiency(efficiencyPoints);
  const anomalyCount = Array.from(anomaliesByLogId.values()).reduce(
    (s, arr) => s + arr.length,
    0
  );

  const formatEff = (kml: number) =>
    unit === "mpg" ? `${kmPerLiterToMpg(kml)} MPG` : `${kml} km/L`;

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
      station: log.station ?? "",
      liters: String(log.liters),
      pricePerLiter: String(log.pricePerLiter),
      odometerKm: String(log.odometerKm),
      fullTank: log.fullTank,
      receiptPhotoDataUrl: log.receiptPhotoDataUrl,
    });
    setDialogOpen(true);
  };

  const openAddExpenseDialog = () => {
    setExpVehicleId(
      vehicleFilter !== ALL_VEHICLES
        ? vehicleFilter
        : vehicles[0]?.id ?? ""
    );
    setExpTripId(NO_TRIP);
    setExpDate(toIsoDate());
    setExpCategory("Tolls");
    setExpAmount("");
    setExpCostCenter("Operations");
    setExpDescription("");
    setExpReceipt(undefined);
    setExpDialogOpen(true);
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
      station: form.station.trim() || undefined,
      liters,
      pricePerLiter,
      totalCost: Number((liters * pricePerLiter).toFixed(2)),
      odometerKm,
      fullTank: form.fullTank,
      receiptPhotoDataUrl: form.receiptPhotoDataUrl,
    };

    const veh = vehiclesById.get(form.vehicleId);
    if (
      veh?.tankCapacityLiters &&
      liters > veh.tankCapacityLiters
    ) {
      toast.warning(
        `Anomaly flagged: ${liters} L exceeds ${veh.name}'s ${veh.tankCapacityLiters} L tank capacity!`
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

  const handleAddExpense = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(expAmount);
    if (!expVehicleId || !expDescription.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error("Provide vehicle, description, and valid amount.");
      return;
    }
    addExpense({
      vehicleId: expVehicleId,
      tripId: expTripId === NO_TRIP ? undefined : expTripId,
      date: expDate || toIsoDate(),
      category: expCategory,
      amount: Number(amount.toFixed(2)),
      costCenter: expCostCenter.trim() || undefined,
      description: expDescription.trim(),
      receiptPhotoDataUrl: expReceipt,
    });
    toast.success("Operating expense logged.");
    setExpDialogOpen(false);
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
            Fuel &amp; Operating Expenses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track fill-ups, receipts, efficiency anomalies (theft/leak
            detection), and trip operating expenses.
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
                expensePagination.setPage(1);
              }
            }}
          >
            <SelectTrigger
              aria-label="Filter fuel and expenses by vehicle"
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
            variant="outline"
            onClick={() => setUnit((u) => (u === "kml" ? "mpg" : "kml"))}
            className="h-10 rounded-xl font-mono text-xs"
          >
            Unit: {unit === "kml" ? "km/L" : "MPG"}
          </Button>
        </div>
      </div>

      {/* Anomaly Alert Banner */}
      {anomalyCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/35 bg-destructive/10 p-4">
          <div className="flex items-center gap-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="font-semibold text-foreground">
              {anomalyCount} fuel anomal{anomalyCount === 1 ? "y" : "ies"}{" "}
              detected
            </span>
            <span className="text-xs text-muted-foreground">
              (sudden efficiency drop &gt;25% or volume exceeding tank capacity)
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTankFilter("anomalies")}
            className="rounded-xl"
          >
            Filter anomalies
          </Button>
        </div>
      ) : null}

      {/* Summary KPIs + Sparkline */}
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Total fuel spend</CardDescription>
              <CardTitle className="font-display text-2xl">
                {formatCurrency(totalSpend)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {totalLiters.toFixed(1)} L across {filteredLogs.length} fill-ups
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Operating expenses</CardDescription>
              <CardTitle className="font-display text-2xl">
                {formatCurrency(totalExpenses)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {filteredExpenses.length} tolls, parking, fines &amp; allowances
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Average efficiency</CardDescription>
              <CardTitle className="font-display text-2xl">
                {avgEfficiency !== null ? formatEff(avgEfficiency) : "N/A"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Between consecutive full-tank fill-ups
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
                values={efficiencyPoints.map((p) =>
                  unit === "mpg" ? kmPerLiterToMpg(p.kmPerLiter) : p.kmPerLiter
                )}
                labels={efficiencyPoints.map((p) => formatShortDate(p.date))}
              />
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      <Tabs defaultValue="fuel" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="grid w-full grid-cols-2 rounded-xl sm:w-80">
            <TabsTrigger value="fuel" className="rounded-lg">
              <Fuel className="mr-1.5 h-3.5 w-3.5" />
              Fuel logs ({filteredLogs.length})
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg">
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Expenses ({filteredExpenses.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {canLogFuel ? (
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
            {canLogExpenses ? (
              <Button
                type="button"
                variant="outline"
                onClick={openAddExpenseDialog}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add expense
              </Button>
            ) : null}
          </div>
        </div>

        {/* FUEL LOGS TAB */}
        <TabsContent value="fuel">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">Fill-up history</CardTitle>
                <CardDescription>
                  Includes station details, receipt uploads, and automatic
                  leak/theft anomaly detection.
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
                        setTankFilter(value);
                        pagination.setPage(1);
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label="Filter by tank type"
                      className="w-full"
                    >
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
                    {hasActiveFilters
                      ? "No fuel logs match your filters"
                      : "No fuel logs yet"}
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
                          <TableHead className="text-right">
                            Efficiency
                          </TableHead>
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
                                <p className="font-medium">
                                  {vehicle?.name ?? "Unknown"}
                                </p>
                                {log.station ? (
                                  <p className="text-xs text-muted-foreground">
                                    {log.station}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-right">
                                {log.liters.toFixed(1)} L
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(log.totalCost)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatKm(log.odometerKm)} km
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge
                                    variant={
                                      log.fullTank ? "secondary" : "outline"
                                    }
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
                                      {a.type === "over_capacity"
                                        ? "Over tank"
                                        : "Eff drop"}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {eff !== undefined ? (
                                  <Badge className="rounded-lg border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]">
                                    {formatEff(eff)}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
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
                                      onClick={() =>
                                        setPreviewReceipt(
                                          log.receiptPhotoDataUrl ?? null
                                        )
                                      }
                                    >
                                      <Receipt className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  ) : null}
                                  {canLogFuel ? (
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
        </TabsContent>

        {/* OPERATING EXPENSES TAB */}
        <TabsContent value="expenses">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">Operating Expenses</CardTitle>
                <CardDescription>
                  Tolls, parking fees, fines, and driver allowances linked to
                  trips and cost centers.
                </CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="relative sm:col-span-7">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={expSearch}
                    onChange={(e) => {
                      setExpSearch(e.target.value);
                      expensePagination.setPage(1);
                    }}
                    placeholder="Search description, cost center, or vehicle..."
                    className="pl-10"
                  />
                </div>
                <div className="sm:col-span-5">
                  <Select
                    value={expCategoryFilter}
                    items={EXPENSE_CATEGORY_FILTER_ITEMS}
                    onValueChange={(v) => {
                      if (v) {
                        setExpCategoryFilter(v);
                        expensePagination.setPage(1);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPENSE_CATEGORY_FILTER_ITEMS).map(
                        ([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredExpenses.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No operating expenses match your filters.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description / Trip</TableHead>
                          <TableHead>Cost center</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensePagination.pageItems.map((exp) => {
                          const veh = vehiclesById.get(exp.vehicleId);
                          const trip = exp.tripId
                            ? tripsById.get(exp.tripId)
                            : undefined;
                          return (
                            <TableRow key={exp.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatShortDate(exp.date)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {veh?.name ?? "Unknown"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-lg">
                                  {exp.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{exp.description}</p>
                                {trip ? (
                                  <p className="text-xs text-muted-foreground">
                                    Trip: {trip.purpose}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {exp.costCenter ?? "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(exp.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  {exp.receiptPhotoDataUrl ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() =>
                                        setPreviewReceipt(
                                          exp.receiptPhotoDataUrl ?? null
                                        )
                                      }
                                    >
                                      <Receipt className="h-3.5 w-3.5 text-primary" />
                                    </Button>
                                  ) : null}
                                  {canLogExpenses ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => {
                                        removeExpense(exp.id);
                                        toast.success("Expense removed.");
                                      }}
                                      className="text-destructive"
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
                    page={expensePagination.page}
                    pageSize={expensePagination.pageSize}
                    totalItems={expensePagination.totalItems}
                    totalPages={expensePagination.totalPages}
                    startIndex={expensePagination.startIndex}
                    endIndex={expensePagination.endIndex}
                    onPageChange={expensePagination.setPage}
                    onPageSizeChange={expensePagination.setPageSize}
                    itemLabel="expenses"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Fuel Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLog ? "Edit fuel log" : "Add fuel log"}
            </DialogTitle>
            <DialogDescription>
              Total cost and tank-capacity anomaly alerts are computed
              automatically.
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

            <div className="space-y-2">
              <Label htmlFor="fuel-station">Fuel station (optional)</Label>
              <Input
                id="fuel-station"
                value={form.station}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, station: e.target.value }))
                }
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
                onChange={(url) =>
                  setForm((prev) => ({ ...prev, receiptPhotoDataUrl: url }))
                }
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

      {/* Add Operating Expense Dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log operating expense</DialogTitle>
            <DialogDescription>
              Record tolls, parking, fines, or allowances for TCO tracking.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vehicle</Label>
                <Select
                  value={expVehicleId}
                  items={vehicleSelectItems}
                  onValueChange={(v) => {
                    if (v) setExpVehicleId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vehicle" />
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
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={expCategory}
                  items={EXPENSE_CATEGORY_ITEMS}
                  onValueChange={(v) => {
                    if (v) setExpCategory(v as ExpenseCategory);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={expDate} onChange={setExpDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="15.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Linked trip (optional)</Label>
              <Select
                value={expTripId}
                items={tripSelectItems}
                onValueChange={(v) => {
                  if (v) setExpTripId(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRIP}>Not linked to a trip</SelectItem>
                  {trips.slice(0, 25).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.purpose} ({t.startedAt.slice(0, 10)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cost center</Label>
              <Input
                value={expCostCenter}
                onChange={(e) => setExpCostCenter(e.target.value)}
                placeholder="Logistics-North"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                required
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                placeholder="Expressway bridge toll pass"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt photo (optional)</Label>
              <SinglePhotoUpload
                value={expReceipt}
                onChange={setExpReceipt}
                label="Upload expense receipt"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Save expense
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt preview modal */}
      <Dialog
        open={previewReceipt !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewReceipt(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt preview</DialogTitle>
          </DialogHeader>
          {previewReceipt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewReceipt}
              alt="Uploaded receipt"
              className="max-h-96 w-full rounded-xl object-contain"
            />
          ) : null}
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
