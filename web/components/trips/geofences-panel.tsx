"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Bell, MapPin, Plus, Radar, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/rbac";
import type { GeofenceZoneType } from "@/types";

const GEOFENCE_TYPE_ITEMS: Record<GeofenceZoneType, string> = {
  warehouse: "Warehouse / Hub",
  client_site: "Client Site",
  restricted: "Restricted Zone",
};

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
                  {zone.afterHoursOnly
                    ? " · After-hours only (22:00–06:00)"
                    : ""}
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
