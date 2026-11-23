"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Fuel, Receipt, TrendingUp } from "lucide-react";
import { FuelLogsTab } from "@/components/fuel/fuel-logs-tab";
import { OperatingExpensesTab } from "@/components/fuel/operating-expenses-tab";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { Sparkline } from "@/components/sparkline";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  computeFuelEfficiency,
  detectFuelAnomalies,
  getAverageEfficiency,
  kmPerLiterToMpg,
} from "@/lib/fuel";
import { can } from "@/lib/rbac";
import type { FuelLog } from "@/types";

const ALL_VEHICLES = "__all__";
const ALL_TANKS = "__all_tanks__";

export default function FuelPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canLogFuel = can(currentRole, "fuel:write");
  const canLogExpenses = can(currentRole, "expenses:write");

  const vehicles = useFleetStore((s) => s.vehicles);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const expenses = useFleetStore((s) => s.expenses);

  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [tankFilter, setTankFilter] = useState(ALL_TANKS);
  const [unit, setUnit] = useState<"kml" | "mpg">("kml");
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const vehicleFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_VEHICLES]: "All vehicles" };
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const scopedFuelLogs = useMemo(
    () =>
      vehicleFilter === ALL_VEHICLES
        ? fuelLogs
        : fuelLogs.filter((l) => l.vehicleId === vehicleFilter),
    [fuelLogs, vehicleFilter]
  );

  const scopedExpenses = useMemo(
    () =>
      vehicleFilter === ALL_VEHICLES
        ? expenses
        : expenses.filter((e) => e.vehicleId === vehicleFilter),
    [expenses, vehicleFilter]
  );

  const anomaliesByLogId = useMemo(
    () => detectFuelAnomalies(fuelLogs, vehiclesById),
    [fuelLogs, vehiclesById]
  );

  const efficiencyPoints = useMemo(() => {
    if (vehicleFilter !== ALL_VEHICLES) {
      return computeFuelEfficiency(scopedFuelLogs);
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
  }, [fuelLogs, scopedFuelLogs, vehicleFilter]);

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

  const totalSpend = scopedFuelLogs.reduce((sum, l) => sum + l.totalCost, 0);
  const totalLiters = scopedFuelLogs.reduce((sum, l) => sum + l.liters, 0);
  const totalExpenses = scopedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgEfficiency = getAverageEfficiency(efficiencyPoints);
  const anomalyCount = Array.from(anomaliesByLogId.values()).reduce(
    (s, arr) => s + arr.length,
    0
  );

  const formatEff = (kml: number) =>
    unit === "mpg" ? `${kmPerLiterToMpg(kml)} MPG` : `${kml} km/L`;

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
              if (value) setVehicleFilter(value);
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
              {totalLiters.toFixed(1)} L across {scopedFuelLogs.length} fill-ups
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
              {scopedExpenses.length} tolls, parking, fines &amp; allowances
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
        <TabsList className="grid w-full grid-cols-2 rounded-xl sm:w-80">
          <TabsTrigger value="fuel" className="rounded-lg">
            <Fuel className="mr-1.5 h-3.5 w-3.5" />
            Fuel logs ({scopedFuelLogs.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg">
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Expenses ({scopedExpenses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fuel">
          <FuelLogsTab
            vehicleFilter={vehicleFilter}
            allVehiclesSentinel={ALL_VEHICLES}
            unit={unit}
            canWrite={canLogFuel}
            tankFilter={tankFilter}
            onTankFilterChange={setTankFilter}
            efficiencyByLogId={efficiencyByLogId}
            anomaliesByLogId={anomaliesByLogId}
            onPreviewReceipt={(url) => setPreviewReceipt(url || null)}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <OperatingExpensesTab
            vehicleFilter={vehicleFilter}
            allVehiclesSentinel={ALL_VEHICLES}
            canWrite={canLogExpenses}
            onPreviewReceipt={(url) => setPreviewReceipt(url || null)}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
