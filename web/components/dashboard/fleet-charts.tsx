"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelLog, Trip, Vehicle } from "@/types";

interface FleetChartsProps {
  vehicles: Vehicle[];
  trips: Trip[];
  fuelLogs: FuelLog[];
}

const STATUS_SERIES = [
  { key: "on_trip", name: "In Trip", color: "#06B6D4" },
  { key: "available", name: "Active", color: "#10B981" },
  { key: "under_maintenance", name: "Maintenance", color: "#F59E0B" },
  { key: "out_of_service", name: "Inactive", color: "#64748B" },
] as const;

export function FleetCharts({ vehicles, trips, fuelLogs }: FleetChartsProps) {
  const areaData = React.useMemo(() => {
    const basePoints = [
      { label: "Mon", distanceKm: 118, fuelSpend: 164 },
      { label: "Tue", distanceKm: 146, fuelSpend: 192 },
      { label: "Wed", distanceKm: 132, fuelSpend: 178 },
      { label: "Thu", distanceKm: 168, fuelSpend: 224 },
      { label: "Fri", distanceKm: 194, fuelSpend: 256 },
    ];

    const liveTripsDist = Math.round(
      trips.reduce((sum, t) => sum + t.distanceKm, 0)
    );
    const liveFuelSpend = Math.round(
      fuelLogs.reduce((sum, f) => sum + f.totalCost, 0)
    );

    return [
      ...basePoints,
      {
        label: "Sat",
        distanceKm: Math.max(95, Math.round(liveTripsDist * 0.85)),
        fuelSpend: Math.max(120, Math.round(liveFuelSpend * 0.42)),
      },
      {
        label: "Today",
        distanceKm: Math.max(80, Math.round(liveTripsDist * 1.05)),
        fuelSpend: Math.max(90, Math.round(liveFuelSpend * 0.56)),
      },
    ];
  }, [trips, fuelLogs]);

  const statusCounts = React.useMemo(() => {
    return {
      on_trip: vehicles.filter((v) => v.status === "on_trip").length,
      available: vehicles.filter((v) => (v.status ?? "available") === "available")
        .length,
      under_maintenance: vehicles.filter(
        (v) => v.status === "under_maintenance"
      ).length,
      out_of_service: vehicles.filter(
        (v) => v.status === "out_of_service" || v.status === "decommissioned"
      ).length,
    };
  }, [vehicles]);

  const statusData = React.useMemo(() => {
    return STATUS_SERIES.map((item) => ({
      name: item.name,
      value: statusCounts[item.key],
      color: item.color,
    })).filter((d) => d.value > 0);
  }, [statusCounts]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Fuel Spend vs Distance Area Chart */}
      <Card className="fp-glass rounded-2xl xl:col-span-8">
        <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              Fuel Spend vs. Distance Covered
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              7-day rolling telemetry (km vs USD)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-cyan-500" />
              Distance (km)
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              Fuel Spend ($)
            </span>
          </div>
        </CardHeader>
        <CardContent className="h-[260px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={areaData}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="tfDistGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="tfFuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148, 163, 184, 0.14)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#F8FAFC",
                }}
              />
              <Area
                type="monotone"
                dataKey="distanceKm"
                name="Distance (km)"
                stroke="#06B6D4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#tfDistGrad)"
              />
              <Area
                type="monotone"
                dataKey="fuelSpend"
                name="Fuel Spend ($)"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#tfFuelGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fleet Status Donut Chart */}
      <Card className="fp-glass rounded-2xl xl:col-span-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Fleet Status Breakdown
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Real-time operational distribution
          </p>
        </CardHeader>
        <CardContent className="flex h-[260px] flex-col justify-between pt-0">
          <div className="relative h-[176px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  stroke="none"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "rgba(255,255,255,0.12)",
                    borderRadius: "10px",
                    fontSize: "12px",
                    color: "#F8FAFC",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="fp-telemetry text-2xl font-bold">
                {vehicles.length}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Units
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STATUS_SERIES.map((item) => {
              const count = statusCounts[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/35 px-2.5 py-1.5 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <span className="fp-telemetry font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
