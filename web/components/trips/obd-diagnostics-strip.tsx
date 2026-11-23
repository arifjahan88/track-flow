"use client";

import { BatteryCharging, Cpu, Fuel, Power, Thermometer } from "lucide-react";

interface ObdDiagnosticsStripProps {
  ignitionOn: boolean;
  distanceKm: number;
}

export function ObdDiagnosticsStrip({
  ignitionOn,
  distanceKm,
}: ObdDiagnosticsStripProps) {
  const batteryVolts = ignitionOn ? "14.1V" : "12.6V";
  const fuelPct = Math.max(18, Math.round(86 - distanceKm * 1.4));
  const coolantC = ignitionOn ? 88 : 42;

  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border bg-card px-4 py-3 text-xs sm:grid-cols-5">
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
        <Power
          className={`h-3.5 w-3.5 ${ignitionOn ? "text-[var(--brand-teal)]" : "text-muted-foreground"}`}
        />
        <div>
          <p className="text-[10px] text-muted-foreground">Ignition</p>
          <p className="font-mono font-semibold text-foreground">
            {ignitionOn ? "ON" : "OFF"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
        <BatteryCharging className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
        <div>
          <p className="text-[10px] text-muted-foreground">Battery</p>
          <p className="font-mono font-semibold text-foreground">
            {batteryVolts}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
        <Fuel className="h-3.5 w-3.5 text-[var(--brand-blue)]" />
        <div>
          <p className="text-[10px] text-muted-foreground">Fuel Level</p>
          <p className="font-mono font-semibold text-foreground">{fuelPct}%</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
        <Thermometer className="h-3.5 w-3.5 text-[var(--brand-amber)]" />
        <div>
          <p className="text-[10px] text-muted-foreground">Coolant</p>
          <p className="font-mono font-semibold text-foreground">
            {coolantC}°C
          </p>
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2 sm:col-span-1">
        <Cpu className="h-3.5 w-3.5 text-[var(--brand-teal)]" />
        <div>
          <p className="text-[10px] text-muted-foreground">OBD-II</p>
          <p className="font-mono font-semibold text-[var(--brand-teal)]">
            0 DTC · OK
          </p>
        </div>
      </div>
    </div>
  );
}
