"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Plus,
  Radar,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { MultiPhotoUpload, SinglePhotoUpload } from "@/components/photo-upload";
import { SignaturePad } from "@/components/signature-pad";
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
import { Switch } from "@/components/ui/switch";
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
import { formatDateTime, formatShortDate, toIsoDate } from "@/lib/format";
import { can } from "@/lib/rbac";
import type {
  GeofenceZoneType,
  TripBooking,
  TripChecklist,
  TripWaypoint,
} from "@/types";

const GEOFENCE_TYPE_ITEMS: Record<GeofenceZoneType, string> = {
  warehouse: "Warehouse / Hub",
  client_site: "Client Site",
  restricted: "Restricted Zone",
};

const NO_OPTION = "__none__";

// ---------------------------------------------------------------------------
// 1. Pre-Trip / Post-Trip Walkaround Checklist Dialog
// ---------------------------------------------------------------------------

interface TripChecklistDialogProps {
  open: boolean;
  phase: "pre" | "post";
  onOpenChange: (open: boolean) => void;
  onConfirm: (checklist: TripChecklist) => void;
}

export function TripChecklistDialog({
  open,
  phase,
  onOpenChange,
  onConfirm,
}: TripChecklistDialogProps) {
  const [tiresOk, setTiresOk] = useState(true);
  const [lightsOk, setLightsOk] = useState(true);
  const [brakesOk, setBrakesOk] = useState(true);
  const [fluidsOk, setFluidsOk] = useState(true);
  const [bodyOk, setBodyOk] = useState(true);
  const [notes, setNotes] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm({
      phase,
      completedAt: new Date().toISOString(),
      tiresOk,
      lightsOk,
      brakesOk,
      fluidsOk,
      bodyOk,
      notes: notes.trim() || undefined,
      damagePhotos,
    });
    setNotes("");
    setDamagePhotos([]);
  };

  const checks: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    { id: "chk-tires", label: "Tire pressure & tread OK", checked: tiresOk, onChange: setTiresOk },
    { id: "chk-lights", label: "Headlights, brake lights & indicators OK", checked: lightsOk, onChange: setLightsOk },
    { id: "chk-brakes", label: "Service & parking brakes responsive", checked: brakesOk, onChange: setBrakesOk },
    { id: "chk-fluids", label: "Oil, coolant & washer fluid levels OK", checked: fluidsOk, onChange: setFluidsOk },
    { id: "chk-body", label: "Exterior body & mirrors free of new damage", checked: bodyOk, onChange: setBodyOk },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {phase === "pre"
              ? "Pre-Trip Walkaround Inspection"
              : "Post-Trip Walkaround Inspection"}
          </DialogTitle>
          <DialogDescription>
            {phase === "pre"
              ? "Complete the digital safety checklist before starting navigation."
              : "Verify vehicle condition and attach any damage photos before closing the trip."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            {checks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Label htmlFor={item.id} className="font-normal">
                  {item.label}
                </Label>
                <Switch
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={item.onChange}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chk-notes">Inspector notes (optional)</Label>
            <Input
              id="chk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any defects, fluid top-up, or scuff notes..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Walkaround / damage photos (optional)</Label>
            <MultiPhotoUpload
              values={damagePhotos}
              onChange={setDamagePhotos}
              maxPhotos={3}
              label="Add photo"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl">
              {phase === "pre" ? "Confirm & Start Trip" : "Confirm & End Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 2. Waypoint Proof of Delivery (POD) Capture Dialog
// ---------------------------------------------------------------------------

interface WaypointPodDialogProps {
  waypoint: TripWaypoint | null;
  onOpenChange: (open: boolean) => void;
  onSavePod: (
    waypointId: string,
    pod: {
      recipientName: string;
      podSignatureDataUrl?: string;
      podPhotoDataUrl?: string;
    }
  ) => void;
}

export function WaypointPodDialog({
  waypoint,
  onOpenChange,
  onSavePod,
}: WaypointPodDialogProps) {
  const [recipientName, setRecipientName] = useState("");
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!waypoint || !recipientName.trim()) {
      toast.error("Enter recipient name.");
      return;
    }
    onSavePod(waypoint.id, {
      recipientName: recipientName.trim(),
      podSignatureDataUrl: signature,
      podPhotoDataUrl: photo,
    });
    setRecipientName("");
    setSignature(undefined);
    setPhoto(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={waypoint !== null}
      onOpenChange={(o) => {
        if (!o) {
          setRecipientName("");
          setSignature(undefined);
          setPhoto(undefined);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proof of Delivery (POD)</DialogTitle>
          <DialogDescription>
            {waypoint?.label} · {waypoint?.address}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pod-recipient">Recipient full name</Label>
            <Input
              id="pod-recipient"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Receiving officer / client name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Digital signature</Label>
            <SignaturePad value={signature} onChange={setSignature} />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery photo (optional)</Label>
            <SinglePhotoUpload
              value={photo}
              onChange={setPhoto}
              label="Capture delivery photo"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl">
              Save POD &amp; Mark Arrived
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. Trip Booking & Manager Approval Workflow Panel
// ---------------------------------------------------------------------------

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
    const map: Record<string, string> = { [NO_OPTION]: "Auto-assign available driver" };
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
                              b.status === "approved" || b.status === "dispatched"
                                ? "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                                : b.status === "pending"
                                  ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                                  : ""
                            }
                          >
                            {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
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

// ---------------------------------------------------------------------------
// 4. Geofencing & Zone Alerts Manager Panel
// ---------------------------------------------------------------------------

export function GeofencesPanel() {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";
  const canEditGeofences = can(currentRole, "geofences:write");

  const geofences = useFleetStore((s) => s.geofences);
  const geofenceAlerts = useFleetStore((s) => s.geofenceAlerts);
  const vehicles = useFleetStore((s) => s.vehicles);
  const addGeofence = useFleetStore((s) => s.addGeofence);
  const toggleGeofence = useFleetStore((s) => s.toggleGeofence);
  const removeGeofence = useFleetStore((s) => s.removeGeofence);
  const clearGeofenceAlerts = useFleetStore((s) => s.clearGeofenceAlerts);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<GeofenceZoneType>("warehouse");
  const [centerLat, setCenterLat] = useState("23.7810");
  const [centerLng, setCenterLng] = useState("90.4150");
  const [radiusDeg, setRadiusDeg] = useState("0.004");
  const [afterHoursOnly, setAfterHoursOnly] = useState(false);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const lat = Number(centerLat);
    const lng = Number(centerLng);
    const d = Math.max(0.001, Number(radiusDeg) || 0.004);
    if (!name.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Enter zone name and valid center coordinates.");
      return;
    }
    addGeofence({
      name: name.trim(),
      type,
      polygon: [
        { lat: lat + d, lng: lng - d },
        { lat: lat + d, lng: lng + d },
        { lat: lat - d, lng: lng + d },
        { lat: lat - d, lng: lng - d },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: type !== "restricted",
      afterHoursOnly,
      allowedStartHour: 6,
      allowedEndHour: 22,
    });
    toast.success(`Geofence "${name.trim()}" created and active on live map.`);
    setName("");
    setOpen(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="rounded-2xl lg:col-span-7">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radar className="h-4 w-4 text-primary" />
              Geofence Zones ({geofences.length})
            </CardTitle>
            <CardDescription>
              Custom polygons monitored in real time on the live GPS map.
            </CardDescription>
          </div>
          {canEditGeofences ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(true)}
              className="rounded-xl"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New zone
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2.5">
          {geofences.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="truncate text-sm font-medium text-foreground">
                    {zone.name}
                  </p>
                  <Badge
                    variant={
                      zone.type === "restricted" ? "destructive" : "secondary"
                    }
                    className="rounded-md text-[10px]"
                  >
                    {GEOFENCE_TYPE_ITEMS[zone.type]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {zone.alertOnEntry ? "Entry alert" : ""}
                  {zone.alertOnEntry && zone.alertOnExit ? " · " : ""}
                  {zone.alertOnExit ? "Exit alert" : ""}
                  {zone.afterHoursOnly ? " · After-hours only (22:00–06:00)" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={zone.active}
                  disabled={!canEditGeofences}
                  onCheckedChange={() => toggleGeofence(zone.id)}
                />
                {canEditGeofences ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => removeGeofence(zone.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl lg:col-span-5">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-4 w-4 text-[var(--brand-amber)]" />
              Zone Alert Feed ({geofenceAlerts.length})
            </CardTitle>
            <CardDescription>
              Live entry, exit, and after-hours notifications.
            </CardDescription>
          </div>
          {geofenceAlerts.length > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={clearGeofenceAlerts}
            >
              Clear
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {geofenceAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              Start a simulated Dhaka route above to watch vehicles cross
              Gulshan Hub, Banani Client Zone, and Hatirjheel Restricted Zone in
              real time.
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {geofenceAlerts.slice(0, 20).map((alert) => {
                const veh = vehiclesById.get(alert.vehicleId);
                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/25 px-3 py-2 text-xs"
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-amber)]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {veh?.name ?? "Vehicle"}{" "}
                        <span className="uppercase text-primary">
                          {alert.eventType.replaceAll("_", " ")}
                        </span>{" "}
                        {alert.zoneName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(alert.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Geofence Polygon</DialogTitle>
            <DialogDescription>
              Define a monitored warehouse, client site, or restricted zone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>Zone name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tejgaon Cold-Storage Depot"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Zone type</Label>
              <Select
                value={type}
                items={GEOFENCE_TYPE_ITEMS}
                onValueChange={(v) => {
                  if (v) setType(v as GeofenceZoneType);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(GEOFENCE_TYPE_ITEMS) as [
                      GeofenceZoneType,
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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Center Lat</Label>
                <Input
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Center Lng</Label>
                <Input
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Span (deg)</Label>
                <Input
                  value={radiusDeg}
                  onChange={(e) => setRadiusDeg(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/25 px-3 py-2.5">
              <Label htmlFor="geo-after-hours" className="text-xs">
                Trigger only on after-hours movement (22:00–06:00)
              </Label>
              <Switch
                id="geo-after-hours"
                checked={afterHoursOnly}
                onCheckedChange={setAfterHoursOnly}
              />
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
                Save zone
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
