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

  it("allows only one active or paused trip at a time", () => {
    const vehicles = useFleetStore.getState().vehicles;
    const first = useFleetStore
      .getState()
      .startTrip(vehicles[0].id, "Client delivery");
    expect(first.ok).toBe(true);

    const second = useFleetStore
      .getState()
      .startTrip(vehicles[1].id, "Airport pickup");
    expect(second.ok).toBe(false);
  });

  it("ignores points while paused and caps speed at 160 km/h", () => {
    const vehicle = useFleetStore.getState().vehicles[0];
    useFleetStore.getState().startTrip(vehicle.id, "Test route");

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

  it("blocks vehicle deletion during a trip and updates odometer on end", () => {
    const vehicle = useFleetStore.getState().vehicles[0];
    const startOdo = vehicle.odometerKm;

    useFleetStore.getState().startTrip(vehicle.id, "Odometer check");
    const blocked = useFleetStore.getState().removeVehicle(vehicle.id);
    expect(blocked.ok).toBe(false);

    const t0 = 1_700_000_000_000;
    useFleetStore.getState().addPoint(23.7925, 90.4078, t0);
    useFleetStore.getState().addPoint(23.796, 90.415, t0 + 60_000);
    useFleetStore.getState().endTrip();

    const updatedVehicle = useFleetStore
      .getState()
      .vehicles.find((v) => v.id === vehicle.id);
    expect(updatedVehicle).toBeDefined();
    expect(updatedVehicle!.odometerKm).toBeGreaterThan(startOdo);

    const allowed = useFleetStore.getState().removeVehicle(vehicle.id);
    expect(allowed.ok).toBe(true);
  });

  it("migrates v1 persisted fleet state to v2 cleanly", () => {
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

  it("seeds completed demo trips across multiple dates with GPS track points", () => {
    const { trips } = useFleetStore.getState();
    expect(trips.length).toBeGreaterThanOrEqual(10);
    const distinctDays = new Set(trips.map((t) => t.startedAt.slice(0, 10)));
    expect(distinctDays.size).toBeGreaterThanOrEqual(7);
    for (const trip of trips) {
      expect(trip.status).toBe("done");
      expect(trip.points.length).toBeGreaterThan(20);
      expect(trip.distanceKm).toBeGreaterThan(5);
    }
  });
});
