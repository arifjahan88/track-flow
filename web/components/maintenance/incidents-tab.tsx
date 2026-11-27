"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertOctagon, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MultiPhotoUpload } from "@/components/photo-upload";
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
import { formatCurrency, formatShortDate, toIsoDate } from "@/lib/format";
import { getScopedIncidents, getScopedVehicles } from "@/lib/rbac-scope";
import type { IncidentSeverity, IncidentStatus } from "@/types";

const NO_DRIVER = "__no_driver__";

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

export function IncidentsTab({ canWrite }: { canWrite: boolean }) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const allVehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const bookings = useFleetStore((s) => s.bookings);
  const trips = useFleetStore((s) => s.trips);
  const allIncidents = useFleetStore((s) => s.incidents);
  const addIncident = useFleetStore((s) => s.addIncident);
  const updateIncidentStatus = useFleetStore((s) => s.updateIncidentStatus);
  const removeIncident = useFleetStore((s) => s.removeIncident);

  const vehicles = useMemo(
    () =>
      getScopedVehicles(currentUser, drivers, allVehicles, bookings, trips),
    [currentUser, drivers, allVehicles, bookings, trips]
  );
  const incidents = useMemo(
    () =>
      getScopedIncidents(
        currentUser,
        drivers,
        allVehicles,
        bookings,
        trips,
        allIncidents
      ),
    [currentUser, drivers, allVehicles, bookings, trips, allIncidents]
  );

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

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const driverSelectItems = useMemo(() => {
    const items: Record<string, string> = { [NO_DRIVER]: "Unassigned" };
    for (const d of drivers) items[d.id] = d.name;
    return items;
  }, [drivers]);

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
    <>
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                Incident &amp; Accident Reports
              </CardTitle>
              <CardDescription>
                Log road accidents with severity, location, third-party
                insurance details, and damage photos.
              </CardDescription>
            </div>
            {canWrite ? (
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
                            {canWrite ? (
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
                            {canWrite ? (
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
    </>
  );
}
