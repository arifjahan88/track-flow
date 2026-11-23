"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertOctagon,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { MultiPhotoUpload } from "@/components/photo-upload";
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
import { computeWorkOrderTotal } from "@/lib/analytics";
import {
  formatCurrency,
  formatShortDate,
  offsetIsoDate,
  toIsoDate,
} from "@/lib/format";
import {
  getMaintenanceStatus,
  type MaintenanceStatus,
} from "@/lib/maintenance";
import { can } from "@/lib/rbac";
import type {
  IncidentSeverity,
  IncidentStatus,
  MaintenanceRecord,
  MaintenanceType,
  SparePartLine,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/types";

const MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  "Oil change",
  "Tire service",
  "Brake inspection",
  "Battery check",
  "General service",
  "Inspection",
];

const ALL_VEHICLES = "__all__";
const ALL_TYPES = "__all_types__";
const NO_DRIVER = "__no_driver__";

const MAINTENANCE_TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  MAINTENANCE_TYPES.map((t) => [t, t])
);
const MAINTENANCE_TYPE_FILTER_ITEMS: Record<string, string> = {
  [ALL_TYPES]: "All service types",
  ...MAINTENANCE_TYPE_ITEMS,
};

const WO_STATUS_ITEMS: Record<WorkOrderStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_parts: "Waiting Parts",
  completed: "Completed",
};

const WO_PRIORITY_ITEMS: Record<WorkOrderPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const INCIDENT_SEVERITY_ITEMS: Record<IncidentSeverity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
};

const INCIDENT_STATUS_ITEMS: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
};

type StatusFilter = "all" | MaintenanceStatus;

interface MaintenanceFormState {
  vehicleId: string;
  title: string;
  type: MaintenanceType;
  scheduledDate: string;
  dueOdometerKm: string;
  dueEngineHours: string;
  intervalKm: string;
  intervalDays: string;
  intervalEngineHours: string;
  cost: string;
}

