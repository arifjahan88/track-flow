"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Route, Search } from "lucide-react";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
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
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
} from "@/lib/format";
import type { Driver, Trip, Vehicle } from "@/types";

const ALL_VEHICLES = "__all__";
const ALL_DRIVERS = "__all_drivers__";

interface TripHistoryTableProps {
  completedTrips: readonly Trip[];
  vehicles: readonly Vehicle[];
  drivers: readonly Driver[];
  onSelectTrip: (trip: Trip) => void;
}

export function TripHistoryTable({
  completedTrips,
  vehicles,
  drivers,
  onSelectTrip,
}: TripHistoryTableProps) {
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState(ALL_VEHICLES);
  const [driverFilter, setDriverFilter] = useState(ALL_DRIVERS);
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
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const driverFilterItems = useMemo(() => {
    const items: Record<string, string> = { [ALL_DRIVERS]: "All drivers" };
    for (const d of drivers) items[d.id] = d.name;
    return items;
  }, [drivers]);

  const filteredTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return completedTrips.filter((trip) => {
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
    completedTrips,
    vehicleFilter,
    driverFilter,
    fromDate,
    toDate,
    search,
    vehiclesById,
    driversById,
  ]);

  const pagination = usePagination(filteredTrips, 10);

  const hasFilters =
    search.trim() !== "" ||
    vehicleFilter !== ALL_VEHICLES ||
    driverFilter !== ALL_DRIVERS ||
    fromDate !== "" ||
    toDate !== "";

  const clearFilters = () => {
    setSearch("");
    setVehicleFilter(ALL_VEHICLES);
    setDriverFilter(ALL_DRIVERS);
    setFromDate("");
    setToDate("");
    pagination.setPage(1);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-lg">
            Recorded Navigation Logs ({filteredTrips.length})
          </CardTitle>
          <CardDescription>
            Select any completed trip to open interactive GPS route playback,
            stop durations, and POD records.
          </CardDescription>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-3">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search trip history"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                pagination.setPage(1);
              }}
              placeholder="Search purpose, plate, driver..."
              className="pl-10"
            />
          </div>

          <div className="lg:col-span-3">
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
              <SelectTrigger aria-label="Filter trips by vehicle" className="w-full">
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

          <div className="lg:col-span-2">
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
              <SelectTrigger aria-label="Filter trips by driver" className="w-full">
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

          <div className="lg:col-span-3">
            <DateRangePicker
              aria-label="Filter trips by date range"
              fromDate={fromDate}
              toDate={toDate}
              align="end"
              onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
                setFromDate(nextFrom);
                setToDate(nextTo);
                pagination.setPage(1);
              }}
              placeholder="Filter by date range"
            />
          </div>

          <div className="flex items-center lg:col-span-1">
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                aria-label="Reset trip history filters"
                className="h-10 w-full rounded-xl px-2.5"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
            <Route className="h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {hasFilters
                ? "No trips match your filters"
                : "No completed trips recorded yet"}
            </p>
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="mt-4 rounded-xl"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
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
                      <TableRow
                        key={trip.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => onSelectTrip(trip)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectTrip(trip);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(trip.startedAt)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {vehicle?.name ?? "Unknown"}
                          {vehicle ? (
                            <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                              {vehicle.plate}
                            </span>
                          ) : null}
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
  );
}
