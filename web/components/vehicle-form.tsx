"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FuelType,
  VehicleLifecycleStatus,
  VehicleType,
} from "@/types";

export const VEHICLE_TYPES: readonly VehicleType[] = [
  "Van",
  "Sedan",
  "Pickup",
  "Truck",
  "SUV",
  "Motorcycle",
];

export const FUEL_TYPES: readonly FuelType[] = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Electric",
  "CNG",
];

export const LIFECYCLE_STATUS_LABELS: Record<VehicleLifecycleStatus, string> = {
  available: "Available",
  on_trip: "On Trip",
  under_maintenance: "Under Maintenance",
  out_of_service: "Out of Service",
  decommissioned: "Decommissioned",
};

const VEHICLE_TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  VEHICLE_TYPES.map((t) => [t, t])
);

const FUEL_TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  FUEL_TYPES.map((t) => [t, t])
);

export interface VehicleFormValues {
  name: string;
  plate: string;
  type: VehicleType;
  odometerKm: number;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: FuelType;
  engineCapacityCc?: number;
  tankCapacityLiters?: number;
  engineHours?: number;
  status?: VehicleLifecycleStatus;
  purchaseCost?: number;
  monthlyDepreciation?: number;
}

interface VehicleFormProps {
  initialValues?: VehicleFormValues;
  submitLabel: string;
  onSubmit: (values: VehicleFormValues) => void;
  onCancel?: () => void;
}

export function VehicleForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [plate, setPlate] = useState(initialValues?.plate ?? "");
  const [type, setType] = useState<VehicleType>(initialValues?.type ?? "Van");
  const [odometerInput, setOdometerInput] = useState(
    initialValues !== undefined ? String(initialValues.odometerKm) : "0"
  );
  const [vin, setVin] = useState(initialValues?.vin ?? "");
  const [make, setMake] = useState(initialValues?.make ?? "");
  const [model, setModel] = useState(initialValues?.model ?? "");
  const [year, setYear] = useState(
    initialValues?.year ? String(initialValues.year) : "2024"
  );
  const [fuelType, setFuelType] = useState<FuelType>(
    initialValues?.fuelType ?? "Diesel"
  );
  const [engineCapacityCc, setEngineCapacityCc] = useState(
    initialValues?.engineCapacityCc ? String(initialValues.engineCapacityCc) : ""
  );
  const [tankCapacityLiters, setTankCapacityLiters] = useState(
    initialValues?.tankCapacityLiters
      ? String(initialValues.tankCapacityLiters)
      : "60"
  );
  const [engineHours, setEngineHours] = useState(
    initialValues?.engineHours !== undefined
      ? String(initialValues.engineHours)
      : "0"
  );
  const [status, setStatus] = useState<VehicleLifecycleStatus>(
    initialValues?.status ?? "available"
  );
  const [purchaseCost, setPurchaseCost] = useState(
    initialValues?.purchaseCost ? String(initialValues.purchaseCost) : ""
  );
  const [monthlyDepreciation, setMonthlyDepreciation] = useState(
    initialValues?.monthlyDepreciation
      ? String(initialValues.monthlyDepreciation)
      : "250"
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPlate = plate.trim();
    const odometerKm = Number(odometerInput);

    if (!trimmedName) {
      setError("Vehicle name is required.");
      return;
    }
    if (!trimmedPlate) {
      setError("License plate is required.");
      return;
    }
    if (Number.isNaN(odometerKm) || odometerKm < 0) {
      setError("Odometer must be 0 or greater.");
      return;
    }

    const parseOptionalNum = (val: string) => {
      if (!val.trim()) return undefined;
      const n = Number(val);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };

    setError(null);
    onSubmit({
      name: trimmedName,
      plate: trimmedPlate.toUpperCase(),
      type,
      odometerKm,
      vin: vin.trim().toUpperCase() || undefined,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: parseOptionalNum(year),
      fuelType,
      engineCapacityCc: parseOptionalNum(engineCapacityCc),
      tankCapacityLiters: parseOptionalNum(tankCapacityLiters),
      engineHours: parseOptionalNum(engineHours) ?? 0,
      status,
      purchaseCost: parseOptionalNum(purchaseCost),
      monthlyDepreciation: parseOptionalNum(monthlyDepreciation),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-name">Vehicle name</Label>
          <Input
            id="vehicle-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Delivery Van"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-plate">Plate number</Label>
          <Input
            id="vehicle-plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="DHA-11-2045"
            required
            className="uppercase"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-type">Vehicle type</Label>
          <Select
            value={type}
            items={VEHICLE_TYPE_ITEMS}
            onValueChange={(value) => {
              if (value) setType(value as VehicleType);
            }}
          >
            <SelectTrigger id="vehicle-type" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((vt) => (
                <SelectItem key={vt} value={vt}>
                  {vt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-fuel">Fuel type</Label>
          <Select
            value={fuelType}
            items={FUEL_TYPE_ITEMS}
            onValueChange={(value) => {
              if (value) setFuelType(value as FuelType);
            }}
          >
            <SelectTrigger id="vehicle-fuel" className="w-full">
              <SelectValue placeholder="Fuel" />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {ft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vehicle-status">Lifecycle status</Label>
          <Select
            value={status}
            items={LIFECYCLE_STATUS_LABELS}
            onValueChange={(value) => {
              if (value) setStatus(value as VehicleLifecycleStatus);
            }}
          >
            <SelectTrigger id="vehicle-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(LIFECYCLE_STATUS_LABELS) as [
                  VehicleLifecycleStatus,
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-make">Make</Label>
          <Input
            id="vehicle-make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Toyota"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-model">Model</Label>
          <Input
            id="vehicle-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="HiAce Super GL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-year">Year</Label>
          <Input
            id="vehicle-year"
            type="number"
            min={1980}
            max={2035}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-vin">VIN / Chassis number</Label>
          <Input
            id="vehicle-vin"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder="JTFSX22P806041291"
            className="font-mono uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-odometer">Odometer (km)</Label>
          <Input
            id="vehicle-odometer"
            type="number"
            min={0}
            step="0.1"
            value={odometerInput}
            onChange={(e) => setOdometerInput(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-cc">Engine (cc)</Label>
          <Input
            id="vehicle-cc"
            type="number"
            min={0}
            value={engineCapacityCc}
            onChange={(e) => setEngineCapacityCc(e.target.value)}
            placeholder="2755"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-tank">Tank capacity (L)</Label>
          <Input
            id="vehicle-tank"
            type="number"
            min={1}
            value={tankCapacityLiters}
            onChange={(e) => setTankCapacityLiters(e.target.value)}
            placeholder="65"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-hours">Engine hours</Label>
          <Input
            id="vehicle-hours"
            type="number"
            min={0}
            step="0.1"
            value={engineHours}
            onChange={(e) => setEngineHours(e.target.value)}
            placeholder="1420"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-cost">Purchase cost ($)</Label>
          <Input
            id="vehicle-cost"
            type="number"
            min={0}
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
            placeholder="34000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle-depr">Monthly depreciation ($)</Label>
          <Input
            id="vehicle-depr"
            type="number"
            min={0}
            value={monthlyDepreciation}
            onChange={(e) => setMonthlyDepreciation(e.target.value)}
            placeholder="320"
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
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-xl"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
