"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FileCheck2, Fuel, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { SinglePhotoUpload } from "@/components/photo-upload";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetStore } from "@/store/fleet-store";
import { COMPLIANCE_DOC_LABELS, COMPLIANCE_DOC_TYPES, getComplianceStatus } from "@/lib/compliance";
import { formatCurrency, formatKm, formatShortDate, offsetIsoDate, toIsoDate } from "@/lib/format";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import type { ComplianceDocType, Vehicle } from "@/types";

interface VehicleDetailsDialogProps {
  vehicle: Vehicle | null;
  canEditCompliance: boolean;
  onClose: () => void;
}

export function VehicleDetailsDialog({
  vehicle,
  canEditCompliance,
  onClose,
}: VehicleDetailsDialogProps) {
  const fuelLogs = useFleetStore((s) => s.fuelLogs);
  const maintenanceRecords = useFleetStore((s) => s.maintenanceRecords);
  const complianceDocs = useFleetStore((s) => s.complianceDocs);
  const addComplianceDoc = useFleetStore((s) => s.addComplianceDoc);
  const removeComplianceDoc = useFleetStore((s) => s.removeComplianceDoc);

  const [docFormOpen, setDocFormOpen] = useState(false);
  const [docType, setDocType] = useState<ComplianceDocType>("insurance");
  const [docNumber, setDocNumber] = useState("");
  const [docIssuer, setDocIssuer] = useState("");
  const [docIssueDate, setDocIssueDate] = useState("");
  const [docExpiryDate, setDocExpiryDate] = useState("");
  const [docCost, setDocCost] = useState("");
  const [docAttachment, setDocAttachment] = useState<string | undefined>(undefined);

  const detailsFuelLogs = vehicle
    ? fuelLogs
        .filter((f) => f.vehicleId === vehicle.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const detailsEfficiency = computeFuelEfficiency(detailsFuelLogs);
  const detailsAvgEfficiency = getAverageEfficiency(detailsEfficiency);
  const detailsMaintenance = vehicle
    ? maintenanceRecords.filter((m) => m.vehicleId === vehicle.id)
    : [];
  const detailsCompliance = vehicle ? complianceDocs.filter((c) => c.vehicleId === vehicle.id) : [];

  const openAddDoc = () => {
    setDocType("insurance");
    setDocNumber("");
    setDocIssuer("");
    setDocIssueDate(toIsoDate());
    setDocExpiryDate(offsetIsoDate(365));
    setDocCost("");
    setDocAttachment(undefined);
    setDocFormOpen(true);
  };

  const handleAddComplianceDoc = (e: FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;
    if (!docNumber.trim() || !docIssuer.trim() || !docExpiryDate) {
      toast.error("Provide document number, issuer, and expiry date.");
      return;
    }
    addComplianceDoc({
      vehicleId: vehicle.id,
      docType,
      documentNumber: docNumber.trim(),
      issuer: docIssuer.trim(),
      issueDate: docIssueDate || toIsoDate(),
      expiryDate: docExpiryDate,
      cost: docCost ? Number(docCost) : undefined,
      attachmentDataUrl: docAttachment,
    });
    toast.success("Compliance document added to vault.");
    setDocFormOpen(false);
  };

  return (
    <Dialog
      open={vehicle !== null}
      onOpenChange={(open) => {
        if (!open) {
          setDocFormOpen(false);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vehicle?.name} ({vehicle?.plate})
          </DialogTitle>
          <DialogDescription>
            {[vehicle?.year, vehicle?.make, vehicle?.model, vehicle?.fuelType]
              .filter(Boolean)
              .join(" · ") || vehicle?.type}{" "}
            · Odometer {vehicle ? formatKm(vehicle.odometerKm) : "0.00"} km
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="compliance" className="mt-2">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="compliance" className="rounded-lg">
              <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
              Vault ({detailsCompliance.length})
            </TabsTrigger>
            <TabsTrigger value="fuel" className="rounded-lg">
              <Fuel className="mr-1.5 h-3.5 w-3.5" />
              Fuel ({detailsFuelLogs.length})
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="rounded-lg">
              <Wrench className="mr-1.5 h-3.5 w-3.5" />
              Service ({detailsMaintenance.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compliance" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Automated expiry alerts at 30, 15, and 7 days prior.
              </p>
              {canEditCompliance ? (
                <Button type="button" size="sm" onClick={openAddDoc} className="rounded-xl">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add document
                </Button>
              ) : null}
            </div>

            {docFormOpen ? (
              <form
                onSubmit={handleAddComplianceDoc}
                className="space-y-3 rounded-xl border border-border bg-muted/25 p-3.5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Document type</Label>
                    <Select
                      value={docType}
                      items={COMPLIANCE_DOC_LABELS}
                      onValueChange={(val) => {
                        if (val) setDocType(val as ComplianceDocType);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPLIANCE_DOC_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {COMPLIANCE_DOC_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Document / Policy #</Label>
                    <Input
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="INS-BD-2026-9001"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Issuer / Authority</Label>
                    <Input
                      value={docIssuer}
                      onChange={(e) => setDocIssuer(e.target.value)}
                      placeholder="BRTA / Green Delta"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Annual cost ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={docCost}
                      onChange={(e) => setDocCost(e.target.value)}
                      placeholder="350"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Issue date</Label>
                    <DatePicker value={docIssueDate} onChange={setDocIssueDate} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Expiry date</Label>
                    <DatePicker value={docExpiryDate} onChange={setDocExpiryDate} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Scan / Certificate photo (optional)</Label>
                  <SinglePhotoUpload
                    value={docAttachment}
                    onChange={setDocAttachment}
                    label="Attach document image"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDocFormOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save document
                  </Button>
                </div>
              </form>
            ) : null}

            {detailsCompliance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No compliance documents stored for this vehicle yet.
              </p>
            ) : (
              <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {detailsCompliance.map((doc) => {
                  const st = getComplianceStatus(doc.expiryDate);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {COMPLIANCE_DOC_LABELS[doc.docType]}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.documentNumber} · {doc.issuer} · Exp{" "}
                          {formatShortDate(doc.expiryDate)}
                          {doc.cost ? ` · ${formatCurrency(doc.cost)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            st.level === "expired" || st.level === "critical_7d"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            st.level === "warning_15d" || st.level === "notice_30d"
                              ? "border-(--brand-amber)/40 bg-(--brand-amber)/15 text-brand-amber"
                              : st.level === "valid"
                                ? "border-(--brand-teal)/30 bg-(--brand-teal)/15 text-brand-teal"
                                : ""
                          }
                        >
                          {st.label}
                        </Badge>
                        {canEditCompliance ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Delete document"
                            onClick={() => {
                              removeComplianceDoc(doc.id);
                              toast.success("Document removed.");
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fuel" className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Average efficiency</p>
                <p className="font-display text-xl font-semibold text-foreground">
                  {detailsAvgEfficiency !== null ? `${detailsAvgEfficiency} km/L` : "N/A"}
                </p>
              </div>
              <Link href="/fuel" onClick={onClose}>
                <Button size="sm" variant="outline" className="rounded-xl">
                  Open fuel logs
                </Button>
              </Link>
            </div>

            <Sparkline
              values={detailsEfficiency.map((p) => p.kmPerLiter)}
              labels={detailsEfficiency.map((p) => formatShortDate(p.date))}
            />

            {detailsFuelLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No fuel logs recorded for this vehicle yet.
              </p>
            ) : (
              <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {detailsFuelLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {formatShortDate(log.date)} · {log.liters} L
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Odometer {formatKm(log.odometerKm)} km ·{" "}
                        {log.fullTank ? "Full tank" : "Partial fill"}
                      </p>
                    </div>
                    <span className="font-medium text-foreground">
                      {formatCurrency(log.totalCost)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Link href="/maintenance" onClick={onClose}>
                <Button size="sm" variant="outline" className="rounded-xl">
                  Manage maintenance
                </Button>
              </Link>
            </div>
            {detailsMaintenance.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No maintenance records scheduled for this vehicle.
              </p>
            ) : (
              <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {detailsMaintenance.map((rec) => {
                  const status = getMaintenanceStatus(
                    rec,
                    vehicle?.odometerKm ?? 0,
                    undefined,
                    vehicle?.engineHours,
                  );
                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.type}
                          {rec.scheduledDate ? ` · Due ${formatShortDate(rec.scheduledDate)}` : ""}
                          {rec.dueOdometerKm
                            ? ` · ${rec.dueOdometerKm.toLocaleString("en-US")} km`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={status === "overdue" ? "destructive" : "secondary"}
                        className={
                          status === "due_soon"
                            ? "border-(--brand-amber)/40 bg-(--brand-amber)/15 text-brand-amber"
                            : ""
                        }
                      >
                        {status === "due_soon"
                          ? "Due soon"
                          : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
