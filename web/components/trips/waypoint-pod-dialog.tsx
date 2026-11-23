"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SinglePhotoUpload } from "@/components/photo-upload";
import { SignaturePad } from "@/components/signature-pad";
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
import type { TripWaypoint } from "@/types";

interface WaypointPodDialogProps {
  waypoint: TripWaypoint | null;
  onOpenChange: (open: boolean) => void;
  onSavePod: (
    waypointId: string,
    pod: {
      recipientName: string;
      podSignatureDataUrl?: string;
      podPhotoDataUrl?: string;
    }
  ) => void;
}

export function WaypointPodDialog({
  waypoint,
  onOpenChange,
  onSavePod,
}: WaypointPodDialogProps) {
  const [recipientName, setRecipientName] = useState("");
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!waypoint || !recipientName.trim()) {
      toast.error("Enter recipient name.");
      return;
    }
    onSavePod(waypoint.id, {
      recipientName: recipientName.trim(),
      podSignatureDataUrl: signature,
      podPhotoDataUrl: photo,
    });
    setRecipientName("");
    setSignature(undefined);
    setPhoto(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={waypoint !== null}
      onOpenChange={(o) => {
        if (!o) {
          setRecipientName("");
          setSignature(undefined);
          setPhoto(undefined);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proof of Delivery (POD)</DialogTitle>
          <DialogDescription>
            {waypoint?.label} · {waypoint?.address}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pod-recipient">Recipient full name</Label>
            <Input
              id="pod-recipient"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Receiving officer / client name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Digital signature</Label>
            <SignaturePad value={signature} onChange={setSignature} />
          </div>
          <div className="space-y-1.5">
            <Label>Delivery photo (optional)</Label>
            <SinglePhotoUpload
              value={photo}
              onChange={setPhoto}
              label="Capture delivery photo"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl">
              Save POD &amp; Mark Arrived
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
