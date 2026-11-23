"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Activity,
  BarChart3,
  DollarSign,
  Download,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import { TcoAnalyticsTab } from "@/components/reports/tco-analytics-tab";
import { UtilizationTab } from "@/components/reports/utilization-tab";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { computeUtilization, computeVehicleTco } from "@/lib/analytics";
import { downloadTextFile, tripsToCsv } from "@/lib/csv";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
  toIsoDate,
} from "@/lib/format";

const ALL_VEHICLES = "__all__";
const ALL_DRIVERS = "__all_drivers__";

const distanceChartConfig: ChartConfig = {
  distanceKm: { label: "Distance (km)", color: "var(--brand-teal)" },
};

export default function ReportsPage() {
  const hydrated = useHydrated();
  const vehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const trips = useFleetStore((s) => s.trips);
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const expenses = useFleetStore((s) => s.expenses);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);

  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [driverFilter, setDriverFilter] = useState(ALL_DRIVERS);
  const [search, setSearch] = useState("");
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

  const vehicleFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_VEHICLES]: "All vehicles" };
    for (const v of vehicles) {
      items[v.id] = `${v.name} (${v.plate})`;
    }
    return items;
  }, [vehicles]);

  const driverFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_DRIVERS]: "All drivers" };
    for (const d of drivers) {
      items[d.id] = d.name;
    }
    return items;
  }, [drivers]);

  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((trip) => {
      if (trip.status !== "done") return false;
      if (vehicleFilter !== ALL_VEHICLES && trip.vehicleId !== vehicleFilter) {
        return false;
      }
      if (driverFilter !== ALL_DRIVERS && trip.driverId !== driverFilter) {
        return false;
      }
      const tripDay = trip.startedAt.slice(0, 10);
      if (fromDate && tripDay < fromDate) return false;
      if (toDate && tripDay > toDate) return false;
      if (q) {
        const vehicle = vehiclesById.get(trip.vehicleId);
        const driver = trip.driverId
          ? driversById.get(trip.driverId)
          : undefined;
        const hay = `${trip.purpose} ${vehicle?.name ?? ""} ${vehicle?.plate ?? ""} ${driver?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    trips,
    vehicleFilter,
    driverFilter,
    fromDate,
    toDate,
    search,
    vehiclesById,
    driversById,
  ]);

  const pagination = usePagination(filteredTrips, 10);

  const tcoRows = useMemo(
    () =>
      computeVehicleTco(
        vehicles,
        trips,
        fuelLogs,
        maintenanceRecords,
        workOrders,
        expenses,
        complianceDocs
      ),
    [
      vehicles,
      trips,
      fuelLogs,
      maintenanceRecords,
      workOrders,
      expenses,
      complianceDocs,
    ]
  );

  const utilization = useMemo(
    () => computeUtilization(vehicles, trips, 30),
    [vehicles, trips]
  );

  const hasActiveFilters =
    vehicleFilter !== ALL_VEHICLES ||
    driverFilter !== ALL_DRIVERS ||
    search.trim() !== "" ||
    fromDate !== "" ||
    toDate !== "";

  const clearFilters = () => {
    setVehicleFilter(ALL_VEHICLES);
    setDriverFilter(ALL_DRIVERS);
    setSearch("");
    setFromDate("");
    setToDate("");
    pagination.setPage(1);
  };

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

  const handleExportCsv = () => {
    if (filteredTrips.length === 0) {
      toast.error("No trips to export for the selected filters.");
      return;
    }
    const csv = tripsToCsv(filteredTrips, vehiclesById, driversById);
    const today = toIsoDate();
    downloadTextFile(
      `trackflow-trips-${today}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success(`Exported ${filteredTrips.length} trips to CSV.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Analytics &amp; Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trip analytics, Cost-per-Kilometer (CPK) &amp; Total Cost of
            Ownership (TCO), and fleet utilization reports.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleExportCsv}
          className="h-10 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Trips CSV
        </Button>
      </div>

      <Tabs defaultValue="trips" className="space-y-5">
        <TabsList className="grid w-full grid-cols-3 rounded-xl sm:max-w-lg">
          <TabsTrigger value="trips" className="rounded-lg">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Trip Reports
          </TabsTrigger>
          <TabsTrigger value="tco" className="rounded-lg">
            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
            CPK &amp; TCO
          </TabsTrigger>
          <TabsTrigger value="utilization" className="rounded-lg">
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Utilization
          </TabsTrigger>
        </TabsList>

        {/* TRIP REPORTS TAB */}
        <TabsContent value="trips" className="space-y-5">
          <Card className="rounded-2xl">
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="report-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="report-search"
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      pagination.setPage(1);
                    }}
                    placeholder="Purpose, plate, driver..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="report-vehicle">Vehicle</Label>
                <Select
                  value={vehicleFilter}
                  items={vehicleFilterItems}
                  onValueChange={(value) => {
                    if (value) {
                      setVehicleFilter(value);
                      pagination.setPage(1);
                    }
                  }}
                >
                  <SelectTrigger id="report-vehicle" className="w-full">
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

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="report-driver">Driver</Label>
                <Select
                  value={driverFilter}
                  items={driverFilterItems}
                  onValueChange={(value) => {
                    if (value) {
                      setDriverFilter(value);
                      pagination.setPage(1);
                    }
                  }}
                >
                  <SelectTrigger id="report-driver" className="w-full">
                    <SelectValue placeholder="All drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DRIVERS}>All drivers</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="report-date-range">Date range</Label>
                <DateRangePicker
                  id="report-date-range"
                  fromDate={fromDate}
                  toDate={toDate}
                  presets
                  align="end"
                  onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
                    setFromDate(nextFrom);
                    setToDate(nextTo);
                    pagination.setPage(1);
                  }}
                  placeholder="All dates"
                />
              </div>

              <div className="flex items-end lg:col-span-1">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    aria-label="Reset report filters"
                    className="h-10 w-full rounded-xl px-2.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StaggerItem>
              <Card className="h-full rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription>Total distance</CardDescription>
                  <CardTitle className="font-display text-2xl">
                    {formatKm(totalDistanceKm)} km
                  </CardTitle>
                </CardHeader>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card className="h-full rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription>Trips</CardDescription>
                  <CardTitle className="font-display text-2xl">
                    {filteredTrips.length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card className="h-full rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription>Average speed</CardDescription>
                  <CardTitle className="font-display text-2xl">
                    {formatSpeed(averageSpeedKmh)} km/h
                  </CardTitle>
                </CardHeader>
              </Card>
            </StaggerItem>
            <StaggerItem>
              <Card className="h-full rounded-2xl">
                <CardHeader className="pb-2">
                  <CardDescription>Top speed</CardDescription>
                  <CardTitle className="font-display text-2xl">
                    {formatSpeed(topSpeedKmh)} km/h
                  </CardTitle>
                </CardHeader>
              </Card>
            </StaggerItem>
          </StaggerGrid>

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
                </div>
              ) : (
                <ChartContainer
                  config={distanceChartConfig}
                  className="h-72 w-full"
                >
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
                <>
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
                        {pagination.pageItems.map((trip) => {
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
                  <TablePagination
                    page={pagination.page}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
                    totalPages={pagination.totalPages}
                    startIndex={pagination.startIndex}
                    endIndex={pagination.endIndex}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                    itemLabel="trips"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tco">
          <TcoAnalyticsTab tcoRows={tcoRows} />
        </TabsContent>

        <TabsContent value="utilization">
          <UtilizationTab
            byVehicle={utilization.byVehicle}
            peakHours={utilization.peakHours}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
