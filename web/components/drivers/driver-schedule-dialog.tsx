"use client";

import { useState, type FormEvent } from "react";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetStore } from "@/store/fleet-store";
import { DAY_OF_WEEK_LABELS } from "@/lib/drivers";
import { formatShortDate } from "@/lib/format";
import type { Driver, Vehicle } from "@/types";

const DAY_ITEMS: Record<string, string> = Object.fromEntries(
  DAY_OF_WEEK_LABELS.map((label, idx) => [String(idx), label])
);

interface DriverScheduleDialogProps {
  driver: Driver | null;
  vehiclesById: ReadonlyMap<string, Vehicle>;
  canEdit: boolean;
  onClose: () => void;
}

export function DriverScheduleDialog({
  driver,
  vehiclesById,
  canEdit,
  onClose,
}: DriverScheduleDialogProps) {
  const addDriverShift = useFleetStore((s) => s.addDriverShift);
  const removeDriverShift = useFleetStore((s) => s.removeDriverShift);
  const addDriverLeave = useFleetStore((s) => s.addDriverLeave);
  const removeDriverLeave = useFleetStore((s) => s.removeDriverLeave);

  const [shiftDay, setShiftDay] = useState("1");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const handleAddShift = (e: FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    addDriverShift(driver.id, {
      dayOfWeek: Number(shiftDay),
      startTime: shiftStart,
      endTime: shiftEnd,
    });
    toast.success("Shift added.");
  };

  const handleAddLeave = (e: FormEvent) => {
    e.preventDefault();
    if (!driver || !leaveFrom || !leaveTo) {
      toast.error("Select a leave date range.");
      return;
    }
    addDriverLeave(driver.id, {
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
    <Dialog
      open={driver !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{driver?.name} — Schedule &amp; History</DialogTitle>
          <DialogDescription>
            Manage weekly shifts, leave logs (prevents double-booking), and
            assigned vehicle history.
          </DialogDescription>
        </DialogHeader>

        {driver ? (
          <Tabs defaultValue="shifts" className="mt-1">
            <TabsList className="grid w-full grid-cols-3 rounded-xl">
              <TabsTrigger value="shifts" className="rounded-lg">
                Shifts ({driver.shifts?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="leave" className="rounded-lg">
                Leave ({driver.leaveLogs?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg">
                <History className="mr-1 h-3.5 w-3.5" />
                Vehicles ({driver.assignedVehicleHistory?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shifts" className="mt-4 space-y-4">
              {canEdit ? (
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
                {(driver.shifts ?? []).length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No shifts configured (driver available any day).
                  </p>
                ) : (
                  (driver.shifts ?? []).map((sh) => (
                    <div
                      key={sh.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>
                        <strong>{DAY_OF_WEEK_LABELS[sh.dayOfWeek]}</strong> ·{" "}
                        {sh.startTime} – {sh.endTime}
                      </span>
                      {canEdit ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => removeDriverShift(driver.id, sh.id)}
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
              {canEdit ? (
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
                {(driver.leaveLogs ?? []).length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No leave periods logged.
                  </p>
                ) : (
                  (driver.leaveLogs ?? []).map((lv) => (
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
                      {canEdit ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => removeDriverLeave(driver.id, lv.id)}
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
                {(driver.assignedVehicleHistory ?? []).length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    No vehicle assignment history recorded yet.
                  </p>
                ) : (
                  (driver.assignedVehicleHistory ?? []).map((item, idx) => {
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
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
