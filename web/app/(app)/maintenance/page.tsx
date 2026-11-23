"use client";

import { useMemo } from "react";
import { AlertOctagon, ClipboardList, Wrench } from "lucide-react";
import { IncidentsTab } from "@/components/maintenance/incidents-tab";
import { ServiceRulesTab } from "@/components/maintenance/service-rules-tab";
import { WorkOrdersTab } from "@/components/maintenance/work-orders-tab";
import { StaggerGrid, StaggerItem } from "@/components/motion";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { can } from "@/lib/rbac";

export default function MaintenancePage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentRole =
    users.find((u) => u.id === currentUserId)?.role ?? "super_admin";

  const canWriteMaint = can(currentRole, "maintenance:write");
  const canWriteWorkOrders = can(currentRole, "work_orders:write");
  const canWriteIncidents = can(currentRole, "incidents:write");

  const vehicles = useFleetStore((s) => s.vehicles);
  const records = useFleetStore((s) => s.maintenanceRecords);
  const workOrders = useFleetStore((s) => s.workOrders);
  const incidents = useFleetStore((s) => s.incidents);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const counts = useMemo(() => {
    if (!hydrated) {
      return { overdue: 0, dueSoon: 0, openWo: 0, openInc: 0 };
    }
    let overdue = 0;
    let dueSoon = 0;
    for (const rec of records) {
      const v = vehiclesById.get(rec.vehicleId);
      const st = getMaintenanceStatus(
        rec,
        v?.odometerKm ?? 0,
        undefined,
        v?.engineHours
      );
      if (st === "overdue") overdue += 1;
      else if (st === "due_soon") dueSoon += 1;
    }
    return {
      overdue,
      dueSoon,
      openWo: workOrders.filter((w) => w.status !== "completed").length,
      openInc: incidents.filter((i) => i.status !== "resolved").length,
    };
  }, [hydrated, records, vehiclesById, workOrders, incidents]);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Maintenance, Work Orders &amp; Incidents
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preventive rules (odometer, engine hours, calendar), corrective work
          orders &amp; vendor parts, and accident reporting.
        </p>
      </div>

      <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Overdue Services</CardDescription>
              <CardTitle className="font-display text-2xl text-destructive">
                {counts.overdue}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Due Soon (14d / 500km / 25h)</CardDescription>
              <CardTitle className="font-display text-2xl text-[var(--brand-amber)]">
                {counts.dueSoon}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Active Work Orders</CardDescription>
              <CardTitle className="font-display text-2xl text-primary">
                {counts.openWo}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full rounded-2xl">
            <CardHeader className="pb-2">
              <CardDescription>Open Incidents</CardDescription>
              <CardTitle className="font-display text-2xl text-[var(--brand-amber)]">
                {counts.openInc}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
      </StaggerGrid>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 rounded-xl sm:max-w-lg">
          <TabsTrigger value="rules" className="rounded-lg">
            <Wrench className="mr-1.5 h-3.5 w-3.5" />
            Services ({records.length})
          </TabsTrigger>
          <TabsTrigger value="work_orders" className="rounded-lg">
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
            Work Orders ({workOrders.length})
          </TabsTrigger>
          <TabsTrigger value="incidents" className="rounded-lg">
            <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
            Incidents ({incidents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <ServiceRulesTab canWrite={canWriteMaint} />
        </TabsContent>
        <TabsContent value="work_orders">
          <WorkOrdersTab canWrite={canWriteWorkOrders} />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentsTab canWrite={canWriteIncidents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
