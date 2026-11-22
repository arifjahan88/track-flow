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
import type { VehicleType } from "@/types";

export const VEHICLE_TYPES: readonly VehicleType[] = [
  "Van",
  "Sedan",
  "Pickup",
  "Truck",
  "SUV",
  "Motorcycle",
];

export interface VehicleFormValues {
  name: string;
  plate: string;
  type: VehicleType;
  odometerKm: number;
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

    setError(null);
    onSubmit({
      name: trimmedName,
      plate: trimmedPlate.toUpperCase(),
      type,
      odometerKm,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vehicle-name">Vehicle name</Label>
        <Input
          id="vehicle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Delivery Van"
          required
          className="h-10 rounded-xl"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vehicle-plate">Plate number</Label>
          <Input
            id="vehicle-plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="DHA-11-2045"
            required
            className="h-10 rounded-xl uppercase"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicle-type">Vehicle type</Label>
          <Select
            value={type}
            onValueChange={(value) => {
              if (value) setType(value as VehicleType);
            }}
          >
            <SelectTrigger id="vehicle-type" className="h-10 w-full rounded-xl">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-odometer">Odometer (km)</Label>
        <Input
          id="vehicle-odometer"
          type="number"
          min={0}
          step="0.1"
          value={odometerInput}
          onChange={(e) => setOdometerInput(e.target.value)}
          required
          className="h-10 rounded-xl"
        />
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
