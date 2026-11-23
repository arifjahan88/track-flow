"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PeakDemandBucket,
  VehicleUtilizationRow,
} from "@/lib/analytics";
import { formatKm } from "@/lib/format";

const peakChartConfig: ChartConfig = {
  trips: { label: "Trips started", color: "var(--brand-blue)" },
};

export function UtilizationTab({
  byVehicle,
  peakHours,
}: {
  byVehicle: readonly VehicleUtilizationRow[];
  peakHours: readonly PeakDemandBucket[];
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Peak Demand Hours (24h)</CardTitle>
          <CardDescription>
            Completed trip dispatches grouped by start hour to optimize driver
            shifts and fleet sizing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={peakChartConfig} className="h-64 w-full">
            <BarChart data={[...peakHours]} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="trips" fill="var(--color-trips)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Fleet Asset Utilization (30-day window)
          </CardTitle>
          <CardDescription>
            Identifies underused assets so you can rebalance routes or
            right-size the fleet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Trips</TableHead>
                  <TableHead className="text-right">Active days</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Utilization</TableHead>
                  <TableHead>Assessment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byVehicle.map((row) => (
                  <TableRow key={row.vehicleId}>
                    <TableCell>
                      <p className="font-medium">{row.vehicleName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.plate}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">{row.tripCount}</TableCell>
                    <TableCell className="text-right">
                      {row.activeDays} / 30d
                    </TableCell>
                    <TableCell className="text-right">
                      {formatKm(row.totalDistanceKm)} km
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {row.utilizationPct}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.underused ? "outline" : "secondary"}
                        className={
                          row.underused
                            ? "border-[var(--brand-amber)]/40 bg-[var(--brand-amber)]/15 text-[var(--brand-amber)]"
                            : "border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/15 text-[var(--brand-teal)]"
                        }
                      >
                        {row.underused ? "Underused" : "Healthy"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
