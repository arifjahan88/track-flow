"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { computeWorkOrderTotal } from "@/lib/analytics";
import {
  formatCurrency,
  formatShortDate,
  offsetIsoDate,
  toIsoDate,
} from "@/lib/format";
import type {
  SparePartLine,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/types";

const WO_STATUS_ITEMS: Record<WorkOrderStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_parts: "Waiting Parts",
  completed: "Completed",
};

const WO_PRIORITY_ITEMS: Record<WorkOrderPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function WorkOrdersTab({
  canWrite,
}: {
  canWrite: boolean;
}) {
  const vehicles = useFleetStore((s) => s.vehicles);
  const workOrders = useFleetStore((s) => s.workOrders);
  const addWorkOrder = useFleetStore((s) => s.addWorkOrder);
  const updateWorkOrderStatus = useFleetStore((s) => s.updateWorkOrderStatus);
  const removeWorkOrder = useFleetStore((s) => s.removeWorkOrder);

  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [woSearch, setWoSearch] = useState("");
  const [woVehicleId, setWoVehicleId] = useState("");
  const [woTitle, setWoTitle] = useState("");
  const [woPriority, setWoPriority] = useState<WorkOrderPriority>("medium");
  const [woVendor, setWoVendor] = useState("");
  const [woPhone, setWoPhone] = useState("");
  const [woDowntime, setWoDowntime] = useState("4");
  const [woWarranty, setWoWarranty] = useState("");
  const [woLabor, setWoLabor] = useState("60");
  const [woParts, setWoParts] = useState<SparePartLine[]>([]);
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [partCost, setPartCost] = useState("");

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const filteredWorkOrders = useMemo(() => {
    const q = woSearch.trim().toLowerCase();
    return workOrders.filter((w) => {
      if (!q) return true;
      const v = vehiclesById.get(w.vehicleId);
      const hay = `${w.title} ${w.vendorName} ${w.status} ${v?.name ?? ""} ${v?.plate ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [workOrders, woSearch, vehiclesById]);

  const woPagination = usePagination(filteredWorkOrders, 10);

  const openAddWorkOrder = () => {
    setWoVehicleId(vehicles[0]?.id ?? "");
    setWoTitle("");
    setWoPriority("medium");
    setWoVendor("");
    setWoPhone("");
    setWoDowntime("4");
    setWoWarranty(offsetIsoDate(180));
    setWoLabor("60");
    setWoParts([]);
    setPartName("");
    setPartQty("1");
    setPartCost("");
    setWoDialogOpen(true);
  };

  const handleAddPart = () => {
    const qty = Number(partQty);
    const unitCost = Number(partCost);
    if (!partName.trim() || qty <= 0 || Number.isNaN(unitCost) || unitCost < 0) {
      return;
    }
    setWoParts((prev) => [
      ...prev,
      {
        id: `pt-${Date.now()}-${prev.length}`,
        name: partName.trim(),
        qty,
        unitCost,
      },
    ]);
    setPartName("");
    setPartQty("1");
    setPartCost("");
  };

  const handleCreateWorkOrder = (e: FormEvent) => {
    e.preventDefault();
    if (!woVehicleId || !woTitle.trim() || !woVendor.trim()) {
      toast.error("Provide vehicle, repair title, and vendor/garage.");
      return;
    }
    addWorkOrder({
      vehicleId: woVehicleId,
      title: woTitle.trim(),
      status: "open",
      priority: woPriority,
      vendorName: woVendor.trim(),
      mechanicPhone: woPhone.trim() || undefined,
      openedAt: toIsoDate(),
      downtimeHours: Math.max(0, Number(woDowntime) || 0),
      warrantyUntil: woWarranty || undefined,
      parts: woParts,
      laborCost: Math.max(0, Number(woLabor) || 0),
    });
    toast.success("Work order created and vehicle marked Under Maintenance.");
    setWoDialogOpen(false);
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">
                Work Orders &amp; Vendor Logs
              </CardTitle>
              <CardDescription>
                Track repair tickets, garages, spare parts, warranty coverage,
                and vehicle downtime.
              </CardDescription>
            </div>
            {canWrite ? (
              <Button
                type="button"
                onClick={openAddWorkOrder}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Open work order
              </Button>
            ) : null}
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={woSearch}
              onChange={(e) => {
                setWoSearch(e.target.value);
                woPagination.setPage(1);
              }}
              placeholder="Search work order, vendor, or vehicle..."
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredWorkOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No work orders found.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket / Parts</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Vendor / Garage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Downtime / Warranty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {woPagination.pageItems.map((wo) => {
                      const veh = vehiclesById.get(wo.vehicleId);
                      const total = computeWorkOrderTotal(wo);
                      return (
                        <TableRow key={wo.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">
                              {wo.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {wo.parts.length} part
                              {wo.parts.length === 1 ? "" : "s"} · Priority{" "}
                              <span className="capitalize">{wo.priority}</span>
                            </p>
                          </TableCell>
                          <TableCell className="font-medium">
                            {veh?.name ?? "Unknown"}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{wo.vendorName}</p>
                            {wo.mechanicPhone ? (
                              <p className="text-xs text-muted-foreground">
                                {wo.mechanicPhone}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {canWrite ? (
                              <Select
                                value={wo.status}
                                items={WO_STATUS_ITEMS}
                                onValueChange={(next) => {
                                  if (!next) return;
                                  updateWorkOrderStatus(
                                    wo.id,
                                    next as WorkOrderStatus
                                  );
                                  toast.success(
                                    `Work order marked ${WO_STATUS_ITEMS[next as WorkOrderStatus]}.`
                                  );
                                }}
                              >
                                <SelectTrigger size="sm" className="w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    Object.entries(WO_STATUS_ITEMS) as [
                                      WorkOrderStatus,
                                      string,
                                    ][]
                                  ).map(([k, label]) => (
                                    <SelectItem key={k} value={k}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">
                                {WO_STATUS_ITEMS[wo.status]}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <p>{wo.downtimeHours}h downtime</p>
                            {wo.warrantyUntil ? (
                              <p>
                                Warranty: {formatShortDate(wo.warrantyUntil)}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {canWrite ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  removeWorkOrder(wo.id);
                                  toast.success("Work order deleted.");
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={woPagination.page}
                pageSize={woPagination.pageSize}
                totalItems={woPagination.totalItems}
                totalPages={woPagination.totalPages}
                startIndex={woPagination.startIndex}
                endIndex={woPagination.endIndex}
                onPageChange={woPagination.setPage}
                onPageSizeChange={woPagination.setPageSize}
                itemLabel="work orders"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={woDialogOpen} onOpenChange={setWoDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open Work Order</DialogTitle>
            <DialogDescription>
              Log a repair ticket with vendor/garage details, spare parts,
              warranty, and downtime.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWorkOrder} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vehicle</Label>
                <Select
                  value={woVehicleId}
                  items={vehicleSelectItems}
                  onValueChange={(v) => {
                    if (v) setWoVehicleId(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={woPriority}
                  items={WO_PRIORITY_ITEMS}
                  onValueChange={(v) => {
                    if (v) setWoPriority(v as WorkOrderPriority);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(WO_PRIORITY_ITEMS) as [
                        WorkOrderPriority,
                        string,
                      ][]
                    ).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Repair title</Label>
              <Input
                required
                value={woTitle}
                onChange={(e) => setWoTitle(e.target.value)}
                placeholder="Alternator & serpentine belt replacement"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vendor / Garage name</Label>
                <Input
                  required
                  value={woVendor}
                  onChange={(e) => setWoVendor(e.target.value)}
                  placeholder="Dhaka Fleet Motors"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mechanic phone</Label>
                <Input
                  value={woPhone}
                  onChange={(e) => setWoPhone(e.target.value)}
                  placeholder="+880 1755-908112"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Labor cost ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={woLabor}
                  onChange={(e) => setWoLabor(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Downtime (hrs)</Label>
                <Input
                  type="number"
                  min={0}
                  value={woDowntime}
                  onChange={(e) => setWoDowntime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty until</Label>
                <DatePicker
                  value={woWarranty}
                  onChange={setWoWarranty}
                  clearable
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <Label className="text-xs font-semibold">
                Spare parts replaced
              </Label>
              <div className="grid gap-2 sm:grid-cols-12">
                <Input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Part name"
                  className="sm:col-span-5"
                />
                <Input
                  type="number"
                  min={1}
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  placeholder="Qty"
                  className="sm:col-span-2"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={partCost}
                  onChange={(e) => setPartCost(e.target.value)}
                  placeholder="Unit $"
                  className="sm:col-span-3"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddPart}
                  className="h-10 rounded-xl sm:col-span-2"
                >
                  Add
                </Button>
              </div>
              {woParts.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border bg-card text-xs">
                  {woParts.map((pt) => (
                    <div
                      key={pt.id}
                      className="flex items-center justify-between px-2.5 py-1.5"
                    >
                      <span>
                        {pt.name} × {pt.qty} ({formatCurrency(pt.unitCost)})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setWoParts((prev) =>
                            prev.filter((p) => p.id !== pt.id)
                          )
                        }
                        className="text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWoDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Create work order
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
