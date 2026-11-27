import type {
  Driver,
  FleetAlert,
  FuelLog,
  IncidentReport,
  OperatingExpense,
  Trip,
  TripBooking,
  User,
  Vehicle,
} from "@/types";

export function resolveUserDriverId(
  user: User | undefined,
  drivers: readonly Driver[]
): string | undefined {
  if (!user || user.role !== "driver") return undefined;
  if (user.driverId && drivers.some((d) => d.id === user.driverId)) {
    return user.driverId;
  }
  const byName = drivers.find(
    (d) => d.name.toLowerCase() === user.name.toLowerCase()
  );
  return byName?.id ?? drivers[0]?.id;
}

export function getScopedBookings(
  user: User | undefined,
  drivers: readonly Driver[],
  bookings: readonly TripBooking[]
): TripBooking[] {
  if (!user) return [];
  if (user.role === "employee") {
    return bookings.filter(
      (b) =>
        b.requesterUserId === user.id ||
        b.requesterName.toLowerCase() === user.name.toLowerCase()
    );
  }
  if (user.role === "driver") {
    const driverId = resolveUserDriverId(user, drivers);
    return bookings.filter(
      (b) =>
        (driverId && b.driverId === driverId) ||
        b.requesterUserId === user.id ||
        b.requesterName.toLowerCase() === user.name.toLowerCase()
    );
  }
  if (user.role === "mechanic") {
    return [];
  }
  return [...bookings];
}

export function getScopedVehicleIds(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[]
): Set<string> {
  if (!user) return new Set();

  if (user.role === "employee") {
    const myBookings = getScopedBookings(user, drivers, bookings);
    const ids = new Set<string>();
    for (const b of myBookings) {
      if (
        b.vehicleId &&
        (b.status === "assigned" || b.status === "in_progress")
      ) {
        ids.add(b.vehicleId);
      }
    }
    return ids;
  }

  if (user.role === "driver") {
    const driverId = resolveUserDriverId(user, drivers);
    const ids = new Set<string>();
    if (user.assignedVehicleId) ids.add(user.assignedVehicleId);
    const driverObj = drivers.find((d) => d.id === driverId);
    if (driverObj?.assignedVehicleId) ids.add(driverObj.assignedVehicleId);
    for (const b of bookings) {
      if (driverId && b.driverId === driverId && b.vehicleId) {
        ids.add(b.vehicleId);
      }
    }
    for (const t of trips) {
      if (driverId && t.driverId === driverId) {
        ids.add(t.vehicleId);
      }
    }
    return ids;
  }

  return new Set(vehicles.map((v) => v.id));
}

export function getScopedVehicles(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[]
): Vehicle[] {
  const allowed = getScopedVehicleIds(user, drivers, vehicles, bookings, trips);
  return vehicles.filter((v) => allowed.has(v.id));
}

export function getScopedTrips(
  user: User | undefined,
  drivers: readonly Driver[],
  trips: readonly Trip[],
  bookings: readonly TripBooking[]
): Trip[] {
  if (!user) return [];

  if (user.role === "employee") {
    const myBookings = getScopedBookings(user, drivers, bookings);
    const myBookingIds = new Set(myBookings.map((b) => b.id));
    const myTripIds = new Set(
      myBookings.map((b) => b.tripId).filter(Boolean) as string[]
    );
    return trips.filter(
      (t) =>
        myTripIds.has(t.id) ||
        (t.bookingId ? myBookingIds.has(t.bookingId) : false)
    );
  }

  if (user.role === "driver") {
    const driverId = resolveUserDriverId(user, drivers);
    const myBookingIds = new Set(
      bookings
        .filter((b) => driverId && b.driverId === driverId)
        .map((b) => b.id)
    );
    return trips.filter(
      (t) =>
        (driverId && t.driverId === driverId) ||
        (t.bookingId ? myBookingIds.has(t.bookingId) : false)
    );
  }

  return [...trips];
}

export function getScopedFuelLogs(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[],
  fuelLogs: readonly FuelLog[]
): FuelLog[] {
  if (!user || user.role === "employee") return [];
  if (user.role === "driver") {
    const allowed = getScopedVehicleIds(
      user,
      drivers,
      vehicles,
      bookings,
      trips
    );
    return fuelLogs.filter((l) => allowed.has(l.vehicleId));
  }
  return [...fuelLogs];
}

export function getScopedExpenses(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[],
  expenses: readonly OperatingExpense[]
): OperatingExpense[] {
  if (!user || user.role === "employee") return [];
  if (user.role === "driver") {
    const allowed = getScopedVehicleIds(
      user,
      drivers,
      vehicles,
      bookings,
      trips
    );
    return expenses.filter((e) => allowed.has(e.vehicleId));
  }
  return [...expenses];
}

export function getScopedIncidents(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[],
  incidents: readonly IncidentReport[]
): IncidentReport[] {
  if (!user || user.role === "employee") return [];
  if (user.role === "driver") {
    const driverId = resolveUserDriverId(user, drivers);
    const allowed = getScopedVehicleIds(
      user,
      drivers,
      vehicles,
      bookings,
      trips
    );
    return incidents.filter(
      (inc) =>
        (driverId && inc.driverId === driverId) || allowed.has(inc.vehicleId)
    );
  }
  return [...incidents];
}

export function getScopedAlerts(
  user: User | undefined,
  drivers: readonly Driver[],
  vehicles: readonly Vehicle[],
  bookings: readonly TripBooking[],
  trips: readonly Trip[],
  alerts: readonly FleetAlert[]
): FleetAlert[] {
  if (!user) return [];

  if (user.role === "employee") {
    const myBookings = getScopedBookings(user, drivers, bookings);
    const myVehIds = getScopedVehicleIds(
      user,
      drivers,
      vehicles,
      bookings,
      trips
    );
    const userLower = user.name.toLowerCase();
    const purposes = myBookings.map((b) => b.purpose.toLowerCase());
    return alerts.filter((a) => {
      const hay = `${a.title} ${a.message}`.toLowerCase();
      if (hay.includes(userLower)) return true;
      if (purposes.some((p) => p.length > 4 && hay.includes(p))) return true;
      if (
        a.vehicleId &&
        myVehIds.has(a.vehicleId) &&
        (hay.includes("trip") ||
          hay.includes("assigned") ||
          hay.includes("completed"))
      ) {
        return true;
      }
      return false;
    });
  }

  if (user.role === "driver") {
    const myVehIds = getScopedVehicleIds(
      user,
      drivers,
      vehicles,
      bookings,
      trips
    );
    const driverId = resolveUserDriverId(user, drivers);
    const driverName = (
      drivers.find((d) => d.id === driverId)?.name ?? user.name
    ).toLowerCase();
    return alerts.filter((a) => {
      const hay = `${a.title} ${a.message}`.toLowerCase();
      if (hay.includes(driverName)) return true;
      if (a.vehicleId && myVehIds.has(a.vehicleId)) return true;
      return false;
    });
  }

  if (user.role === "mechanic") {
    return alerts.filter((a) => {
      const hay = `${a.title} ${a.message}`.toLowerCase();
      return (
        hay.includes("service") ||
        hay.includes("maintenance") ||
        hay.includes("work order") ||
        hay.includes("incident") ||
        hay.includes("sos") ||
        hay.includes("brake") ||
        a.severity === "critical"
      );
    });
  }

  return [...alerts];
}
