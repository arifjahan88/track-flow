"use client";

import { useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { MultiPhotoUpload } from "@/components/photo-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TripChecklist } from "@/types";

interface TripChecklistDialogProps {
  open: boolean;
  phase: "pre" | "post";
  onOpenChange: (open: boolean) => void;
  onConfirm: (checklist: TripChecklist) => void;
}

export function TripChecklistDialog({
  open,
  phase,
  onOpenChange,
  onConfirm,
}: TripChecklistDialogProps) {
  const [tiresOk, setTiresOk] = useState(true);
  const [lightsOk, setLightsOk] = useState(true);
  const [brakesOk, setBrakesOk] = useState(true);
  const [fluidsOk, setFluidsOk] = useState(true);
  const [bodyOk, setBodyOk] = useState(true);
  const [notes, setNotes] = useState("");
  const [damagePhotos, setDamagePhotos] = useState<string[]>([]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onConfirm({
      phase,
      completedAt: new Date().toISOString(),
      tiresOk,
      lightsOk,
      brakesOk,
      fluidsOk,
      bodyOk,
      notes: notes.trim() || undefined,
      damagePhotos,
    });
    setNotes("");
    setDamagePhotos([]);
  };

  const checks: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    { id: "chk-tires", label: "Tire pressure & tread OK", checked: tiresOk, onChange: setTiresOk },
    { id: "chk-lights", label: "Headlights, brake lights & indicators OK", checked: lightsOk, onChange: setLightsOk },
    { id: "chk-brakes", label: "Service & parking brakes responsive", checked: brakesOk, onChange: setBrakesOk },
    { id: "chk-fluids", label: "Oil, coolant & washer fluid levels OK", checked: fluidsOk, onChange: setFluidsOk },
    { id: "chk-body", label: "Exterior body & mirrors free of new damage", checked: bodyOk, onChange: setBodyOk },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {phase === "pre"
              ? "Pre-Trip Walkaround Inspection"
              : "Post-Trip Walkaround Inspection"}
          </DialogTitle>
          <DialogDescription>
            {phase === "pre"
              ? "Complete the digital safety checklist before starting navigation."
              : "Verify vehicle condition and attach any damage photos before closing the trip."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            {checks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <Label htmlFor={item.id} className="font-normal">
                  {item.label}
                </Label>
                <Switch
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={item.onChange}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chk-notes">Inspector notes (optional)</Label>
            <Input
              id="chk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any defects, fluid top-up, or scuff notes..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Walkaround / damage photos (optional)</Label>
            <MultiPhotoUpload
              values={damagePhotos}
              onChange={setDamagePhotos}
              maxPhotos={3}
              label="Add photo"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl">
              {phase === "pre" ? "Confirm & Start Trip" : "Confirm & End Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
