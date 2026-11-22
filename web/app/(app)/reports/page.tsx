"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3, Download } from "lucide-react";
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { downloadTextFile, tripsToCsv } from "@/lib/csv";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
} from "@/lib/format";

const ALL_VEHICLES = "__all__";

const chartConfig: ChartConfig = {
  distanceKm: {
    label: "Distance (km)",
    color: "var(--brand-teal)",
  },
};

function offsetDateIso(daysOffset: number): string {
  return new Date(Date.now() + daysOffset * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export default function ReportsPage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);

  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const driversById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (trip.status !== "done") return false;
      if (vehicleFilter !== ALL_VEHICLES && trip.vehicleId !== vehicleFilter) {
        return false;
      }
      const tripDay = trip.startedAt.slice(0, 10);
      if (fromDate && tripDay < fromDate) return false;
      if (toDate && tripDay > toDate) return false;
      return true;
    });
  }, [trips, vehicleFilter, fromDate, toDate]);

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const trip of filteredTrips) {
      const day = trip.startedAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + trip.distanceKm);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, distanceKm]) => ({
        day,
        distanceKm: Number(distanceKm.toFixed(2)),
      }));
  }, [filteredTrips]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const totalDistanceKm = filteredTrips.reduce(
    (sum, t) => sum + t.distanceKm,
    0
  );
  const totalDurationHours = filteredTrips.reduce((sum, t) => {
    if (!t.endedAt) return sum;
    const ms = Math.max(
      0,
      new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()
    );
    return sum + ms / 3_600_000;
  }, 0);
  const averageSpeedKmh =
    totalDurationHours > 0 ? totalDistanceKm / totalDurationHours : 0;
  const topSpeedKmh = filteredTrips.reduce(
    (max, t) => Math.max(max, t.maxSpeedKmh),
    0
  );

  const applyPreset = (days: number | null) => {
    if (days === null) {
      setFromDate("");
      setToDate("");
      return;
    }
    setFromDate(offsetDateIso(-days));
    setToDate(offsetDateIso(0));
  };

  const handleExportCsv = () => {
    if (filteredTrips.length === 0) {
      toast.error("No trips to export for the selected filters.");
      return;
    }
    const csv = tripsToCsv(filteredTrips, vehiclesById, driversById);
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(`trackflow-trips-${today}.csv`, csv, "text/csv;charset=utf-8");
    toast.success(`Exported ${filteredTrips.length} trips to CSV.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter completed trips by date range and vehicle, inspect daily
            distance, and export CSV.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleExportCsv}
          className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="report-vehicle">Vehicle</Label>
            <Select
              value={vehicleFilter}
              onValueChange={(value) => {
                if (value) setVehicleFilter(value);
              }}
            >
              <SelectTrigger
                id="report-vehicle"
                className="h-10 w-full rounded-xl"
              >
                <SelectValue placeholder="All vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} ({v.plate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-from">From date</Label>
            <Input
              id="report-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-to">To date</Label>
            <Input
              id="report-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="flex flex-col justify-end gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Quick range
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(7)}
                className="rounded-lg"
              >
                7d
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(30)}
                className="rounded-lg"
              >
                30d
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(null)}
                className="rounded-lg"
              >
                All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Total distance</CardDescription>
            <CardTitle className="font-display text-2xl">
              {formatKm(totalDistanceKm)} km
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Trips</CardDescription>
            <CardTitle className="font-display text-2xl">
              {filteredTrips.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Average speed</CardDescription>
            <CardTitle className="font-display text-2xl">
              {formatSpeed(averageSpeedKmh)} km/h
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardDescription>Top speed</CardDescription>
            <CardTitle className="font-display text-2xl">
              {formatSpeed(topSpeedKmh)} km/h
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Distance-per-day chart */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Distance per day</CardTitle>
          <CardDescription>
            Daily completed trip distance in kilometers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
              <BarChart3 className="h-8 w-8 text-[var(--brand-teal)]" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No trip data for this range
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Complete a trip or widen the date range filter to populate the
                daily distance chart.
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v} km`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="distanceKm"
                  fill="var(--color-distanceKm)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Filtered trips table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Filtered trips ({filteredTrips.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTrips.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No completed trips match the selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Top speed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrips.map((trip) => {
                    const vehicle = vehiclesById.get(trip.vehicleId);
                    const driver = trip.driverId
                      ? driversById.get(trip.driverId)
                      : undefined;
                    const durationMs = trip.endedAt
                      ? Math.max(
                          0,
                          new Date(trip.endedAt).getTime() -
                            new Date(trip.startedAt).getTime()
                        )
                      : 0;
                    return (
                      <TableRow key={trip.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(trip.startedAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {vehicle?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {driver?.name ?? "Unassigned"}
                        </TableCell>
                        <TableCell>{trip.purpose}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatKm(trip.distanceKm)} km
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDuration(durationMs)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="rounded-lg">
                            {formatSpeed(trip.maxSpeedKmh)} km/h
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
