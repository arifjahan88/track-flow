"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarClock,
  History,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
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
  CardFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  checkDriverAvailability,
  computeDriverSafetyScore,
  computeDriverStats,
  DAY_OF_WEEK_LABELS,
  getLicenseStatus,
} from "@/lib/drivers";
import { formatKm, formatShortDate, offsetIsoDate, toIsoDate } from "@/lib/format";
import { can } from "@/lib/rbac";
import type { Driver } from "@/types";

const UNASSIGNED_VALUE = "__unassigned__";
const LICENSE_CLASSES = [
  "Light Motor (Class B)",
  "Medium Commercial (Class C1)",
  "Heavy Commercial (Class C)",
  "Motorcycle (Class A)",
] as const;
const LICENSE_CLASS_ITEMS: Record<string, string> = Object.fromEntries(
  LICENSE_CLASSES.map((c) => [c, c])
);
const DAY_ITEMS: Record<string, string> = Object.fromEntries(
  DAY_OF_WEEK_LABELS.map((label, idx) => [String(idx), label])
);

interface DriverFormState {
  name: string;
  phone: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  assignedVehicleId: string;
}

export default function DriversPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canEditDrivers = can(currentRole, "drivers:write");

  const drivers = useFleetStore((s) => s.drivers);
  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);

  const addDriver = useFleetStore((s) => s.addDriver);
  const updateDriver = useFleetStore((s) => s.updateDriver);
  const removeDriver = useFleetStore((s) => s.removeDriver);
  const addDriverShift = useFleetStore((s) => s.addDriverShift);
  const removeDriverShift = useFleetStore((s) => s.removeDriverShift);
  const addDriverLeave = useFleetStore((s) => s.addDriverLeave);
  const removeDriverLeave = useFleetStore((s) => s.removeDriverLeave);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [scheduleDriverId, setScheduleDriverId] = useState<string | null>(null);

  const [shiftDay, setShiftDay] = useState("1");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const [form, setForm] = useState<DriverFormState>({
    name: "",
    phone: "",
    licenseNumber: "",
    licenseClass: LICENSE_CLASSES[0],
    licenseExpiry: "",
    assignedVehicleId: UNASSIGNED_VALUE,
  });
  const [error, setError] = useState<string | null>(null);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = { [UNASSIGNED_VALUE]: "Unassigned" };
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  const scheduleDriver = useMemo(
    () => drivers.find((d) => d.id === scheduleDriverId) ?? null,
    [drivers, scheduleDriverId]
  );

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const todayIso = toIsoDate();

  const openAddDialog = () => {
    setEditingDriver(null);
    setError(null);
    setForm({
      name: "",
      phone: "",
      licenseNumber: "",
      licenseClass: LICENSE_CLASSES[0],
      licenseExpiry: offsetIsoDate(180),
      assignedVehicleId: UNASSIGNED_VALUE,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setError(null);
    setForm({
      name: driver.name,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      licenseClass: driver.licenseClass ?? LICENSE_CLASSES[0],
      licenseExpiry: driver.licenseExpiry,
      assignedVehicleId: driver.assignedVehicleId ?? UNASSIGNED_VALUE,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Driver name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!form.licenseNumber.trim()) {
      setError("License number is required.");
      return;
    }
    if (!form.licenseExpiry) {
      setError("License expiry date is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      licenseNumber: form.licenseNumber.trim().toUpperCase(),
      licenseClass: form.licenseClass,
      licenseExpiry: form.licenseExpiry,
      assignedVehicleId:
        form.assignedVehicleId === UNASSIGNED_VALUE
          ? undefined
          : form.assignedVehicleId,
    };

    if (editingDriver) {
      updateDriver(editingDriver.id, payload);
      toast.success(`Updated driver ${payload.name}.`);
    } else {
      addDriver(payload);
      toast.success(`Added driver ${payload.name}.`);
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deletingDriver) return;
    removeDriver(deletingDriver.id);
    toast.success(`Removed driver ${deletingDriver.name}.`);
    setDeletingDriver(null);
  };

  const handleAddShift = (e: FormEvent) => {
    e.preventDefault();
    if (!scheduleDriver) return;
    addDriverShift(scheduleDriver.id, {
      dayOfWeek: Number(shiftDay),
      startTime: shiftStart,
      endTime: shiftEnd,
    });
    toast.success("Shift added.");
  };

  const handleAddLeave = (e: FormEvent) => {
    e.preventDefault();
    if (!scheduleDriver || !leaveFrom || !leaveTo) {
      toast.error("Select a leave date range.");
      return;
    }
    addDriverLeave(scheduleDriver.id, {
      fromDate: leaveFrom,
      toDate: leaveTo,
      reason: leaveReason.trim() || "Scheduled leave",
    });
    setLeaveFrom("");
    setLeaveTo("");
    setLeaveReason("");
    toast.success("Leave logged — driver will be blocked from double-booking.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Driver &amp; Staff Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track license classes, safety scores (braking, speeding, idle,
            on-time), assignment history, and shift/leave availability.
          </p>
        </div>

        {canEditDrivers ? (
          <Button
            type="button"
            onClick={openAddDialog}
            className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add driver
          </Button>
        ) : null}
      </div>

      {drivers.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="h-8 w-8 text-[var(--brand-teal)]" />
            <p className="mt-3 text-base font-medium text-foreground">
              No drivers added yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add drivers to track licenses, safety scores, and shift schedules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const licenseStatus = getLicenseStatus(driver.licenseExpiry);
            const assignedVehicle = driver.assignedVehicleId
              ? vehiclesById.get(driver.assignedVehicleId)
              : undefined;
            const stats = computeDriverStats(driver.id, trips);
            const safety = computeDriverSafetyScore(driver.id, trips);
            const avail = checkDriverAvailability(driver, todayIso, trips);

            return (
              <StaggerItem key={driver.id} hoverLift>
                <Card className="flex h-full flex-col rounded-2xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg">
                          {driver.name}
                        </CardTitle>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={
                            licenseStatus === "expired"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            licenseStatus === "expiring_soon"
                              ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                              : licenseStatus === "valid"
                                ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                                : ""
                          }
                        >
                          {licenseStatus === "expired"
                            ? "Expired"
                            : licenseStatus === "expiring_soon"
                              ? "Expires <30d"
                              : "Valid license"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            avail.available
                              ? "border-[var(--brand-teal)]/30 text-[var(--brand-teal)]"
                              : "border-[var(--brand-amber)]/40 text-[var(--brand-amber)]"
                          }
                        >
                          {avail.available ? "Available today" : "Unavailable"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 text-sm">
                    {/* Safety Score Box */}
                    <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
                          Safety Score
                        </span>
                        <span className="font-display text-sm font-bold text-primary">
                          {safety.score}/100 · {safety.grade}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="rounded-lg bg-background/70 px-1 py-1">
                          <p className="font-semibold text-foreground">
                            {safety.harshBraking}
                          </p>
                          <p className="text-muted-foreground">Harsh brk</p>
                        </div>
                        <div className="rounded-lg bg-background/70 px-1 py-1">
                          <p className="font-semibold text-foreground">
                            {safety.speedingIncidents}
                          </p>
                          <p className="text-muted-foreground">Speeding</p>
                        </div>
                        <div className="rounded-lg bg-background/70 px-1 py-1">
                          <p className="font-semibold text-foreground">
                            {safety.idleMinutes}m
                          </p>
                          <p className="text-muted-foreground">Idle</p>
                        </div>
                        <div className="rounded-lg bg-background/70 px-1 py-1">
                          <p className="font-semibold text-foreground">
                            {safety.onTimeRatePct}%
                          </p>
                          <p className="text-muted-foreground">On-time</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 rounded-xl border border-border/70 bg-muted/25 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">License</span>
                        <span className="truncate font-mono font-medium text-foreground">
                          {driver.licenseNumber}
                        </span>
                      </div>
                      {driver.licenseClass ? (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Class</span>
                          <span className="truncate font-medium text-foreground">
                            {driver.licenseClass}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Expiry</span>
                        <span className="font-medium text-foreground">
                          {formatShortDate(driver.licenseExpiry)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Vehicle</span>
                        <span className="truncate font-medium text-foreground">
                          {assignedVehicle ? assignedVehicle.name : "Unassigned"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                        <p className="font-display text-sm font-semibold text-foreground">
                          {stats.completedTrips}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Trips
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                        <p className="font-display text-sm font-semibold text-foreground">
                          {formatKm(stats.totalDistanceKm)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">km</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                        <p className="font-display text-sm font-semibold text-foreground">
                          {stats.topSpeedKmh}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Max km/h
                        </p>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between gap-1.5 border-t border-border/60 pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setScheduleDriverId(driver.id)}
                      className="rounded-xl"
                    >
                      <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                      Shifts &amp; history
                    </Button>
                    {canEditDrivers ? (
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Edit ${driver.name}`}
                          onClick={() => openEditDialog(driver)}
                          className="rounded-lg"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Delete ${driver.name}`}
                          onClick={() => setDeletingDriver(driver)}
                          className="rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </CardFooter>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {/* Shifts, Leave & Vehicle Assignment History Dialog */}
      <Dialog
        open={scheduleDriver !== null}
        onOpenChange={(open) => {
          if (!open) setScheduleDriverId(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{scheduleDriver?.name} — Schedule &amp; History</DialogTitle>
            <DialogDescription>
              Manage weekly shifts, leave logs (prevents double-booking), and
              assigned vehicle history.
            </DialogDescription>
          </DialogHeader>

          {scheduleDriver ? (
            <Tabs defaultValue="shifts" className="mt-1">
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                <TabsTrigger value="shifts" className="rounded-lg">
                  Shifts ({scheduleDriver.shifts?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="leave" className="rounded-lg">
                  Leave ({scheduleDriver.leaveLogs?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg">
                  <History className="mr-1 h-3.5 w-3.5" />
                  Vehicles ({scheduleDriver.assignedVehicleHistory?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="shifts" className="mt-4 space-y-4">
                {canEditDrivers ? (
                  <form
                    onSubmit={handleAddShift}
                    className="grid gap-2.5 sm:grid-cols-4"
                  >
                    <Select
                      value={shiftDay}
                      items={DAY_ITEMS}
                      onValueChange={(v) => {
                        if (v) setShiftDay(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_OF_WEEK_LABELS.map((d, idx) => (
                          <SelectItem key={d} value={String(idx)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={shiftStart}
                      onChange={(e) => setShiftStart(e.target.value)}
                    />
                    <Input
                      type="time"
                      value={shiftEnd}
                      onChange={(e) => setShiftEnd(e.target.value)}
                    />
                    <Button type="submit" className="h-10 rounded-xl">
                      Add shift
                    </Button>
                  </form>
                ) : null}

                <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {(scheduleDriver.shifts ?? []).length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      No shifts configured (driver available any day).
                    </p>
                  ) : (
                    (scheduleDriver.shifts ?? []).map((sh) => (
                      <div
                        key={sh.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>
                          <strong>{DAY_OF_WEEK_LABELS[sh.dayOfWeek]}</strong> ·{" "}
                          {sh.startTime} – {sh.endTime}
                        </span>
                        {canEditDrivers ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              removeDriverShift(scheduleDriver.id, sh.id)
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="leave" className="mt-4 space-y-4">
                {canEditDrivers ? (
                  <form onSubmit={handleAddLeave} className="space-y-2.5">
                    <DateRangePicker
                      fromDate={leaveFrom}
                      toDate={leaveTo}
                      presets={false}
                      onChange={({ fromDate, toDate }) => {
                        setLeaveFrom(fromDate);
                        setLeaveTo(toDate);
                      }}
                      placeholder="Select leave dates"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="Leave reason (Annual, Medical...)"
                      />
                      <Button type="submit" className="h-10 shrink-0 rounded-xl">
                        Log leave
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {(scheduleDriver.leaveLogs ?? []).length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      No leave periods logged.
                    </p>
                  ) : (
                    (scheduleDriver.leaveLogs ?? []).map((lv) => (
                      <div
                        key={lv.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{lv.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(lv.fromDate)} –{" "}
                            {formatShortDate(lv.toDate)}
                          </p>
                        </div>
                        {canEditDrivers ? (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              removeDriverLeave(scheduleDriver.id, lv.id)
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {(scheduleDriver.assignedVehicleHistory ?? []).length ===
                  0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      No vehicle assignment history recorded yet.
                    </p>
                  ) : (
                    (scheduleDriver.assignedVehicleHistory ?? []).map(
                      (item, idx) => {
                        const veh = vehiclesById.get(item.vehicleId);
                        return (
                          <div
                            key={`${item.vehicleId}-${idx}`}
                            className="flex items-center justify-between px-3 py-2.5 text-sm"
                          >
                            <div>
                              <p className="font-medium text-foreground">
                                {veh ? `${veh.name} (${veh.plate})` : item.vehicleId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Assigned {formatShortDate(item.assignedAt)}
                                {item.unassignedAt
                                  ? ` → Ended ${formatShortDate(item.unassignedAt)}`
                                  : " → Current"}
                              </p>
                            </div>
                            {!item.unassignedAt ? (
                              <Badge variant="secondary">Current</Badge>
                            ) : null}
                          </div>
                        );
                      }
                    )
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Driver Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? "Edit driver" : "Add driver"}
            </DialogTitle>
            <DialogDescription>
              Store driver contact details, license class, expiry, and default
              vehicle.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">Full name</Label>
              <Input
                id="driver-name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Rafiq Hasan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-phone">Phone number</Label>
              <Input
                id="driver-phone"
                required
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+880 1711-234567"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-license">License number</Label>
                <Input
                  id="driver-license"
                  required
                  value={form.licenseNumber}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      licenseNumber: e.target.value,
                    }))
                  }
                  placeholder="DL-DHK-904821"
                  className="uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver-expiry">License expiry</Label>
                <DatePicker
                  id="driver-expiry"
                  value={form.licenseExpiry}
                  onChange={(licenseExpiry) =>
                    setForm((prev) => ({
                      ...prev,
                      licenseExpiry,
                    }))
                  }
                  placeholder="Select expiry date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-class">License class</Label>
              <Select
                value={form.licenseClass}
                items={LICENSE_CLASS_ITEMS}
                onValueChange={(value) => {
                  if (value)
                    setForm((prev) => ({ ...prev, licenseClass: value }));
                }}
              >
                <SelectTrigger id="driver-class" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-vehicle">
                Assigned vehicle (optional)
              </Label>
              <Select
                value={form.assignedVehicleId}
                items={vehicleSelectItems}
                onValueChange={(value) => {
                  if (value)
                    setForm((prev) => ({ ...prev, assignedVehicleId: value }));
                }}
              >
                <SelectTrigger id="driver-vehicle" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} ({v.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {editingDriver ? "Save changes" : "Add driver"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingDriver !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingDriver(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete driver?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deletingDriver?.name} from your roster. Completed
              trip records remain intact.
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
