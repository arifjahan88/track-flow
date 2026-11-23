"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { TablePagination, usePagination } from "@/components/table-pagination";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { checkDriverAvailability } from "@/lib/drivers";
import { formatShortDate, toIsoDate } from "@/lib/format";
import { can } from "@/lib/rbac";
import type { TripBooking } from "@/types";

const NO_OPTION = "__none__";

export function BookingsPanel({
  onDispatchBooking,
}: {
  onDispatchBooking: (booking: TripBooking) => void;
}) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const canApprove = can(currentUser?.role ?? "super_admin", "dispatch:approve");

  const bookings = useFleetStore((s) => s.bookings);
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const addBooking = useFleetStore((s) => s.addBooking);
  const updateBookingStatus = useFleetStore((s) => s.updateBookingStatus);
  const removeBooking = useFleetStore((s) => s.removeBooking);

  const [open, setOpen] = useState(false);
  const [requester, setRequester] = useState("");
  const [department, setDepartment] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [estimatedKm, setEstimatedKm] = useState("20");
  const [vehicleId, setVehicleId] = useState(NO_OPTION);
  const [driverId, setDriverId] = useState(NO_OPTION);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const vehicleItems = useMemo(() => {
    const map: Record<string, string> = { [NO_OPTION]: "Auto-select vehicle" };
    for (const v of vehicles) map[v.id] = `${v.name} (${v.plate})`;
    return map;
  }, [vehicles]);

  const driverItems = useMemo(() => {
    const map: Record<string, string> = {
      [NO_OPTION]: "Auto-assign available driver",
    };
    for (const d of drivers) map[d.id] = d.name;
    return map;
  }, [drivers]);

  const pagination = usePagination(bookings, 8);

  const openModal = () => {
    setRequester(currentUser?.name ?? "");
    setDepartment("Operations");
    setPurpose("");
    setRequestedDate(toIsoDate());
    setEstimatedKm("20");
    setVehicleId(NO_OPTION);
    setDriverId(NO_OPTION);
    setOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!requester.trim() || !purpose.trim()) {
      toast.error("Provide requester name and trip purpose.");
      return;
    }
    const targetDate = requestedDate || toIsoDate();

    let resolvedDriverId = driverId === NO_OPTION ? undefined : driverId;
    if (resolvedDriverId) {
      const drv = driversById.get(resolvedDriverId);
      if (drv) {
        const avail = checkDriverAvailability(drv, targetDate, trips);
        if (!avail.available) {
          toast.error(`Driver conflict: ${avail.reason}`);
          return;
        }
      }
    } else {
      const autoDriver = drivers.find(
        (d) => checkDriverAvailability(d, targetDate, trips).available
      );
      resolvedDriverId = autoDriver?.id;
    }

    const resolvedVehicleId =
      vehicleId === NO_OPTION
        ? vehicles.find((v) => (v.status ?? "available") === "available")?.id
        : vehicleId;

    addBooking({
      requesterName: requester.trim(),
      department: department.trim() || undefined,
      purpose: purpose.trim(),
      requestedDate: targetDate,
      estimatedKm: Math.max(1, Number(estimatedKm) || 10),
      vehicleId: resolvedVehicleId,
      driverId: resolvedDriverId,
    });
    toast.success("Vehicle booking submitted for approval.");
    setOpen(false);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">
            Vehicle Bookings &amp; Approval Queue ({bookings.length})
          </CardTitle>
          <CardDescription>
            Staff request vehicles → managers approve with shift conflict checks
            → one-click dispatch.
          </CardDescription>
        </div>
        <Button type="button" onClick={openModal} className="h-10 rounded-xl">
          <Plus className="mr-1.5 h-4 w-4" />
          Request vehicle
        </Button>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No booking requests yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requester / Date</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Vehicle / Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((b) => {
                    const veh = b.vehicleId
                      ? vehiclesById.get(b.vehicleId)
                      : undefined;
                    const drv = b.driverId
                      ? driversById.get(b.driverId)
                      : undefined;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <p className="font-medium">{b.requesterName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(b.requestedDate)}
                            {b.department ? ` · ${b.department}` : ""}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{b.purpose}</p>
                          <p className="text-xs text-muted-foreground">
                            Est. {b.estimatedKm} km
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium text-foreground">
                            {veh ? `${veh.name} (${veh.plate})` : "Unassigned"}
                          </p>
                          <p className="text-muted-foreground">
                            Driver: {drv?.name ?? "Auto / Unassigned"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              b.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                            className={
                              b.status === "approved" ||
                              b.status === "dispatched"
                                ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                                : b.status === "pending"
                                  ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                                  : ""
                            }
                          >
                            {b.status.charAt(0).toUpperCase() +
                              b.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            {b.status === "pending" && canApprove ? (
                              <>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    updateBookingStatus(b.id, "approved");
                                    toast.success("Booking approved.");
                                  }}
                                  className="rounded-lg text-[var(--brand-teal)]"
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    updateBookingStatus(b.id, "rejected");
                                    toast.info("Booking rejected.");
                                  }}
                                  className="rounded-lg text-destructive"
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            {b.status === "approved" ? (
                              <Button
                                type="button"
                                size="xs"
                                onClick={() => onDispatchBooking(b)}
                                className="rounded-lg"
                              >
                                Dispatch
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeBooking(b.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
              itemLabel="bookings"
            />
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a Vehicle</DialogTitle>
            <DialogDescription>
              Automatic shift &amp; leave validation prevents driver
              double-booking.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Requester name</Label>
                <Input
                  required
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Trip purpose</Label>
              <Input
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Client delivery or depot transfer"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Requested date</Label>
                <DatePicker value={requestedDate} onChange={setRequestedDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Estimated distance (km)</Label>
                <Input
                  type="number"
                  min={1}
                  value={estimatedKm}
                  onChange={(e) => setEstimatedKm(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Preferred vehicle</Label>
                <Select
                  value={vehicleId}
                  items={vehicleItems}
                  onValueChange={(v) => {
                    if (v) setVehicleId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_OPTION}>
                      Auto-select vehicle
                    </SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Driver assignment</Label>
                <Select
                  value={driverId}
                  items={driverItems}
                  onValueChange={(v) => {
                    if (v) setDriverId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_OPTION}>
                      Auto-assign available driver
                    </SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Submit booking
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
