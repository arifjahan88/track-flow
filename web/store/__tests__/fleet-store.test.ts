import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateFleetState, useFleetStore } from "@/store/fleet-store";

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
});
