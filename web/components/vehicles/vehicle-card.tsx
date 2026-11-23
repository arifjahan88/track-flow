"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Car,
  FileCheck2,
  Gauge,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { LIFECYCLE_STATUS_LABELS } from "@/components/vehicle-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatKm } from "@/lib/format";
import type { Vehicle, VehicleLifecycleStatus, VehicleType } from "@/types";

const VEHICLE_IMAGES: Partial<Record<VehicleType, string>> = {
  Van: "/images/vehicle-van.jpg",
  Sedan: "/images/vehicle-sedan.jpg",
  Pickup: "/images/vehicle-pickup.jpg",
};

function statusBadgeStyle(status: VehicleLifecycleStatus): string {
  switch (status) {
    case "available":
      return "border-[#22d3ee]/30 bg-[#07131c]/80 text-[#22d3ee] backdrop-blur-sm";
    case "on_trip":
      return "border-[var(--brand-amber)]/40 bg-[#07131c]/85 text-[#f59e0b] backdrop-blur-sm";
    case "under_maintenance":
      return "border-amber-500/40 bg-amber-950/85 text-amber-300 backdrop-blur-sm";
    case "out_of_service":
      return "border-destructive/50 bg-destructive/85 text-white backdrop-blur-sm";
    case "decommissioned":
      return "border-border bg-muted/90 text-muted-foreground backdrop-blur-sm";
  }
}

interface VehicleCardProps {
  vehicle: Vehicle;
  inTrip: boolean;
  effectiveStatus: VehicleLifecycleStatus;
  hasOverdue: boolean;
  hasDueSoon: boolean;
  complianceAlertCount: number;
  canEdit: boolean;
  onStatusChange: (status: VehicleLifecycleStatus) => void;
  onOpenDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function VehicleCard({
  vehicle,
  inTrip,
  effectiveStatus,
  hasOverdue,
  hasDueSoon,
  complianceAlertCount,
  canEdit,
  onStatusChange,
  onOpenDetails,
  onEdit,
  onDelete,
}: VehicleCardProps) {
  const imgSrc = VEHICLE_IMAGES[vehicle.type];

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-border bg-card">
      <div className="relative h-36 w-full overflow-hidden border-b border-border bg-[#12202f]">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={`${vehicle.name} (${vehicle.type})`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#0c1d2b]">
            <Car className="h-12 w-12 text-[#22d3ee]/70" />
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1.5">
          <Badge className={statusBadgeStyle(effectiveStatus)}>
            {LIFECYCLE_STATUS_LABELS[effectiveStatus]}
          </Badge>
          {hasOverdue ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Service overdue
            </Badge>
          ) : hasDueSoon ? (
            <Badge className="gap-1 border-[#ffb020]/40 bg-[#ffb020]/20 text-[#ffb020]">
              <Wrench className="h-3 w-3" />
              Due soon
            </Badge>
          ) : null}
          {complianceAlertCount > 0 ? (
            <Badge className="gap-1 border-amber-400/40 bg-amber-950/85 text-amber-300">
              <FileCheck2 className="h-3 w-3" />
              {complianceAlertCount} doc alert
              {complianceAlertCount > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="min-w-0">
          <CardTitle className="truncate text-lg">{vehicle.name}</CardTitle>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {vehicle.plate} · {vehicle.type}
            {vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}
          </p>
          {vehicle.make || vehicle.model ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[vehicle.year, vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(" ")}
              {vehicle.engineCapacityCc ? ` · ${vehicle.engineCapacityCc} cc` : ""}
            </p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2.5 pb-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Gauge className="h-3 w-3 text-[var(--brand-teal)]" />
              Odometer
            </span>
            <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
              {formatKm(vehicle.odometerKm)} km
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/40 px-2.5 py-2">
            <span className="text-[11px] text-muted-foreground">
              Engine / Tank
            </span>
            <p className="mt-0.5 font-display text-sm font-semibold text-foreground">
              {vehicle.engineHours ?? 0}h · {vehicle.tankCapacityLiters ?? 60}L
            </p>
          </div>
        </div>

        {vehicle.vin ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            VIN: {vehicle.vin}
          </p>
        ) : null}

        {canEdit && !inTrip ? (
          <Select
            value={effectiveStatus}
            items={LIFECYCLE_STATUS_LABELS}
            onValueChange={(next) => {
              if (next) onStatusChange(next as VehicleLifecycleStatus);
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(LIFECYCLE_STATUS_LABELS) as [
                  VehicleLifecycleStatus,
                  string,
                ][]
              )
                .filter(([k]) => k !== "on_trip")
                .map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : null}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenDetails}
          className="rounded-xl"
        >
          Vault &amp; logs
        </Button>

        {canEdit ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Edit ${vehicle.name}`}
              onClick={onEdit}
              className="rounded-lg"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {inTrip ? (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="inline-flex" tabIndex={0} />}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled
                    aria-label={`Cannot delete ${vehicle.name} while in a trip`}
                    className="rounded-lg text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  End the active trip before deleting this vehicle.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Delete ${vehicle.name}`}
                onClick={onDelete}
                className="rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
