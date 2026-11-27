"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  DispatcherDashboard,
  DriverDashboard,
  EmployeeDashboard,
  ExecutiveDashboard,
  MechanicDashboard,
} from "@/components/dashboard/role-dashboards";
import { AssignDriverDialog } from "@/components/trips/assign-driver-dialog";
import { RequestTripDialog } from "@/components/trips/request-trip-dialog";
import { TripChecklistDialog } from "@/components/trips/trip-checklist-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useHydrated } from "@/hooks/use-hydrated";
import type { TripBooking, TripChecklist, UserRole } from "@/types";

export default function DashboardPage() {
  const hydrated = useHydrated();
  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const startAssignedBooking = useFleetStore((s) => s.startAssignedBooking);
  const endActiveTripForVehicle = useFleetStore((s) => s.endActiveTripForVehicle);

  const [requestOpen, setRequestOpen] = useState(false);
  const [assigningBooking, setAssigningBooking] = useState<TripBooking | null>(null);
  const [checklistState, setChecklistState] = useState<{
    phase: "pre" | "post";
    vehicleId: string;
    bookingId?: string;
  } | null>(null);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole: UserRole = currentUser?.role ?? "super_admin";

  const handleStartBooking = (booking: TripBooking) => {
    if (!booking.vehicleId) {
      toast.error("Admin must assign a vehicle before starting this trip.");
      return;
    }
    setChecklistState({
      phase: "pre",
      vehicleId: booking.vehicleId,
      bookingId: booking.id,
    });
  };

  const handleFinishTrip = (vehicleId: string) => {
    setChecklistState({ phase: "post", vehicleId });
  };

  const handleChecklistConfirm = (checklist: TripChecklist) => {
    if (!checklistState) return;
    const { phase, vehicleId, bookingId } = checklistState;
    setChecklistState(null);

    if (phase === "pre" && bookingId) {
      const res = startAssignedBooking(bookingId, checklist);
      if (!res.ok) {
        toast.error(res.error ?? "Unable to start assigned trip.");
        return;
      }
      toast.success("Pre-trip walkaround passed. Live trip started!");
    } else if (phase === "post") {
      endActiveTripForVehicle(vehicleId, checklist);
      toast.success("Post-trip inspection saved. Trip completed!");
    }
  };

  const actions = {
    onOpenRequestTrip: () => setRequestOpen(true),
    onAssignBooking: (b: TripBooking) => setAssigningBooking(b),
    onStartBooking: handleStartBooking,
    onFinishTrip: handleFinishTrip,
  };

  return (
    <>
      {activeRole === "employee" ? (
        <EmployeeDashboard {...actions} />
      ) : activeRole === "driver" ? (
        <DriverDashboard {...actions} />
      ) : activeRole === "mechanic" ? (
        <MechanicDashboard />
      ) : activeRole === "dispatcher" ? (
        <DispatcherDashboard {...actions} />
      ) : (
        <ExecutiveDashboard
          mode={activeRole === "fleet_manager" ? "fleet_manager" : "super_admin"}
          {...actions}
        />
      )}

      <RequestTripDialog open={requestOpen} onOpenChange={setRequestOpen} />
      <AssignDriverDialog
        booking={assigningBooking}
        onClose={() => setAssigningBooking(null)}
      />
      <TripChecklistDialog
        open={checklistState !== null}
        phase={checklistState?.phase ?? "pre"}
        onOpenChange={(open) => {
          if (!open) setChecklistState(null);
        }}
        onConfirm={handleChecklistConfirm}
      />
    </>
  );
}
