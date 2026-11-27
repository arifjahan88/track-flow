"use client";

import { useState, type FormEvent } from "react";
import { MapPin, Send } from "lucide-react";
import { toast } from "sonner";
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
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { toIsoDate } from "@/lib/format";

interface RequestTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function RequestTripDialog({
  open,
  onOpenChange,
  onSubmitted,
}: RequestTripDialogProps) {
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);
  const addBooking = useFleetStore((s) => s.addBooking);

  const [requesterName, setRequesterName] = useState(
    currentUser?.name ?? "Nadia Karim"
  );
  const [department, setDepartment] = useState("Operations");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [requestedDate, setRequestedDate] = useState(toIsoDate());
  const [requestedTime, setRequestedTime] = useState("10:00");
  const [passengerCount, setPassengerCount] = useState("1");
  const [estimatedKm, setEstimatedKm] = useState("22");
  const [notes, setNotes] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setRequesterName(currentUser?.name ?? "Nadia Karim");
      setRequestedDate(toIsoDate());
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!requesterName.trim() || !purpose.trim()) {
      toast.error("Please provide requester name and trip purpose.");
      return;
    }
    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      toast.error("Please enter both pickup and drop-off locations.");
      return;
    }

    addBooking({
      requesterUserId: currentUser?.id,
      requesterName: requesterName.trim(),
      department: department.trim() || "General",
      purpose: purpose.trim(),
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      requestedDate: requestedDate || toIsoDate(),
      requestedTime: requestedTime || "10:00",
      passengerCount: Math.max(1, Number(passengerCount) || 1),
      estimatedKm: Math.max(1, Number(estimatedKm) || 15),
      notes: notes.trim() || undefined,
    });

    toast.success("Trip request sent to Admin for driver assignment.");
    setPickupLocation("");
    setDropoffLocation("");
    setPurpose("");
    setNotes("");
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            Request a New Trip
          </DialogTitle>
          <DialogDescription>
            Submit your route details. An Admin or Dispatcher will review availability and assign a
            driver &amp; vehicle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-name">Requester name</Label>
              <Input
                id="req-name"
                required
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Nadia Karim"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-dept">Department</Label>
              <Input
                id="req-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Operations / Supply Chain"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-pickup">Pickup location</Label>
              <Input
                id="req-pickup"
                required
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Central HQ / Gulshan-2 Hub"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-dropoff">Drop-off destination</Label>
              <Input
                id="req-dropoff"
                required
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="Airport Gate 4 / Client Site"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-purpose">Trip purpose</Label>
            <Input
              id="req-purpose"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Client handover, urgent cargo delivery, or site visit"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Requested date</Label>
              <DatePicker value={requestedDate} onChange={setRequestedDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-time">Pickup time</Label>
              <Input
                id="req-time"
                type="time"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-km">Est. km</Label>
              <Input
                id="req-km"
                type="number"
                min={1}
                value={estimatedKm}
                onChange={(e) => setEstimatedKm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-pax">Passengers</Label>
              <Input
                id="req-pax"
                type="number"
                min={1}
                max={20}
                value={passengerCount}
                onChange={(e) => setPassengerCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="req-notes">Special instructions (optional)</Label>
              <Input
                id="req-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cold-chain bay, fragile parcels, VIP pickup..."
              />
            </div>
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
            <Button
              type="submit"
              className="gap-1.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Send className="size-3.5" />
              Submit Request to Admin
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
