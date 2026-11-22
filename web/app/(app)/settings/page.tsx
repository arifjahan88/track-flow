"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  Moon,
  RotateCcw,
  Sun,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeMode } from "@/components/theme-provider";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { downloadTextFile } from "@/lib/csv";
import type { FleetExportPayload } from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateImportPayload(raw: unknown): FleetExportPayload | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.vehicles) || !Array.isArray(raw.trips)) return null;

  const validVehicles = raw.vehicles.every(
    (v) =>
      isRecord(v) &&
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      typeof v.plate === "string" &&
      typeof v.odometerKm === "number"
  );
  if (!validVehicles) return null;

  const validTrips = raw.trips.every(
    (t) =>
      isRecord(t) &&
      typeof t.id === "string" &&
      typeof t.vehicleId === "string" &&
      typeof t.purpose === "string" &&
      (t.status === "active" || t.status === "paused" || t.status === "done") &&
      Array.isArray(t.points)
  );
  if (!validTrips) return null;

  if (raw.fuelLogs !== undefined && !Array.isArray(raw.fuelLogs)) return null;
  if (
    raw.maintenanceRecords !== undefined &&
    !Array.isArray(raw.maintenanceRecords)
  ) {
    return null;
  }
  if (raw.drivers !== undefined && !Array.isArray(raw.drivers)) return null;

  return {
    version: typeof raw.version === "number" ? raw.version : 1,
    exportedAt:
      typeof raw.exportedAt === "string"
        ? raw.exportedAt
        : new Date().toISOString(),
    vehicles: raw.vehicles as FleetExportPayload["vehicles"],
    trips: raw.trips as FleetExportPayload["trips"],
    fuelLogs: raw.fuelLogs as FleetExportPayload["fuelLogs"],
    maintenanceRecords:
      raw.maintenanceRecords as FleetExportPayload["maintenanceRecords"],
    drivers: raw.drivers as FleetExportPayload["drivers"],
  };
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const { theme, setTheme } = useThemeMode();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const drivers = useFleetStore((s) => s.drivers);
  const importData = useFleetStore((s) => s.importData);
  const resetDemoData = useFleetStore((s) => s.resetDemoData);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const handleExport = () => {
    const payload: FleetExportPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      vehicles,
      trips,
      fuelLogs,
      maintenanceRecords,
      drivers,
    };
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      `trackflow-backup-${today}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    toast.success("Fleet data exported to JSON.");
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validated = validateImportPayload(parsed);

      if (!validated) {
        toast.error(
          "Invalid backup file. Expected TrackFlow JSON with vehicles and trips."
        );
        return;
      }

      importData(validated);
      toast.success(
        `Imported ${validated.vehicles.length} vehicles and ${validated.trips.length} trips.`
      );
    } catch {
      toast.error("Could not parse JSON file. Please select a valid backup.");
    }
  };

  const handleReset = () => {
    resetDemoData();
    setResetOpen(false);
    toast.success("Demo data restored to initial seed.");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize appearance and back up, import, or reset your local browser
          fleet data.
        </p>
      </div>

      {/* Appearance */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
          <CardDescription>
            Choose between TrackFlow&apos;s dark navy telemetry theme or light
            theme.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              theme === "dark"
                ? "border-[var(--brand-teal)] bg-[var(--brand-teal)]/10"
                : "border-border bg-muted/20 hover:bg-muted/40"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#07131c] text-[#22d3ee]">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Dark mode</p>
              <p className="text-xs text-muted-foreground">
                Deep slate surface with cyan and amber telemetry
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              theme === "light"
                ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/10"
                : "border-border bg-muted/20 hover:bg-muted/40"
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f7fb] text-[#d97706] ring-1 ring-border">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Light mode
              </p>
              <p className="text-xs text-muted-foreground">
                High-contrast crisp daylight workspace
              </p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Local data management</CardTitle>
          <CardDescription>
            Currently storing {vehicles.length} vehicles, {trips.length} trips,{" "}
            {fuelLogs.length} fuel logs, {maintenanceRecords.length} service
            records, and {drivers.length} drivers in localStorage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Export data</p>
              <p className="text-xs text-muted-foreground">
                Download a JSON backup containing your vehicles, trips, fuel
                logs, maintenance records, and drivers.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              className="shrink-0 rounded-xl"
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Import data</p>
              <p className="text-xs text-muted-foreground">
                Validate and restore a previously exported TrackFlow JSON file.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Import TrackFlow JSON backup"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-xl"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import JSON
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Reset demo data
              </p>
              <p className="text-xs text-muted-foreground">
                Clears recorded trips and restores the initial seeded vehicles,
                drivers, fuel logs, and maintenance alerts.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setResetOpen(true)}
              className="shrink-0 rounded-xl"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset demo data
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current vehicles, trips, fuel logs, maintenance
              records, and drivers with the default demo seed. Consider
              exporting a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
