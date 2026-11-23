"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SinglePhotoUpload } from "@/components/photo-upload";
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
import { formatCurrency, formatShortDate, toIsoDate } from "@/lib/format";
import type { ExpenseCategory } from "@/types";

const ALL_CATEGORIES = "__all_categories__";
const NO_TRIP = "__no_trip__";

const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "Tolls",
  "Parking",
  "Fines",
  "Driver allowance",
  "Other",
];
const EXPENSE_CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c, c])
);
const EXPENSE_CATEGORY_FILTER_ITEMS: Record<string, string> = {
  [ALL_CATEGORIES]: "All categories",
  ...EXPENSE_CATEGORY_ITEMS,
};

interface OperatingExpensesTabProps {
  vehicleFilter: string;
  allVehiclesSentinel: string;
  canWrite: boolean;
  onPreviewReceipt: (url: string) => void;
}

export function OperatingExpensesTab({
  vehicleFilter,
  allVehiclesSentinel,
  canWrite,
  onPreviewReceipt,
}: OperatingExpensesTabProps) {
  const vehicles = useFleetStore((s) => s.vehicles);
  const trips = useFleetStore((s) => s.trips);
  const expenses = useFleetStore((s) => s.expenses);
  const addExpense = useFleetStore((s) => s.addExpense);
  const removeExpense = useFleetStore((s) => s.removeExpense);

  const [expSearch, setExpSearch] = useState("");
  const [expCategoryFilter, setExpCategoryFilter] = useState(ALL_CATEGORIES);
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expTripId, setExpTripId] = useState(NO_TRIP);
  const [expDate, setExpDate] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("Tolls");
  const [expAmount, setExpAmount] = useState("");
  const [expCostCenter, setExpCostCenter] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expReceipt, setExpReceipt] = useState<string | undefined>(undefined);

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );
  const tripsById = useMemo(
    () => new Map(trips.map((t) => [t.id, t])),
    [trips]
  );

  const vehicleSelectItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const v of vehicles) items[v.id] = `${v.name} (${v.plate})`;
    return items;
  }, [vehicles]);

  const tripSelectItems = useMemo(() => {
    const items: Record<string, string> = { [NO_TRIP]: "Not linked to a trip" };
    for (const t of trips.slice(0, 25)) {
      items[t.id] = `${t.purpose} (${t.startedAt.slice(0, 10)})`;
    }
    return items;
  }, [trips]);

  const filteredExpenses = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (
          vehicleFilter !== allVehiclesSentinel &&
          e.vehicleId !== vehicleFilter
        ) {
          return false;
        }
        if (
          expCategoryFilter !== ALL_CATEGORIES &&
          e.category !== expCategoryFilter
        ) {
          return false;
        }
        if (q) {
          const v = vehiclesById.get(e.vehicleId);
          const hay = `${e.description} ${e.category} ${e.costCenter ?? ""} ${v?.name ?? ""} ${v?.plate ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    expenses,
    vehicleFilter,
    allVehiclesSentinel,
    expCategoryFilter,
    expSearch,
    vehiclesById,
  ]);

  const pagination = usePagination(filteredExpenses, 10);

  const openAddDialog = () => {
    setExpVehicleId(
      vehicleFilter !== allVehiclesSentinel
        ? vehicleFilter
        : vehicles[0]?.id ?? ""
    );
    setExpTripId(NO_TRIP);
    setExpDate(toIsoDate());
    setExpCategory("Tolls");
    setExpAmount("");
    setExpCostCenter("Operations");
    setExpDescription("");
    setExpReceipt(undefined);
    setExpDialogOpen(true);
  };

  const handleAddExpense = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(expAmount);
    if (
      !expVehicleId ||
      !expDescription.trim() ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      toast.error("Provide vehicle, description, and valid amount.");
      return;
    }
    addExpense({
      vehicleId: expVehicleId,
      tripId: expTripId === NO_TRIP ? undefined : expTripId,
      date: expDate || toIsoDate(),
      category: expCategory,
      amount: Number(amount.toFixed(2)),
      costCenter: expCostCenter.trim() || undefined,
      description: expDescription.trim(),
      receiptPhotoDataUrl: expReceipt,
    });
    toast.success("Operating expense logged.");
    setExpDialogOpen(false);
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Operating Expenses</CardTitle>
              <CardDescription>
                Tolls, parking fees, fines, and driver allowances linked to
                trips and cost centers.
              </CardDescription>
            </div>
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                onClick={openAddDialog}
                disabled={vehicles.length === 0}
                className="h-10 rounded-xl"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add expense
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-12">
            <div className="relative sm:col-span-7">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={expSearch}
                onChange={(e) => {
                  setExpSearch(e.target.value);
                  pagination.setPage(1);
                }}
                placeholder="Search description, cost center, or vehicle..."
                className="pl-10"
              />
            </div>
            <div className="sm:col-span-5">
              <Select
                value={expCategoryFilter}
                items={EXPENSE_CATEGORY_FILTER_ITEMS}
                onValueChange={(v) => {
                  if (v) {
                    setExpCategoryFilter(v);
                    pagination.setPage(1);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_FILTER_ITEMS).map(
                    ([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No operating expenses match your filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description / Trip</TableHead>
                      <TableHead>Cost center</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((exp) => {
                      const veh = vehiclesById.get(exp.vehicleId);
                      const trip = exp.tripId
                        ? tripsById.get(exp.tripId)
                        : undefined;
                      return (
                        <TableRow key={exp.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatShortDate(exp.date)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {veh?.name ?? "Unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-lg">
                              {exp.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{exp.description}</p>
                            {trip ? (
                              <p className="text-xs text-muted-foreground">
                                Trip: {trip.purpose}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {exp.costCenter ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(exp.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              {exp.receiptPhotoDataUrl ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    onPreviewReceipt(
                                      exp.receiptPhotoDataUrl ?? ""
                                    )
                                  }
                                >
                                  <Receipt className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              ) : null}
                              {canWrite ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    removeExpense(exp.id);
                                    toast.success("Expense removed.");
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
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
                itemLabel="expenses"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log operating expense</DialogTitle>
            <DialogDescription>
              Record tolls, parking, fines, or allowances for TCO tracking.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vehicle</Label>
                <Select
                  value={expVehicleId}
                  items={vehicleSelectItems}
                  onValueChange={(v) => {
                    if (v) setExpVehicleId(v);
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
                <Label>Category</Label>
                <Select
                  value={expCategory}
                  items={EXPENSE_CATEGORY_ITEMS}
                  onValueChange={(v) => {
                    if (v) setExpCategory(v as ExpenseCategory);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={expDate} onChange={setExpDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="15.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Linked trip (optional)</Label>
              <Select
                value={expTripId}
                items={tripSelectItems}
                onValueChange={(v) => {
                  if (v) setExpTripId(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TRIP}>Not linked to a trip</SelectItem>
                  {trips.slice(0, 25).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.purpose} ({t.startedAt.slice(0, 10)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cost center</Label>
              <Input
                value={expCostCenter}
                onChange={(e) => setExpCostCenter(e.target.value)}
                placeholder="Logistics-North"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                required
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                placeholder="Expressway bridge toll pass"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt photo (optional)</Label>
              <SinglePhotoUpload
                value={expReceipt}
                onChange={setExpReceipt}
                label="Upload expense receipt"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpDialogOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                Save expense
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