export default function MaintenancePage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canWriteMaint = can(currentRole, "maintenance:write");
  const canWriteWorkOrders = can(currentRole, "work_orders:write");
  const canWriteIncidents = can(currentRole, "incidents:write");

  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const records = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const incidents = useFleetStore((s) => s.incidents);

  const addMaintenanceRecord = useFleetStore((s) => s.addMaintenanceRecord);
  const updateMaintenanceRecord = useFleetStore(
    (s) => s.updateMaintenanceRecord
  );
  const completeMaintenanceRecord = useFleetStore(
    (s) => s.completeMaintenanceRecord
  );
  const removeMaintenanceRecord = useFleetStore(
    (s) => s.removeMaintenanceRecord
  );
  const addWorkOrder = useFleetStore((s) => s.addWorkOrder);
  const updateWorkOrderStatus = useFleetStore((s) => s.updateWorkOrderStatus);
  const removeWorkOrder = useFleetStore((s) => s.removeWorkOrder);
  const addIncident = useFleetStore((s) => s.addIncident);
  const updateIncidentStatus = useFleetStore((s) => s.updateIncidentStatus);
  const removeIncident = useFleetStore((s) => s.removeIncident);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(
    null
  );
  const [deletingRecord, setDeletingRecord] =
    useState<MaintenanceRecord | null>(null);
  const [completingRecord, setCompletingRecord] =
    useState<MaintenanceRecord | null>(null);
  const [completeDate, setCompleteDate] = useState("");
  const [completeCost, setCompleteCost] = useState("");
  const [scheduleNextPrompt, setScheduleNextPrompt] =
    useState<MaintenanceRecord | null>(null);

  const [form, setForm] = useState<MaintenanceFormState>({
    vehicleId: "",
    title: "",
    type: "Oil change",
    scheduledDate: "",
    dueOdometerKm: "",
    dueEngineHours: "",
    intervalKm: "5000",
    intervalDays: "90",
    intervalEngineHours: "",
    cost: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Work Order Dialog state
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [woSearch, setWoSearch] = useState("");
  const [woVehicleId, setWoVehicleId] = useState("");
  const [woTitle, setWoTitle] = useState("");
  const [woPriority, setWoPriority] = useState<WorkOrderPriority>("medium");
  const [woVendor, setWoVendor] = useState("");
  const [woPhone, setWoPhone] = useState("");
  const [woDowntime, setWoDowntime] = useState("4");
  const [woWarranty, setWoWarranty] = useState("");
  const [woLabor, setWoLabor] = useState("60");
  const [woParts, setWoParts] = useState<SparePartLine[]>([]);
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partCost, setPartCost] = useState("");
  const [woNotes, setWoNotes] = useState("");

  // Incident Dialog state
  const [incDialogOpen, setIncDialogOpen] = useState(false);
  const [incSearch, setIncSearch] = useState("");
  const [incVehicleId, setIncVehicleId] = useState("");
  const [incDriverId, setIncDriverId] = useState(NO_DRIVER);
  const [incDate, setIncDate] = useState("");
  const [incSeverity, setIncSeverity] = useState<IncidentSeverity>("minor");
  const [incLocation, setIncLocation] = useState("");
  const [incDesc, setIncDesc] = useState("");
  const [incThirdPartyName, setIncThirdPartyName] = useState("");
  const [incThirdPartyPlate, setIncThirdPartyPlate] = useState("");
  const [incThirdPartyIns, setIncThirdPartyIns] = useState("");
  const [incEstCost, setIncEstCost] = useState("");
  const [incPhotos, setIncPhotos] = useState<string[]>([]);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
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

  const driverSelectItems = useMemo(() => {
    const items: Record<string, string> = { [NO_DRIVER]: "Unassigned" };
    for (const d of drivers) {
      items[d.id] = d.name;
    }
    return items;
  }, [drivers]);

  const enriched = useMemo(() => {
    if (!hydrated) return [];
    const order: Record<MaintenanceStatus, number> = {
      overdue: 0,
      due_soon: 1,
      upcoming: 2,
      completed: 3,
    };

    return records
      .map((rec) => {
        const vehicle = vehiclesById.get(rec.vehicleId);
        const status = getMaintenanceStatus(
          rec,
          vehicle?.odometerKm ?? 0,
          undefined,
          vehicle?.engineHours
        );
        return { rec, vehicle, status };
      })
      .sort((a, b) => order[a.status] - order[b.status]);
  }, [hydrated, records, vehiclesById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (
        vehicleFilter !== ALL_VEHICLES &&
        item.rec.vehicleId !== vehicleFilter
      ) {
        return false;
      }
      if (typeFilter !== ALL_TYPES && item.rec.type !== typeFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.rec.title} ${item.rec.type} ${item.vehicle?.name ?? ""} ${item.vehicle?.plate ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, statusFilter, vehicleFilter, typeFilter, search]);

  const pagination = usePagination(filtered, 10);

  const filteredWorkOrders = useMemo(() => {
    const q = woSearch.trim().toLowerCase();
    return workOrders.filter((w) => {
      if (!q) return true;
      const v = vehiclesById.get(w.vehicleId);
      const hay = `${w.title} ${w.vendorName} ${w.status} ${v?.name ?? ""} ${v?.plate ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [workOrders, woSearch, vehiclesById]);

  const woPagination = usePagination(filteredWorkOrders, 10);

  const filteredIncidents = useMemo(() => {
    const q = incSearch.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (!q) return true;
      const v = vehiclesById.get(inc.vehicleId);
      const d = inc.driverId ? driversById.get(inc.driverId) : undefined;
      const hay = `${inc.locationLabel} ${inc.description} ${inc.severity} ${v?.name ?? ""} ${d?.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [incidents, incSearch, vehiclesById, driversById]);

  const incPagination = usePagination(filteredIncidents, 10);

  const hasActiveFilters =
    statusFilter !== "all" ||
    vehicleFilter !== ALL_VEHICLES ||
    typeFilter !== ALL_TYPES ||
    search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setVehicleFilter(ALL_VEHICLES);
    setTypeFilter(ALL_TYPES);
    setSearch("");
    pagination.setPage(1);
  };

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const overdueCount = enriched.filter((i) => i.status === "overdue").length;
  const dueSoonCount = enriched.filter((i) => i.status === "due_soon").length;
  const openWoCount = workOrders.filter((w) => w.status !== "completed").length;
  const openIncidentsCount = incidents.filter(
    (i) => i.status !== "resolved"
  ).length;

  const openAddDialog = (prefill?: Partial<MaintenanceFormState>) => {
    setEditingRecord(null);
    setError(null);
    const defaultVeh = vehicles[0];
    setForm({
      vehicleId: prefill?.vehicleId ?? defaultVeh?.id ?? "",
      title: prefill?.title ?? "",
      type: prefill?.type ?? "Oil change",
      scheduledDate: prefill?.scheduledDate ?? offsetIsoDate(30),
      dueOdometerKm: prefill?.dueOdometerKm ?? "",
      dueEngineHours: prefill?.dueEngineHours ?? "",
      intervalKm: prefill?.intervalKm ?? "5000",
      intervalDays: prefill?.intervalDays ?? "90",
      intervalEngineHours: prefill?.intervalEngineHours ?? "",
      cost: prefill?.cost ?? "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rec: MaintenanceRecord) => {
    setEditingRecord(rec);
    setError(null);
    setForm({
      vehicleId: rec.vehicleId,
      title: rec.title,
      type: rec.type,
      scheduledDate: rec.scheduledDate ?? "",
      dueOdometerKm:
        rec.dueOdometerKm !== undefined ? String(rec.dueOdometerKm) : "",
      dueEngineHours:
        rec.dueEngineHours !== undefined ? String(rec.dueEngineHours) : "",
      intervalKm: rec.intervalKm !== undefined ? String(rec.intervalKm) : "",
      intervalDays:
        rec.intervalDays !== undefined ? String(rec.intervalDays) : "",
      intervalEngineHours:
        rec.intervalEngineHours !== undefined
          ? String(rec.intervalEngineHours)
          : "",
      cost: rec.cost !== undefined ? String(rec.cost) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.vehicleId) {
      setError("Select a vehicle.");
      return;
    }
    if (!form.title.trim()) {
      setError("Service title is required.");
      return;
    }
    if (!form.scheduledDate && !form.dueOdometerKm && !form.dueEngineHours) {
      setError("Provide a scheduled date, due odometer, or engine hours.");
      return;
    }

    const optNum = (s: string) =>
      s.trim() ? Number(s) : undefined;

    const payload: Omit<MaintenanceRecord, "id"> = {
      vehicleId: form.vehicleId,
      title: form.title.trim(),
      type: form.type,
      scheduledDate: form.scheduledDate || undefined,
      dueOdometerKm: optNum(form.dueOdometerKm),
      dueEngineHours: optNum(form.dueEngineHours),
      intervalKm: optNum(form.intervalKm),
      intervalDays: optNum(form.intervalDays),
      intervalEngineHours: optNum(form.intervalEngineHours),
      completedDate: editingRecord?.completedDate,
      cost: optNum(form.cost),
    };

    if (editingRecord) {
      updateMaintenanceRecord(editingRecord.id, payload);
      toast.success("Maintenance record updated.");
    } else {
      addMaintenanceRecord(payload);
      toast.success("Maintenance rule scheduled.");
    }
    setDialogOpen(false);
  };

  const handleCompleteSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!completingRecord) return;
    const costNum = completeCost ? Number(completeCost) : undefined;
    completeMaintenanceRecord(completingRecord.id, completeDate, costNum);
    toast.success(`Marked "${completingRecord.title}" as completed.`);
    const finished = completingRecord;
    setCompletingRecord(null);
    setScheduleNextPrompt(finished);
  };

  const handleScheduleNext = () => {
    if (!scheduleNextPrompt) return;
    const vehicle = vehiclesById.get(scheduleNextPrompt.vehicleId);
    const intervalKm = scheduleNextPrompt.intervalKm ?? 5000;
    const intervalDays = scheduleNextPrompt.intervalDays ?? 90;
    const intervalHrs = scheduleNextPrompt.intervalEngineHours;
    const nextOdo = Math.round((vehicle?.odometerKm ?? 0) + intervalKm);
    const nextHrs =
      intervalHrs !== undefined
        ? Math.round((vehicle?.engineHours ?? 0) + intervalHrs)
        : undefined;
    const rec = scheduleNextPrompt;
    setScheduleNextPrompt(null);
    openAddDialog({
      vehicleId: rec.vehicleId,
      title: rec.title,
      type: rec.type,
      scheduledDate: offsetIsoDate(intervalDays),
      dueOdometerKm: String(nextOdo),
      dueEngineHours: nextHrs !== undefined ? String(nextHrs) : "",
      intervalKm: String(intervalKm),
      intervalDays: String(intervalDays),
      intervalEngineHours: intervalHrs !== undefined ? String(intervalHrs) : "",
      cost: rec.cost !== undefined ? String(rec.cost) : "",
    });
  };

  const handleDelete = () => {
    if (!deletingRecord) return;
    removeMaintenanceRecord(deletingRecord.id);
    toast.success("Maintenance record removed.");
    setDeletingRecord(null);
  };

  const openAddWorkOrder = () => {
    setWoVehicleId(vehicles[0]?.id ?? "");
    setWoTitle("");
    setWoPriority("medium");
    setWoVendor("");
    setWoPhone("");
    setWoDowntime("4");
    setWoWarranty(offsetIsoDate(180));
    setWoLabor("60");
    setWoParts([]);
    setPartName("");
    setPartQty("1");
    setPartCost("");
    setWoNotes("");
    setWoDialogOpen(true);
  };

  const handleAddPart = () => {
    const qty = Number(partQty);
    const unitCost = Number(partCost);
    if (!partName.trim() || qty <= 0 || Number.isNaN(unitCost) || unitCost < 0) {
      return;
    }
    setWoParts((prev) => [
      ...prev,
      {
        id: `pt-${Date.now()}-${prev.length}`,
        name: partName.trim(),
        qty,
        unitCost,
      },
    ]);
    setPartName("");
    setPartQty("1");
    setPartCost("");
  };

  const handleCreateWorkOrder = (e: FormEvent) => {
    e.preventDefault();
    if (!woVehicleId || !woTitle.trim() || !woVendor.trim()) {
      toast.error("Provide vehicle, repair title, and vendor/garage.");
      return;
    }
    addWorkOrder({
      vehicleId: woVehicleId,
      title: woTitle.trim(),
      status: "open",
      priority: woPriority,
      vendorName: woVendor.trim(),
      mechanicPhone: woPhone.trim() || undefined,
      openedAt: toIsoDate(),
      downtimeHours: Math.max(0, Number(woDowntime) || 0),
      warrantyUntil: woWarranty || undefined,
      parts: woParts,
      laborCost: Math.max(0, Number(woLabor) || 0),
      notes: woNotes.trim() || undefined,
    });
    toast.success("Work order created and vehicle marked Under Maintenance.");
    setWoDialogOpen(false);
  };

  const openAddIncident = () => {
    setIncVehicleId(vehicles[0]?.id ?? "");
    setIncDriverId(drivers[0]?.id ?? NO_DRIVER);
    setIncDate(toIsoDate());
    setIncSeverity("minor");
    setIncLocation("");
    setIncDesc("");
    setIncThirdPartyName("");
    setIncThirdPartyPlate("");
    setIncThirdPartyIns("");
    setIncEstCost("");
    setIncPhotos([]);
    setIncDialogOpen(true);
  };

  const handleCreateIncident = (e: FormEvent) => {
    e.preventDefault();
    if (!incVehicleId || !incLocation.trim() || !incDesc.trim()) {
      toast.error("Provide vehicle, location, and incident description.");
      return;
    }
    addIncident({
      vehicleId: incVehicleId,
      driverId: incDriverId === NO_DRIVER ? undefined : incDriverId,
      occurredAt: incDate || toIsoDate(),
      severity: incSeverity,
      status: "open",
      locationLabel: incLocation.trim(),
      description: incDesc.trim(),
      thirdPartyName: incThirdPartyName.trim() || undefined,
      thirdPartyPlate: incThirdPartyPlate.trim().toUpperCase() || undefined,
      thirdPartyInsurance: incThirdPartyIns.trim() || undefined,
      estimatedCost: incEstCost ? Number(incEstCost) : undefined,
      photos: incPhotos,
    });
    toast.success("Incident report logged.");
    setIncDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Maintenance, Work Orders &amp; Incidents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preventive rules (odometer, engine hours, calendar), corrective work
            orders &amp; vendor parts, and accident reporting.
          </p>
        </div>
      </div>

      {/* Status KPI cards */}
      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Overdue Services</CardDescription>
              <CardTitle className="font-display text-2xl text-destructive">
                {overdueCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Due Soon (14d / 500km / 25h)</CardDescription>
              <CardTitle className="font-display text-2xl text-[var(--brand-amber)]">
                {dueSoonCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Active Work Orders</CardDescription>
              <CardTitle className="font-display text-2xl text-primary">
                {openWoCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Open Incidents</CardDescription>
              <CardTitle className="font-display text-2xl text-[var(--brand-amber)]">
                {openIncidentsCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      <Tabs defaultValue="rules" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="grid w-full grid-cols-3 rounded-xl sm:max-w-lg">
            <TabsTrigger value="rules" className="rounded-lg">
              <Wrench className="mr-1.5 h-3.5 w-3.5" />
              Services ({records.length})
            </TabsTrigger>
            <TabsTrigger value="work_orders" className="rounded-lg">
              <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
              Work Orders ({workOrders.length})
            </TabsTrigger>
            <TabsTrigger value="incidents" className="rounded-lg">
              <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
              Incidents ({incidents.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2">
            {canWriteMaint ? (
              <Button
                type="button"
                onClick={() => openAddDialog()}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Schedule service
              </Button>
            ) : null}
            {canWriteWorkOrders ? (
              <Button
                type="button"
                variant="outline"
                onClick={openAddWorkOrder}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Work order
              </Button>
            ) : null}
            {canWriteIncidents ? (
              <Button
                type="button"
                variant="outline"
                onClick={openAddIncident}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl"
              >
                <AlertOctagon className="mr-1.5 h-4 w-4 text-destructive" />
                Report incident
              </Button>
            ) : null}
          </div>
        </div>

        {/* TAB 1: PREVENTIVE SERVICES & RULES */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["overdue", "Overdue"],
                ["due_soon", "Due soon"],
                ["upcoming", "Upcoming"],
                ["completed", "Completed"],
              ] as const
            ).map(([val, label]) => (
              <Button
                key={val}
                type="button"
                size="sm"
                variant={statusFilter === val ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter(val);
                  pagination.setPage(1);
                }}
                className="rounded-xl"
              >
                {label}
              </Button>
            ))}
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <CardTitle className="text-lg">
                Scheduled Service Rules &amp; History
              </CardTitle>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="relative lg:col-span-5">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search maintenance records"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      pagination.setPage(1);
                    }}
                    placeholder="Search service, type, vehicle, or plate..."
                    className="pl-10"
                  />
                </div>

                <div className="lg:col-span-3">
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
                      aria-label="Filter by vehicle"
                      className="w-full"
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
                </div>

                <div className="lg:col-span-3">
                  <Select
                    value={typeFilter}
                    items={MAINTENANCE_TYPE_FILTER_ITEMS}
                    onValueChange={(value) => {
                      if (value) {
                        setTypeFilter(value);
                        pagination.setPage(1);
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-label="Filter by service type"
                      className="w-full"
                    >
                      <SelectValue placeholder="All service types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TYPES}>
                        All service types
                      </SelectItem>
                      {MAINTENANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center lg:col-span-1">
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearFilters}
                      aria-label="Reset maintenance filters"
                      className="h-10 w-full rounded-xl px-2.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
                  <Wrench className="h-8 w-8 text-[var(--brand-teal)]" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    No maintenance records found
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service / Rule</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Triggers (Date / Odo / Hours)</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagination.pageItems.map(({ rec, vehicle, status }) => (
                          <TableRow key={rec.id}>
                            <TableCell>
                              <p className="font-medium text-foreground">
                                {rec.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {rec.type}
                                {rec.intervalKm
                                  ? ` · Every ${rec.intervalKm.toLocaleString()} km`
                                  : ""}
                              </p>
                            </TableCell>
                            <TableCell>
                              {vehicle?.name ?? "Unknown"}
                              {vehicle ? (
                                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                  {vehicle.plate}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status === "overdue"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className={
                                  status === "due_soon"
                                    ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                                    : status === "completed"
                                      ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                                      : ""
                                }
                              >
                                {status === "due_soon"
                                  ? "Due soon"
                                  : status.charAt(0).toUpperCase() +
                                    status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rec.completedDate ? (
                                <span>
                                  Completed {formatShortDate(rec.completedDate)}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  {rec.scheduledDate ? (
                                    <p>
                                      Date: {formatShortDate(rec.scheduledDate)}
                                    </p>
                                  ) : null}
                                  {rec.dueOdometerKm !== undefined ? (
                                    <p>
                                      Odo:{" "}
                                      {rec.dueOdometerKm.toLocaleString("en-US")}{" "}
                                      km
                                    </p>
                                  ) : null}
                                  {rec.dueEngineHours !== undefined ? (
                                    <p>Engine: {rec.dueEngineHours} hrs</p>
                                  ) : null}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {rec.cost !== undefined
                                ? formatCurrency(rec.cost)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canWriteMaint ? (
                                <div className="inline-flex items-center gap-1">
                                  {!rec.completedDate ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setCompletingRecord(rec);
                                        setCompleteDate(toIsoDate());
                                        setCompleteCost(
                                          rec.cost !== undefined
                                            ? String(rec.cost)
                                            : ""
                                        );
                                      }}
                                      className="h-7 rounded-lg px-2 text-xs"
                                    >
                                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-[var(--brand-teal)]" />
                                      Complete
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => openEditDialog(rec)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setDeletingRecord(rec)}
                                    className="text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
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
                    itemLabel="records"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: WORK ORDERS & VENDOR LOGS */}
        <TabsContent value="work_orders">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">
                  Work Orders &amp; Vendor Logs
                </CardTitle>
                <CardDescription>
                  Track repair tickets, garages, spare parts, warranty coverage,
                  and vehicle downtime.
                </CardDescription>
              </div>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={woSearch}
                  onChange={(e) => {
                    setWoSearch(e.target.value);
                    woPagination.setPage(1);
                  }}
                  placeholder="Search work order, vendor, or vehicle..."
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredWorkOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No work orders found.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticket / Parts</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Vendor / Garage</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Downtime / Warranty</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {woPagination.pageItems.map((wo) => {
                          const veh = vehiclesById.get(wo.vehicleId);
                          const total = computeWorkOrderTotal(wo);
                          return (
                            <TableRow key={wo.id}>
                              <TableCell>
                                <p className="font-medium text-foreground">
                                  {wo.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {wo.parts.length} part
                                  {wo.parts.length === 1 ? "" : "s"} · Priority{" "}
                                  <span className="capitalize">{wo.priority}</span>
                                </p>
                              </TableCell>
                              <TableCell className="font-medium">
                                {veh?.name ?? "Unknown"}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{wo.vendorName}</p>
                                {wo.mechanicPhone ? (
                                  <p className="text-xs text-muted-foreground">
                                    {wo.mechanicPhone}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {canWriteWorkOrders ? (
                                  <Select
                                    value={wo.status}
                                    items={WO_STATUS_ITEMS}
                                    onValueChange={(next) => {
                                      if (!next) return;
                                      updateWorkOrderStatus(
                                        wo.id,
                                        next as WorkOrderStatus
                                      );
                                      toast.success(
                                        `Work order marked ${WO_STATUS_ITEMS[next as WorkOrderStatus]}.`
                                      );
                                    }}
                                  >
                                    <SelectTrigger size="sm" className="w-36">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(
                                        Object.entries(WO_STATUS_ITEMS) as [
                                          WorkOrderStatus,
                                          string,
                                        ][]
                                      ).map(([k, label]) => (
                                        <SelectItem key={k} value={k}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="secondary">
                                    {WO_STATUS_ITEMS[wo.status]}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <p>{wo.downtimeHours}h downtime</p>
                                {wo.warrantyUntil ? (
                                  <p>
                                    Warranty: {formatShortDate(wo.warrantyUntil)}
                                  </p>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(total)}
                              </TableCell>
                              <TableCell className="text-right">
                                {canWriteWorkOrders ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      removeWorkOrder(wo.id);
                                      toast.success("Work order deleted.");
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={woPagination.page}
                    pageSize={woPagination.pageSize}
                    totalItems={woPagination.totalItems}
                    totalPages={woPagination.totalPages}
                    startIndex={woPagination.startIndex}
                    endIndex={woPagination.endIndex}
                    onPageChange={woPagination.setPage}
                    onPageSizeChange={woPagination.setPageSize}
                    itemLabel="work orders"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: INCIDENT & ACCIDENT REPORTS */}
        <TabsContent value="incidents">
          <Card className="rounded-2xl">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-lg">
                  Incident &amp; Accident Reports
                </CardTitle>
                <CardDescription>
                  Log road accidents with severity, location, third-party
                  insurance details, and damage photos.
                </CardDescription>
              </div>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={incSearch}
                  onChange={(e) => {
                    setIncSearch(e.target.value);
                    incPagination.setPage(1);
                  }}
                  placeholder="Search location, description, vehicle, driver..."
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredIncidents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No incidents reported.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date / Location</TableHead>
                          <TableHead>Vehicle / Driver</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Details / Third Party</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Est. Cost</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incPagination.pageItems.map((inc) => {
                          const veh = vehiclesById.get(inc.vehicleId);
                          const drv = inc.driverId
                            ? driversById.get(inc.driverId)
                            : undefined;
                          return (
                            <TableRow key={inc.id}>
                              <TableCell>
                                <p className="text-xs text-muted-foreground">
                                  {formatShortDate(inc.occurredAt)}
                                </p>
                                <p className="font-medium">{inc.locationLabel}</p>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium">
                                  {veh?.name ?? "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {drv?.name ?? "Unassigned"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    inc.severity === "major"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className={
                                    inc.severity === "moderate"
                                      ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                                      : ""
                                  }
                                >
                                  {INCIDENT_SEVERITY_ITEMS[inc.severity]}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs whitespace-normal">
                                <p className="text-xs text-foreground">
                                  {inc.description}
                                </p>
                                {inc.thirdPartyName ? (
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    3rd party: {inc.thirdPartyName}
                                    {inc.thirdPartyPlate
                                      ? ` (${inc.thirdPartyPlate})`
                                      : ""}
                                  </p>
                                ) : null}
                                {inc.photos.length > 0 ? (
                                  <div className="mt-1.5 flex gap-1">
                                    {inc.photos.map((p, idx) => (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        key={idx}
                                        src={p}
                                        alt="Damage"
                                        className="h-9 w-12 rounded border border-border object-cover"
                                      />
                                    ))}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {canWriteIncidents ? (
                                  <Select
                                    value={inc.status}
                                    items={INCIDENT_STATUS_ITEMS}
                                    onValueChange={(next) => {
                                      if (!next) return;
                                      updateIncidentStatus(
                                        inc.id,
                                        next as IncidentStatus
                                      );
                                      toast.success("Incident status updated.");
                                    }}
                                  >
                                    <SelectTrigger size="sm" className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(
                                        Object.entries(INCIDENT_STATUS_ITEMS) as [
                                          IncidentStatus,
                                          string,
                                        ][]
                                      ).map(([k, label]) => (
                                        <SelectItem key={k} value={k}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant="outline">
                                    {INCIDENT_STATUS_ITEMS[inc.status]}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {inc.estimatedCost !== undefined
                                  ? formatCurrency(inc.estimatedCost)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {canWriteIncidents ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => {
                                      removeIncident(inc.id);
                                      toast.success("Incident removed.");
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination
                    page={incPagination.page}
                    pageSize={incPagination.pageSize}
                    totalItems={incPagination.totalItems}
                    totalPages={incPagination.totalPages}
                    startIndex={incPagination.startIndex}
                    endIndex={incPagination.endIndex}
                    onPageChange={incPagination.setPage}
                    onPageSizeChange={incPagination.setPageSize}
                    itemLabel="incidents"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule / Edit Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Edit service rule" : "Schedule service rule"}
            </DialogTitle>
            <DialogDescription>
              Trigger alerts by calendar date, odometer reading, or engine hours
              with optional recurring intervals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maint-vehicle">Vehicle</Label>
              <Select
                value={form.vehicleId}
                items={vehicleSelectItems}
                onValueChange={(value) => {
                  if (value) setForm((prev) => ({ ...prev, vehicleId: value }));
                }}
              >
                <SelectTrigger id="maint-vehicle" className="w-full">
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
              <Label htmlFor="maint-title">Service title</Label>
              <Input
                id="maint-title"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Engine oil and filter change"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maint-type">Type</Label>
                <Select
                  value={form.type}
                  items={MAINTENANCE_TYPE_ITEMS}
                  onValueChange={(value) => {
                    if (value)
                      setForm((prev) => ({
                        ...prev,
                        type: value as MaintenanceType,
                      }));
                  }}
                >
                  <SelectTrigger id="maint-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maint-cost">Estimated cost ($)</Label>
                <Input
                  id="maint-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, cost: e.target.value }))
                  }
                  placeholder="85.00"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="maint-date">Due date</Label>
                <DatePicker
                  id="maint-date"
                  value={form.scheduledDate}
                  clearable
                  onChange={(scheduledDate) =>
                    setForm((prev) => ({ ...prev, scheduledDate }))
                  }
                  placeholder="Date"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maint-odo">Due odo (km)</Label>
                <Input
                  id="maint-odo"
                  type="number"
                  min={0}
                  value={form.dueOdometerKm}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dueOdometerKm: e.target.value,
                    }))
                  }
                  placeholder="50000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maint-hrs">Due engine hrs</Label>
                <Input
                  id="maint-hrs"
                  type="number"
                  min={0}
                  value={form.dueEngineHours}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dueEngineHours: e.target.value,
                    }))
                  }
                  placeholder="1500"
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-border bg-muted/25 p-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Repeat every (km)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.intervalKm}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, intervalKm: e.target.value }))
                  }
                  placeholder="5000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repeat every (days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.intervalDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      intervalDays: e.target.value,
                    }))
                  }
                  placeholder="90"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repeat every (hrs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.intervalEngineHours}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      intervalEngineHours: e.target.value,
                    }))
                  }
                  placeholder="250"
                />
              </div>
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
                {editingRecord ? "Save changes" : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Work Order Dialog */}
      <Dialog open={woDialogOpen} onOpenChange={setWoDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open Work Order</DialogTitle>
            <DialogDescription>
              Log a repair ticket with vendor/garage details, spare parts,
              warranty, and downtime.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkOrder} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vehicle</Label>
                <Select
                  value={woVehicleId}
                  items={vehicleSelectItems}
                  onValueChange={(v) => {
                    if (v) setWoVehicleId(v);
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
                <Label>Priority</Label>
                <Select
                  value={woPriority}
                  items={WO_PRIORITY_ITEMS}
                  onValueChange={(v) => {
                    if (v) setWoPriority(v as WorkOrderPriority);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(WO_PRIORITY_ITEMS) as [
                        WorkOrderPriority,
                        string,
                      ][]
                    ).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Repair title</Label>
              <Input
                required
                value={woTitle}
                onChange={(e) => setWoTitle(e.target.value)}
                placeholder="Alternator & serpentine belt replacement"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vendor / Garage name</Label>
                <Input
                  required
                  value={woVendor}
                  onChange={(e) => setWoVendor(e.target.value)}
                  placeholder="Dhaka Fleet Motors"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mechanic phone</Label>
                <Input
                  value={woPhone}
                  onChange={(e) => setWoPhone(e.target.value)}
                  placeholder="+880 1755-908112"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Labor cost ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={woLabor}
                  onChange={(e) => setWoLabor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Downtime (hrs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={woDowntime}
                  onChange={(e) => setWoDowntime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty until</Label>
                <DatePicker
                  value={woWarranty}
                  onChange={setWoWarranty}
                  clearable
                />
              </div>
            </div>

            {/* Spare Parts */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <Label className="text-xs font-semibold">Spare parts replaced</Label>
              <div className="grid gap-2 sm:grid-cols-12">
                <Input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Part name"
                  className="sm:col-span-5"
                />
                <Input
                  type="number"
                  min={1}
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  placeholder="Qty"
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={partCost}
                  onChange={(e) => setPartCost(e.target.value)}
                  placeholder="Unit $"
                  className="sm:col-span-3"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddPart}
                  className="h-10 rounded-xl sm:col-span-2"
                >
                  Add
                </Button>
              </div>
              {woParts.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border bg-card text-xs">
                  {woParts.map((pt) => (
                    <div
                      key={pt.id}
                      className="flex items-center justify-between px-2.5 py-1.5"
                    >
                      <span>
                        {pt.name} × {pt.qty} ({formatCurrency(pt.unitCost)})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setWoParts((prev) =>
                            prev.filter((p) => p.id !== pt.id)
                          )
                        }
                        className="text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWoDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Create work order
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Incident Report Dialog */}
      <Dialog open={incDialogOpen} onOpenChange={setIncDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Incident / Accident</DialogTitle>
            <DialogDescription>
              Log timestamped damage photos, location, and third-party details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateIncident} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vehicle</Label>
                <Select
                  value={incVehicleId}
                  items={vehicleSelectItems}
                  onValueChange={(v) => {
                    if (v) setIncVehicleId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
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
                <Label>Driver</Label>
                <Select
                  value={incDriverId}
                  items={driverSelectItems}
                  onValueChange={(v) => {
                    if (v) setIncDriverId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DRIVER}>Unassigned</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={incDate} onChange={setIncDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select
                  value={incSeverity}
                  items={INCIDENT_SEVERITY_ITEMS}
                  onValueChange={(v) => {
                    if (v) setIncSeverity(v as IncidentSeverity);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(INCIDENT_SEVERITY_ITEMS) as [
                        IncidentSeverity,
                        string,
                      ][]
                    ).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Est. cost ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={incEstCost}
                  onChange={(e) => setIncEstCost(e.target.value)}
                  placeholder="250"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Location / Intersection</Label>
              <Input
                required
                value={incLocation}
                onChange={(e) => setIncLocation(e.target.value)}
                placeholder="Gulshan 2 Circle, Northbound"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Incident description</Label>
              <Input
                required
                value={incDesc}
                onChange={(e) => setIncDesc(e.target.value)}
                placeholder="Describe damage and circumstances..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">3rd party name</Label>
                <Input
                  value={incThirdPartyName}
                  onChange={(e) => setIncThirdPartyName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">3rd party plate</Label>
                <Input
                  value={incThirdPartyPlate}
                  onChange={(e) => setIncThirdPartyPlate(e.target.value)}
                  placeholder="Optional"
                  className="uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">3rd party insurance</Label>
                <Input
                  value={incThirdPartyIns}
                  onChange={(e) => setIncThirdPartyIns(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Damage photos (up to 4)</Label>
              <MultiPhotoUpload
                values={incPhotos}
                onChange={setIncPhotos}
                label="Add damage photo"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIncDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" className="rounded-xl">
                Submit incident
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complete Service Dialog */}
      <Dialog
        open={completingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setCompletingRecord(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete service</DialogTitle>
            <DialogDescription>
              Record completion details for {completingRecord?.title}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCompleteSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="complete-date">Completed date</Label>
              <DatePicker
                id="complete-date"
                value={completeDate}
                onChange={setCompleteDate}
                placeholder="Select completion date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-cost">Final cost (optional)</Label>
              <Input
                id="complete-cost"
                type="number"
                min={0}
                step="0.01"
                value={completeCost}
                onChange={(e) => setCompleteCost(e.target.value)}
                placeholder="95.00"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCompletingRecord(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Mark completed
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Next Recurring Prompt */}
      <AlertDialog
        open={scheduleNextPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setScheduleNextPrompt(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-[var(--brand-teal)]" />
              Schedule the next recurring service?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pre-fill the next{" "}
              <span className="font-medium text-foreground">
                {scheduleNextPrompt?.title}
              </span>{" "}
              using its recurring rule (+
              {scheduleNextPrompt?.intervalDays ?? 90}d / +
              {(scheduleNextPrompt?.intervalKm ?? 5000).toLocaleString()} km)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleScheduleNext}
              className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Schedule next
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRecord(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingRecord?.title} permanently.
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
