"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  Download,
  History,
  Moon,
  RotateCcw,
  Search,
  Shield,
  Sun,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TablePagination, usePagination } from "@/components/table-pagination";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { downloadTextFile } from "@/lib/csv";
import { formatDateTime, toIsoDate } from "@/lib/format";
import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  can,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/rbac";
import type { FleetExportPayload, UserRole } from "@/types";

const ALL_ENTITIES = "__all_entities__";
const ENTITY_FILTER_ITEMS: Record<string, string> = {
  [ALL_ENTITIES]: "All modules",
  vehicle: "Vehicles",
  compliance: "Compliance",
  driver: "Drivers",
  booking: "Bookings",
  trip: "Trips",
  geofence: "Geofences",
  fuel: "Fuel",
  expense: "Expenses",
  maintenance: "Maintenance",
  work_order: "Work Orders",
  incident: "Incidents",
  rbac: "RBAC",
};

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
  const switchRole = useAuthStore((s) => s.switchRole);
  const updateUserRole = useAuthStore((s) => s.updateUserRole);

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
  const logAudit = useFleetStore((s) => s.logAudit);
  const importData = useFleetStore((s) => s.importData);
  const resetDemoData = useFleetStore((s) => s.resetDemoData);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditEntity, setAuditEntity] = useState(ALL_ENTITIES);

  const currentUser = users.find((u) => u.id === currentUserId);
  const currentRole: UserRole = currentUser?.role ?? "super_admin";
  const canManageRbac = can(currentRole, "admin:rbac");
  const canViewAudit = can(currentRole, "audit:view");

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (auditEntity !== ALL_ENTITIES && entry.entityType !== auditEntity) {
        return false;
      }
      if (q) {
        const hay = `${entry.actorName} ${entry.action} ${entry.summary} ${entry.entityType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, auditEntity, auditSearch]);

  const auditPagination = usePagination(filteredAuditLogs, 10);

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
    const today = toIsoDate();
    downloadTextFile(
      `trackflow-backup-${today}.json`,
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

        {/* RBAC TAB */}
        <TabsContent value="rbac" className="space-y-5">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Quick Role Switcher (Demo)</CardTitle>
              <CardDescription>
                Test Role-Based Access Control instantly by switching between the
                5 fleet roles. Restricted actions update across the entire app.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {ALL_ROLES.map((role) => {
                const active = currentRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      switchRole(role);
                      toast.success(`Switched active role to ${ROLE_LABELS[role]}`);
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {ROLE_LABELS[role]}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Workspace Users &amp; Role Assignment</CardTitle>
              <CardDescription>
                {canManageRbac
                  ? "Assign roles to team members. Every change is logged in the Audit Trail."
                  : "Read-only view — Super Admin privileges are required to modify user roles."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.name}
                          {u.id === currentUserId ? (
                            <Badge variant="outline" className="ml-2 rounded-md text-[10px]">
                              You
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            items={ROLE_LABELS}
                            disabled={!canManageRbac}
                            onValueChange={(nextRole) => {
                              if (!nextRole) return;
                              updateUserRole(u.id, nextRole as UserRole);
                              logAudit(
                                "rbac.role_updated",
                                "rbac",
                                `Changed ${u.name}'s role to ${ROLE_LABELS[nextRole as UserRole]}`,
                                u.id
                              );
                              toast.success(
                                `Updated ${u.name} to ${ROLE_LABELS[nextRole as UserRole]}.`
                              );
                            }}
                          >
                            <SelectTrigger className="w-44" size="sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Permission Matrix</CardTitle>
              <CardDescription>
                Enforced capabilities across Super Admin, Fleet Manager,
                Dispatcher, Mechanic, and Driver roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Capability</TableHead>
                      {ALL_ROLES.map((r) => (
                        <TableHead key={r} className="text-center">
                          {ROLE_LABELS[r]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_PERMISSIONS.map((perm) => (
                      <TableRow key={perm.key}>
                        <TableCell className="font-medium">
                          {perm.label}
                        </TableCell>
                        {ALL_ROLES.map((r) => {
                          const allowed = can(r, perm.key);
                          return (
                            <TableCell key={r} className="text-center">
                              {allowed ? (
                                <Check className="mx-auto h-4 w-4 text-[var(--brand-teal)]" />
                              ) : (
                                <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT LOG TAB */}
        <TabsContent value="audit">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">System Audit Log</CardTitle>
                <CardDescription>
                  Immutable record of vehicle updates, approvals, compliance
                  changes, work orders, and RBAC edits.
                </CardDescription>
              </div>

              {canViewAudit ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="relative lg:col-span-7">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={auditSearch}
                      onChange={(e) => {
                        setAuditSearch(e.target.value);
                        auditPagination.setPage(1);
                      }}
                      placeholder="Search actor, action, or summary..."
                      className="pl-10"
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <Select
                      value={auditEntity}
                      items={ENTITY_FILTER_ITEMS}
                      onValueChange={(val) => {
                        if (val) {
                          setAuditEntity(val);
                          auditPagination.setPage(1);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All modules" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENTITY_FILTER_ITEMS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {!canViewAudit ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    Audit log access is restricted to Super Admins and Fleet
                    Managers.
                  </p>
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No audit entries match your filter.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Summary</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditPagination.pageItems.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(entry.timestamp)}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-foreground">
                                {entry.actorName}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {ROLE_LABELS[entry.actorRole]}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-md capitalize">
                                {entry.entityType.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {entry.action}
                            </TableCell>
                            <TableCell className="max-w-md whitespace-normal text-sm">
                              {entry.summary}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={auditPagination.page}
                    pageSize={auditPagination.pageSize}
                    totalItems={auditPagination.totalItems}
                    totalPages={auditPagination.totalPages}
                    startIndex={auditPagination.startIndex}
                    endIndex={auditPagination.endIndex}
                    onPageChange={auditPagination.setPage}
                    onPageSizeChange={auditPagination.setPageSize}
                    itemLabel="audit entries"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GENERAL & DATA TAB */}
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
