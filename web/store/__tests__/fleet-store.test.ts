import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateFleetState, useFleetStore } from "@/store/fleet-store";
import { SEED_USERS } from "@/store/auth-store";
import { can, canAccessRoute } from "@/lib/rbac";
import {
  getScopedAlerts,
  getScopedBookings,
  getScopedFuelLogs,
  getScopedTrips,
  getScopedVehicles,
} from "@/lib/rbac-scope";

describe("fleet store rules", () => {
  beforeAll(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  beforeEach(() => {
    useFleetStore.getState().resetDemoData();
  });

  it("supports multi-vehicle simultaneous tracking while blocking duplicate trips on the same vehicle", () => {
    const { vehicles } = useFleetStore.getState();
    const liveVehicles = vehicles.filter((v) => v.status === "on_trip");
    expect(liveVehicles.length).toBeGreaterThanOrEqual(3);

    // Already on_trip vehicle cannot start a duplicate trip
    const dup = useFleetStore
      .getState()
      .startTrip(liveVehicles[0].id, "Duplicate dispatch");
    expect(dup.ok).toBe(false);

    // Standby vehicle can start a simultaneous trip
    const standby = vehicles.find((v) => v.status === "available");
    expect(standby).toBeDefined();
    const started = useFleetStore
      .getState()
      .startTrip(standby!.id, "Simultaneous corridor run");
    expect(started.ok).toBe(true);
  });

  it("applies live simulation ticks to odometer, fuel, and active trip trails", () => {
    const vehicle = useFleetStore
      .getState()
      .vehicles.find((v) => v.status === "on_trip")!;
    const startOdo = vehicle.odometerKm;
    const startFuel = vehicle.fuelLevelPercent ?? 75;

    useFleetStore.getState().applySimulationTick([
      {
        vehicleId: vehicle.id,
        routeProgress: 0.25,
        latitude: 37.781,
        longitude: -122.421,
        speed: 72.5,
        heading: 84,
        deltaDistanceKm: 1.4,
        deltaFuelPercent: 0.5,
        timestamp: 1_763_886_600_000,
      },
    ]);

    const updated = useFleetStore
      .getState()
      .vehicles.find((v) => v.id === vehicle.id)!;
    expect(updated.odometerKm).toBeGreaterThan(startOdo);
    expect(updated.fuelLevelPercent!).toBeLessThan(startFuel);
    expect(updated.routeProgress).toBe(0.25);
  });

  it("ignores points while paused and caps speed at 160 km/h", () => {
    const standby = useFleetStore
      .getState()
      .vehicles.find((v) => v.status === "available")!;
    useFleetStore.getState().startTrip(standby.id, "Test route");

    const t0 = 1_700_000_000_000;
    useFleetStore.getState().addPoint(23.7925, 90.4078, t0);
    // Unrealistic jump in 1 second -> should cap at 160 km/h
    useFleetStore.getState().addPoint(23.8025, 90.4078, t0 + 1000);

    let active = useFleetStore.getState().trips[0];
    expect(active.points).toHaveLength(2);
    expect(active.maxSpeedKmh).toBe(160);

    useFleetStore.getState().pauseTrip();
    useFleetStore.getState().addPoint(23.8125, 90.4078, t0 + 2000);
    active = useFleetStore.getState().trips[0];
    expect(active.points).toHaveLength(2);
  });

  it("blocks vehicle deletion during a trip and allows deletion once ended", () => {
    const standby = useFleetStore
      .getState()
      .vehicles.find((v) => v.status === "available")!;
    const startOdo = standby.odometerKm;

    useFleetStore.getState().startTrip(standby.id, "Odometer check");
    const blocked = useFleetStore.getState().removeVehicle(standby.id);
    expect(blocked.ok).toBe(false);

    const t0 = 1_700_000_000_000;
    useFleetStore.getState().addPoint(23.7925, 90.4078, t0);
    useFleetStore.getState().addPoint(23.796, 90.415, t0 + 60_000);
    useFleetStore.getState().endTrip();

    const updatedVehicle = useFleetStore
      .getState()
      .vehicles.find((v) => v.id === standby.id);
    expect(updatedVehicle).toBeDefined();
    expect(updatedVehicle!.odometerKm).toBeGreaterThan(startOdo);

    const allowed = useFleetStore.getState().removeVehicle(standby.id);
    expect(allowed.ok).toBe(true);
  });

  it("migrates v1 persisted fleet state cleanly", () => {
    const migrated = migrateFleetState(
      {
        vehicles: [],
        trips: [],
        activeTripId: null,
      },
      1
    );
    expect(migrated.fuelLogs).toEqual([]);
    expect(migrated.maintenanceRecords).toEqual([]);
    expect(migrated.drivers).toEqual([]);
  });

  it("seeds both live ongoing trips and completed demo trips across multiple dates", () => {
    const { trips } = useFleetStore.getState();
    const ongoing = trips.filter((t) => t.status === "active");
    const done = trips.filter((t) => t.status === "done");
    expect(ongoing.length).toBeGreaterThanOrEqual(3);
    expect(done.length).toBeGreaterThanOrEqual(8);

    const distinctDays = new Set(done.map((t) => t.startedAt.slice(0, 10)));
    expect(distinctDays.size).toBeGreaterThanOrEqual(7);
    for (const trip of done) {
      expect(trip.points.length).toBeGreaterThan(20);
      expect(trip.distanceKm).toBeGreaterThan(5);
    }
  });

  it("executes the full User Request -> Admin Assign Driver -> Driver Start -> Driver Finish lifecycle", () => {
    const store = useFleetStore.getState();

    // 1. User submits a trip request (no driver/vehicle yet)
    const created = store.addBooking({
      requesterUserId: "user-employee",
      requesterName: "Nadia Karim",
      department: "Supply Chain",
      purpose: "Urgent Airport Customs Handover",
      pickupLocation: "Central HQ",
      dropoffLocation: "Airport Cargo Gate 4",
      requestedDate: "2026-11-26", // Thursday (weekday shift)
      requestedTime: "10:00",
      passengerCount: 1,
      estimatedKm: 28,
    });
    expect(created.status).toBe("pending");
    expect(created.driverId).toBeUndefined();
    expect(created.vehicleId).toBeUndefined();

    // Admin alert is generated
    expect(useFleetStore.getState().alerts[0]?.title).toContain(
      "New Trip Request"
    );

    // 2. Admin attempts to assign maintenance-locked vehicle -> blocked
    const maintVeh = useFleetStore
      .getState()
      .vehicles.find((v) => v.status === "under_maintenance")!;
    const blockedMaint = useFleetStore.getState().assignBooking(created.id, {
      vehicleId: maintVeh.id,
      driverId: "drv-4",
    });
    expect(blockedMaint.ok).toBe(false);

    // 3. Admin assigns available driver (drv-4 Priya Nair) + available vehicle (veh-4)
    const availVeh = useFleetStore
      .getState()
      .vehicles.find((v) => v.status === "available")!;
    const assigned = useFleetStore.getState().assignBooking(created.id, {
      vehicleId: availVeh.id,
      driverId: "drv-4",
      notes: "Call Nadia at pickup gate",
    });
    expect(assigned.ok).toBe(true);
    const afterAssign = useFleetStore
      .getState()
      .bookings.find((b) => b.id === created.id)!;
    expect(afterAssign.status).toBe("assigned");
    expect(afterAssign.driverId).toBe("drv-4");
    expect(afterAssign.vehicleId).toBe(availVeh.id);

    // 4. Driver completes Pre-Trip Checklist & starts the assigned booking
    const preCheck = {
      phase: "pre" as const,
      completedAt: new Date().toISOString(),
      tiresOk: true,
      lightsOk: true,
      brakesOk: true,
      fluidsOk: true,
      bodyOk: true,
      damagePhotos: [],
    };
    const started = useFleetStore
      .getState()
      .startAssignedBooking(created.id, preCheck);
    expect(started.ok).toBe(true);

    const afterStartBooking = useFleetStore
      .getState()
      .bookings.find((b) => b.id === created.id)!;
    expect(afterStartBooking.status).toBe("in_progress");
    expect(afterStartBooking.tripId).toBeDefined();

    const linkedTrip = useFleetStore
      .getState()
      .trips.find((t) => t.id === afterStartBooking.tripId)!;
    expect(linkedTrip.bookingId).toBe(created.id);
    expect(linkedTrip.driverId).toBe("drv-4");
    expect(linkedTrip.preTripChecklist?.phase).toBe("pre");

    const onTripVeh = useFleetStore
      .getState()
      .vehicles.find((v) => v.id === availVeh.id)!;
    expect(onTripVeh.status).toBe("on_trip");

    // 5. Driver completes Post-Trip Checklist & finishes the trip
    const postCheck = {
      phase: "post" as const,
      completedAt: new Date().toISOString(),
      tiresOk: true,
      lightsOk: true,
      brakesOk: true,
      fluidsOk: true,
      bodyOk: true,
      damagePhotos: [],
    };
    useFleetStore.getState().endActiveTripForVehicle(availVeh.id, postCheck);

    const finishedBooking = useFleetStore
      .getState()
      .bookings.find((b) => b.id === created.id)!;
    expect(finishedBooking.status).toBe("completed");
    expect(finishedBooking.completedAt).toBeDefined();

    const finishedTrip = useFleetStore
      .getState()
      .trips.find((t) => t.id === linkedTrip.id)!;
    expect(finishedTrip.status).toBe("done");
    expect(finishedTrip.postTripChecklist?.phase).toBe("post");

    const returnedVeh = useFleetStore
      .getState()
      .vehicles.find((v) => v.id === availVeh.id)!;
    expect(returnedVeh.status).toBe("available");
  });

  it("enforces role-wise permissions and route scoping for employee and admin roles", () => {
    expect(can("employee", "bookings:request")).toBe(true);
    expect(can("employee", "dispatch:approve")).toBe(false);
    expect(can("employee", "vehicles:write")).toBe(false);
    expect(canAccessRoute("employee", "/dashboard")).toBe(true);
    expect(canAccessRoute("employee", "/trips")).toBe(true);
    expect(canAccessRoute("employee", "/vehicles")).toBe(false);
    expect(can("dispatcher", "dispatch:approve")).toBe(true);
    expect(can("super_admin", "admin:rbac")).toBe(true);
  });

  it("strictly scopes trips, bookings, vehicles, fuel, and alerts for drivers and employees", () => {
    const state = useFleetStore.getState();
    const driverUser = SEED_USERS.find((u) => u.role === "driver")!;
    const employeeUser = SEED_USERS.find((u) => u.role === "employee")!;
    const adminUser = SEED_USERS.find((u) => u.role === "super_admin")!;

    // Driver (Marcus Vance -> drv-1) ONLY sees bookings assigned to drv-1 (never unassigned pending admin queue)
    const driverBookings = getScopedBookings(
      driverUser,
      state.drivers,
      state.bookings
    );
    expect(driverBookings.length).toBeGreaterThan(0);
    expect(driverBookings.every((b) => b.driverId === "drv-1")).toBe(true);
    expect(driverBookings.some((b) => b.status === "pending")).toBe(false);

    // Driver ONLY sees trips driven by drv-1 (never drv-2 or drv-3)
    const driverTrips = getScopedTrips(
      driverUser,
      state.drivers,
      state.trips,
      state.bookings
    );
    expect(driverTrips.length).toBeGreaterThan(0);
    expect(driverTrips.every((t) => t.driverId === "drv-1")).toBe(true);

    // Driver ONLY sees vehicles tied to drv-1 (veh-1 assigned + veh-4 on assigned booking), never veh-5
    const driverVehicles = getScopedVehicles(
      driverUser,
      state.drivers,
      state.vehicles,
      state.bookings,
      state.trips
    );
    expect(driverVehicles.some((v) => v.id === "veh-1")).toBe(true);
    expect(driverVehicles.some((v) => v.id === "veh-5")).toBe(false);

    // Driver fuel logs ONLY belong to drv-1's scoped vehicles
    const driverFuel = getScopedFuelLogs(
      driverUser,
      state.drivers,
      state.vehicles,
      state.bookings,
      state.trips,
      state.fuelLogs
    );
    const driverVehIds = new Set(driverVehicles.map((v) => v.id));
    expect(driverFuel.every((f) => driverVehIds.has(f.vehicleId))).toBe(true);

    // Employee (Nadia Karim) ONLY sees her own requests, NEVER sees fleet fuel logs or unrelated low-fuel alerts
    const empBookings = getScopedBookings(
      employeeUser,
      state.drivers,
      state.bookings
    );
    expect(empBookings.every((b) => b.requesterUserId === employeeUser.id)).toBe(
      true
    );
    expect(
      getScopedFuelLogs(
        employeeUser,
        state.drivers,
        state.vehicles,
        state.bookings,
        state.trips,
        state.fuelLogs
      )
    ).toEqual([]);
    const empAlerts = getScopedAlerts(
      employeeUser,
      state.drivers,
      state.vehicles,
      state.bookings,
      state.trips,
      state.alerts
    );
    expect(empAlerts.some((a) => a.title.includes("Low Fuel"))).toBe(false);

    // Super Admin still sees the entire fleet
    expect(
      getScopedVehicles(
        adminUser,
        state.drivers,
        state.vehicles,
        state.bookings,
        state.trips
      ).length
    ).toBe(state.vehicles.length);
  });
});
