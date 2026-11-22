"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  Wrench,
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
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  getMaintenanceStatus,
  type MaintenanceStatus,
} from "@/lib/maintenance";
import type { MaintenanceRecord, MaintenanceType } from "@/types";

const MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  "Oil change",
  "Tire service",
  "Brake inspection",
  "Battery check",
  "General service",
  "Inspection",
];

type StatusFilter = "all" | MaintenanceStatus;

interface MaintenanceFormState {
  vehicleId: string;
  title: string;
  type: MaintenanceType;
  scheduledDate: string;
  dueOdometerKm: string;
  cost: string;
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export default function MaintenancePage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const records = useFleetStore((s) => s.maintenanceRecords);
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(
    null
  );
  const [deletingRecord, setDeletingRecord] =
    useState<MaintenanceRecord | null>(null);
  const [completingRecord, setCompletingRecord] =
    useState<MaintenanceRecord | null>(null);
  const [completeDate, setCompleteDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [completeCost, setCompleteCost] = useState("");
  const [scheduleNextPrompt, setScheduleNextPrompt] =
    useState<MaintenanceRecord | null>(null);

  const [form, setForm] = useState<MaintenanceFormState>({
    vehicleId: vehicles[0]?.id ?? "",
    title: "",
    type: "Oil change",
    scheduledDate: addDaysIso(30),
    dueOdometerKm: "",
    cost: "",
  });
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const enriched = useMemo(() => {
    const order: Record<MaintenanceStatus, number> = {
      overdue: 0,
      due_soon: 1,
      upcoming: 2,
      completed: 3,
    };

    return records
      .map((rec) => {
        const vehicle = vehiclesById.get(rec.vehicleId);
        const status = getMaintenanceStatus(rec, vehicle?.odometerKm ?? 0);
        return { rec, vehicle, status };
      })
      .sort((a, b) => order[a.status] - order[b.status]);
  }, [records, vehiclesById]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? enriched
        : enriched.filter((item) => item.status === statusFilter),
    [enriched, statusFilter]
  );

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
  const completedCount = enriched.filter((i) => i.status === "completed").length;

  const openAddDialog = (prefill?: Partial<MaintenanceFormState>) => {
    setEditingRecord(null);
    setError(null);
    const defaultVeh = vehicles[0];
    setForm({
      vehicleId: prefill?.vehicleId ?? defaultVeh?.id ?? "",
      title: prefill?.title ?? "",
      type: prefill?.type ?? "Oil change",
      scheduledDate: prefill?.scheduledDate ?? addDaysIso(30),
      dueOdometerKm: prefill?.dueOdometerKm ?? "",
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
    if (!form.scheduledDate && !form.dueOdometerKm) {
      setError("Provide a scheduled date, a due odometer reading, or both.");
      return;
    }

    const dueOdo = form.dueOdometerKm ? Number(form.dueOdometerKm) : undefined;
    const cost = form.cost ? Number(form.cost) : undefined;

    if (dueOdo !== undefined && (Number.isNaN(dueOdo) || dueOdo < 0)) {
      setError("Due odometer must be 0 or greater.");
      return;
    }
    if (cost !== undefined && (Number.isNaN(cost) || cost < 0)) {
      setError("Cost must be 0 or greater.");
      return;
    }

    const payload = {
      vehicleId: form.vehicleId,
      title: form.title.trim(),
      type: form.type,
      scheduledDate: form.scheduledDate || undefined,
      dueOdometerKm: dueOdo,
      completedDate: editingRecord?.completedDate,
      cost,
    };

    if (editingRecord) {
      updateMaintenanceRecord(editingRecord.id, payload);
      toast.success("Maintenance record updated.");
    } else {
      addMaintenanceRecord(payload);
      toast.success("Maintenance record scheduled.");
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
    const nextOdo = Math.round((vehicle?.odometerKm ?? 0) + 5000);
    const rec = scheduleNextPrompt;
    setScheduleNextPrompt(null);
    openAddDialog({
      vehicleId: rec.vehicleId,
      title: rec.title,
      type: rec.type,
      scheduledDate: addDaysIso(90),
      dueOdometerKm: String(nextOdo),
      cost: rec.cost !== undefined ? String(rec.cost) : "",
    });
  };

  const handleDelete = () => {
    if (!deletingRecord) return;
    removeMaintenanceRecord(deletingRecord.id);
    toast.success("Maintenance record removed.");
    setDeletingRecord(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Maintenance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule services by date or odometer. Alerts appear automatically
            within 14 days or 500 km.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => openAddDialog()}
          disabled={vehicles.length === 0}
          className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Schedule service
        </Button>
      </div>

      {/* Status KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="font-display text-2xl text-destructive">
              {overdueCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Due soon (14d / 500 km)</CardDescription>
            <CardTitle className="font-display text-2xl text-[var(--brand-amber)]">
              {dueSoonCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="font-display text-2xl text-[var(--brand-teal)]">
              {completedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter pills */}
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
            onClick={() => setStatusFilter(val)}
            className="rounded-xl"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Records table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Service records</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
              <Wrench className="h-8 w-8 text-[var(--brand-teal)]" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No maintenance records found
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Schedule an upcoming oil change, tire rotation, or inspection to
                receive timely alerts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Schedule / Odometer</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ rec, vehicle, status }) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {rec.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rec.type}
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
                            status === "overdue" ? "destructive" : "secondary"
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
                            : status.charAt(0).toUpperCase() + status.slice(1)}
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
                              <p>Date: {formatShortDate(rec.scheduledDate)}</p>
                            ) : null}
                            {rec.dueOdometerKm !== undefined ? (
                              <p>
                                Odo:{" "}
                                {rec.dueOdometerKm.toLocaleString("en-US")} km
                              </p>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {rec.cost !== undefined ? formatCurrency(rec.cost) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {!rec.completedDate ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCompletingRecord(rec);
                                setCompleteDate(
                                  new Date().toISOString().slice(0, 10)
                                );
                                setCompleteCost(
                                  rec.cost !== undefined ? String(rec.cost) : ""
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
                            aria-label="Edit service record"
                            onClick={() => openEditDialog(rec)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete service record"
                            onClick={() => setDeletingRecord(rec)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule / Edit Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? "Edit service record" : "Schedule service"}
            </DialogTitle>
            <DialogDescription>
              Set a target date, odometer threshold, or both.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maint-vehicle">Vehicle</Label>
              <Select
                value={form.vehicleId}
                onValueChange={(value) => {
                  if (value) setForm((prev) => ({ ...prev, vehicleId: value }));
                }}
              >
                <SelectTrigger
                  id="maint-vehicle"
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
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maint-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => {
                    if (value)
                      setForm((prev) => ({
                        ...prev,
                        type: value as MaintenanceType,
                      }));
                  }}
                >
                  <SelectTrigger
                    id="maint-type"
                    className="h-10 w-full rounded-xl"
                  >
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
                <Label htmlFor="maint-cost">Estimated cost (optional)</Label>
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
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maint-date">Scheduled date</Label>
                <Input
                  id="maint-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      scheduledDate: e.target.value,
                    }))
                  }
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maint-odo">Due odometer (km)</Label>
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
                  className="h-10 rounded-xl"
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
              <Button
                type="submit"
                className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {editingRecord ? "Save changes" : "Schedule"}
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
              <Input
                id="complete-date"
                type="date"
                required
                value={completeDate}
                onChange={(e) => setCompleteDate(e.target.value)}
                className="h-10 rounded-xl"
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
                className="h-10 rounded-xl"
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
              <Button
                type="submit"
                className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Mark completed
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Offer to schedule next service */}
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
              Schedule the next service?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to pre-fill the next{" "}
              <span className="font-medium text-foreground">
                {scheduleNextPrompt?.title}
              </span>{" "}
              in 90 days or +5,000 km?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">
              Not now
            </AlertDialogCancel>
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
