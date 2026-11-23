"use client";

import { useMemo, useState } from "react";
import { Search, Shield } from "lucide-react";
import { TablePagination, usePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useFleetStore } from "@/store/fleet-store";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";

const ALL_ENTITIES = "__all_entities__";
const ENTITY_FILTER_ITEMS: Record<string, string> = {
  [ALL_ENTITIES]: "All modules",
  vehicle: "Vehicles",
  compliance: "Compliance",
  driver: "Drivers",
  booking: "Bookings",
  trip: "Trips",
  geofence: "Geofences",
  fuel: "Fuel",
  expense: "Expenses",
  maintenance: "Maintenance",
  work_order: "Work Orders",
  incident: "Incidents",
  rbac: "RBAC",
};

export function AuditLogTab({ canViewAudit }: { canViewAudit: boolean }) {
  const auditLogs = useFleetStore((s) => s.auditLogs);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditEntity, setAuditEntity] = useState(ALL_ENTITIES);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (auditEntity !== ALL_ENTITIES && entry.entityType !== auditEntity) {
        return false;
      }
      if (q) {
        const hay = `${entry.actorName} ${entry.action} ${entry.summary} ${entry.entityType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [auditLogs, auditEntity, auditSearch]);

  const pagination = usePagination(filteredAuditLogs, 10);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-lg">System Audit Log</CardTitle>
          <CardDescription>
            Immutable record of vehicle updates, approvals, compliance changes,
            work orders, and RBAC edits.
          </CardDescription>
        </div>

        {canViewAudit ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="relative lg:col-span-7">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  pagination.setPage(1);
                }}
                placeholder="Search actor, action, or summary..."
                className="pl-10"
              />
            </div>
            <div className="lg:col-span-5">
              <Select
                value={auditEntity}
                items={ENTITY_FILTER_ITEMS}
                onValueChange={(val) => {
                  if (val) {
                    setAuditEntity(val);
                    pagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTITY_FILTER_ITEMS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {!canViewAudit ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">
              Audit log access is restricted to Super Admins and Fleet Managers.
            </p>
          </div>
        ) : filteredAuditLogs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No audit entries match your filter.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(entry.timestamp)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {entry.actorName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ROLE_LABELS[entry.actorRole]}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-md capitalize">
                          {entry.entityType.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entry.action}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-sm">
                        {entry.summary}
                      </TableCell>
                    </TableRow>
                  ))}
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
              itemLabel="audit entries"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
