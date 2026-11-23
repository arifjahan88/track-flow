"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { StaggerGrid, StaggerItem } from "@/components/motion";
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
import type { VehicleTcoRow } from "@/lib/analytics";
import { formatCurrency, formatKm } from "@/lib/format";

const tcoChartConfig: ChartConfig = {
  fuelCost: { label: "Fuel", color: "var(--chart-1)" },
  maintenanceCost: { label: "Maintenance", color: "var(--chart-2)" },
  expenseCost: { label: "Expenses", color: "var(--chart-3)" },
  insuranceCost: { label: "Insurance", color: "var(--chart-4)" },
  depreciationCost: { label: "Depreciation", color: "var(--chart-5)" },
};

export function TcoAnalyticsTab({ tcoRows }: { tcoRows: readonly VehicleTcoRow[] }) {
  const fleetTcoTotal = tcoRows.reduce((s, r) => s + r.totalTco, 0);
  const fleetTcoDistance = tcoRows.reduce((s, r) => s + r.distanceKm, 0);
  const fleetCpk =
    fleetTcoDistance > 0 ? fleetTcoTotal / fleetTcoDistance : null;

  return (
    <div className="space-y-5">
      <StaggerGrid className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Fleet Total Cost of Ownership</CardDescription>
              <CardTitle className="font-display text-2xl">
                {formatCurrency(fleetTcoTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Fuel + Maintenance + Work Orders + Expenses + Insurance +
              Depreciation (3 mo)
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Fleet Cost per Kilometer (CPK)</CardDescription>
              <CardTitle className="font-display text-2xl text-primary">
                {fleetCpk !== null ? `${formatCurrency(fleetCpk)} / km` : "N/A"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Across {formatKm(fleetTcoDistance)} tracked km
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Vehicles Analyzed</CardDescription>
              <CardTitle className="font-display text-2xl">
                {tcoRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Total Cost of Ownership by Vehicle
          </CardTitle>
          <CardDescription>
            Stacked cost breakdown across fuel, maintenance/repairs, operating
            expenses, insurance, and depreciation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={tcoChartConfig} className="h-72 w-full">
            <BarChart data={[...tcoRows]} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="vehicleName" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="fuelCost" stackId="a" fill="var(--color-fuelCost)" />
              <Bar
                dataKey="maintenanceCost"
                stackId="a"
                fill="var(--color-maintenanceCost)"
              />
              <Bar
                dataKey="expenseCost"
                stackId="a"
                fill="var(--color-expenseCost)"
              />
              <Bar
                dataKey="insuranceCost"
                stackId="a"
                fill="var(--color-insuranceCost)"
              />
              <Bar
                dataKey="depreciationCost"
                stackId="a"
                fill="var(--color-depreciationCost)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">
            Per-Vehicle CPK &amp; TCO Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Fuel</TableHead>
                  <TableHead className="text-right">Maint &amp; WO</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Insurance</TableHead>
                  <TableHead className="text-right">Depr.</TableHead>
                  <TableHead className="text-right">Total TCO</TableHead>
                  <TableHead className="text-right">CPK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tcoRows.map((row) => (
                  <TableRow key={row.vehicleId}>
                    <TableCell>
                      <p className="font-medium">{row.vehicleName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.plate}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.fuelCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.maintenanceCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.expenseCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.insuranceCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.depreciationCost)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(row.totalTco)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="rounded-lg border-primary/30 bg-primary/15 text-primary">
                        {row.cpk !== null
                          ? `${formatCurrency(row.cpk)}/km`
                          : "—"}
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
