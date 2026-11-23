"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  History,
  Moon,
  RotateCcw,
  Shield,
  Sun,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AuditLogTab } from "@/components/settings/audit-log-tab";
import { RbacTab } from "@/components/settings/rbac-tab";
import { useThemeMode } from "@/components/theme-provider";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { downloadTextFile } from "@/lib/csv";
import { toIsoDate } from "@/lib/format";
import { can, ROLE_LABELS } from "@/lib/rbac";
import type { FleetExportPayload, UserRole } from "@/types";

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

  return {
    version: typeof raw.version === "number" ? raw.version : 4,
    exportedAt:
      typeof raw.exportedAt === "string"
        ? raw.exportedAt
        : new Date().toISOString(),
    vehicles: raw.vehicles as FleetExportPayload["vehicles"],
    trips: raw.trips as FleetExportPayload["trips"],
    fuelLogs: Array.isArray(raw.fuelLogs) ? raw.fuelLogs : [],
    maintenanceRecords: Array.isArray(raw.maintenanceRecords)
      ? raw.maintenanceRecords
      : [],
    drivers: Array.isArray(raw.drivers) ? raw.drivers : [],
    complianceDocs: Array.isArray(raw.complianceDocs) ? raw.complianceDocs : [],
    bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
    geofences: Array.isArray(raw.geofences) ? raw.geofences : undefined,
    geofenceAlerts: Array.isArray(raw.geofenceAlerts) ? raw.geofenceAlerts : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    workOrders: Array.isArray(raw.workOrders) ? raw.workOrders : [],
    incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
  };
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const { theme, setTheme } = useThemeMode();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole: UserRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canManageRbac = can(currentRole, "admin:rbac");
  const canViewAudit = can(currentRole, "audit:view");

  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const drivers = useFleetStore((s) => s.drivers);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const bookings = useFleetStore((s) => s.bookings);
  const geofences = useFleetStore((s) => s.geofences);
  const geofenceAlerts = useFleetStore((s) => s.geofenceAlerts);
  const expenses = useFleetStore((s) => s.expenses);
  const workOrders = useFleetStore((s) => s.workOrders);
  const incidents = useFleetStore((s) => s.incidents);
  const auditLogs = useFleetStore((s) => s.auditLogs);
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
      version: 4,
      exportedAt: new Date().toISOString(),
      vehicles,
      trips,
      fuelLogs,
      maintenanceRecords,
      drivers,
      complianceDocs,
      bookings,
      geofences,
      geofenceAlerts,
      expenses,
      workOrders,
      incidents,
      auditLogs,
    };
    downloadTextFile(
      `trackflow-backup-${toIsoDate()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    toast.success("Complete fleet workspace exported to JSON.");
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validated = validateImportPayload(parsed);
      if (!validated) {
        toast.error("Invalid backup file.");
        return;
      }
      importData(validated);
      toast.success(
        `Imported ${validated.vehicles.length} vehicles and ${validated.trips.length} trips.`
      );
    } catch {
      toast.error("Could not parse JSON file.");
    }
  };

  const handleReset = () => {
    resetDemoData();
    setResetOpen(false);
    toast.success("Demo data restored to initial seed.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Settings &amp; Administration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage RBAC roles &amp; permissions, inspect the audit trail, switch
            themes, and back up local data.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          <Shield className="mr-1.5 h-3.5 w-3.5" />
          Signed in as {ROLE_LABELS[currentRole]}
        </Badge>
      </div>

      <Tabs defaultValue="rbac" className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 rounded-xl sm:max-w-lg">
          <TabsTrigger value="rbac" className="rounded-lg">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            RBAC &amp; Roles
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg">
            <History className="mr-1.5 h-3.5 w-3.5" />
            Audit Log ({auditLogs.length})
          </TabsTrigger>
          <TabsTrigger value="general" className="rounded-lg">
            General &amp; Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rbac">
          <RbacTab currentRole={currentRole} canManageRbac={canManageRbac} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTab canViewAudit={canViewAudit} />
        </TabsContent>

        <TabsContent value="general" className="space-y-5">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Appearance</CardTitle>
              <CardDescription>
                Choose between TrackFlow&apos;s dark navy telemetry theme or
                light theme.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-pressed={theme === "dark"}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  theme === "dark"
                    ? "border-[var(--brand-teal)] bg-[var(--brand-teal)]/10"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#07131c] text-[#22d3ee]">
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Dark mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deep slate surface with cyan and amber telemetry
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-pressed={theme === "light"}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
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

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Local data management</CardTitle>
              <CardDescription>
                Storing {vehicles.length} vehicles, {complianceDocs.length}{" "}
                compliance docs, {drivers.length} drivers, {bookings.length}{" "}
                bookings, {trips.length} trips, {fuelLogs.length} fuel logs,{" "}
                {expenses.length} expenses, {workOrders.length} work orders, and{" "}
                {incidents.length} incidents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Export data
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Download a full JSON backup of all fleet modules.
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
                  <p className="text-sm font-medium text-foreground">
                    Import data
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Restore a previously exported TrackFlow JSON backup.
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
                    Restores the seeded vehicles, compliance docs, drivers,
                    bookings, trips, geofences, fuel logs, expenses, work
                    orders, and incidents.
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
        </TabsContent>
      </Tabs>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces all current local fleet data with the default demo
              seed.
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
