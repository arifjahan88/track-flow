"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Driver,
  FleetExportPayload,
  FuelLog,
  MaintenanceRecord,
  MaintenanceType,
  TrackPoint,
  Trip,
  Vehicle,
  VehicleType,
} from "@/types";
import { haversineKm, isUsefulPoint, SIM_ROUTE } from "@/lib/geo";

const MAX_SPEED_KMH = 160;

function daysFromNowIso(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function dateTimeFromNow(
  daysOffset: number,
  hourUtc: number,
  minuteUtc: number
): number {
  const base = new Date(Date.now() + daysOffset * 86_400_000);
  base.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return base.getTime();
}

function buildSeedTrackPoints(
  startIndex: number,
  endIndex: number,
  startMs: number,
  durationMinutes: number,
  reverse = false
): TrackPoint[] {
  const safeStart = Math.max(0, Math.min(SIM_ROUTE.length - 2, startIndex));
  const safeEnd = Math.max(
    safeStart + 1,
    Math.min(SIM_ROUTE.length - 1, endIndex)
  );
  const slice = SIM_ROUTE.slice(safeStart, safeEnd + 1);
  const ordered = reverse ? [...slice].reverse() : slice;

  // Sample ~45 points so storage stays compact while the route curve is smooth
  const step = Math.max(1, Math.floor(ordered.length / 45));
  const sampled = ordered.filter(
    (_, idx) => idx % step === 0 || idx === ordered.length - 1
  );

  const durationMs = durationMinutes * 60_000;
  return sampled.map((pt, idx) => ({
    lat: pt.lat,
    lng: pt.lng,
    t: Math.round(
      startMs + (idx / Math.max(1, sampled.length - 1)) * durationMs
    ),
  }));
}

export function createSeedTrips(): Trip[] {
  const specs: {
    id: string;
    vehicleId: string;
    driverId: string;
    purpose: string;
    daysOffset: number;
    hourUtc: number;
    minuteUtc: number;
    durationMinutes: number;
    distanceKm: number;
    maxSpeedKmh: number;
    startIndex: number;
    endIndex: number;
    reverse?: boolean;
  }[] = [
    {
      id: "trip-seed-1",
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      purpose: "Morning pharmaceutical distribution",
      daysOffset: 0,
      hourUtc: 2,
      minuteUtc: 15,
      durationMinutes: 27,
      distanceKm: 14.85,
      maxSpeedKmh: 58,
      startIndex: 0,
      endIndex: 360,
    },
    {
      id: "trip-seed-2",
      vehicleId: "veh-sedan-3390",
      driverId: "drv-nadia",
      purpose: "Executive airport transfer",
      daysOffset: -1,
      hourUtc: 11,
      minuteUtc: 10,
      durationMinutes: 38,
      distanceKm: 18.4,
      maxSpeedKmh: 64,
      startIndex: 0,
      endIndex: 360,
      reverse: true,
    },
    {
      id: "trip-seed-3",
      vehicleId: "veh-pickup-7781",
      driverId: "drv-rafiq",
      purpose: "Tejgaon warehouse hardware shuttle",
      daysOffset: -1,
      hourUtc: 4,
      minuteUtc: 20,
      durationMinutes: 31,
      distanceKm: 11.2,
      maxSpeedKmh: 52,
      startIndex: 60,
      endIndex: 310,
    },
    {
      id: "trip-seed-4",
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      purpose: "Retail store restock — Hatirjheel loop",
      daysOffset: -2,
      hourUtc: 8,
      minuteUtc: 30,
      durationMinutes: 36,
      distanceKm: 16.75,
      maxSpeedKmh: 55,
      startIndex: 20,
      endIndex: 360,
    },
    {
      id: "trip-seed-5",
      vehicleId: "veh-pickup-7781",
      driverId: "drv-rafiq",
      purpose: "Heavy equipment depot transfer",
      daysOffset: -3,
      hourUtc: 10,
      minuteUtc: 15,
      durationMinutes: 40,
      distanceKm: 15.3,
      maxSpeedKmh: 61,
      startIndex: 40,
      endIndex: 360,
      reverse: true,
    },
    {
      id: "trip-seed-6",
      vehicleId: "veh-sedan-3390",
      driverId: "drv-nadia",
      purpose: "Client headquarters briefing",
      daysOffset: -3,
      hourUtc: 3,
      minuteUtc: 5,
      durationMinutes: 29,
      distanceKm: 9.6,
      maxSpeedKmh: 48,
      startIndex: 0,
      endIndex: 240,
    },
    {
      id: "trip-seed-7",
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      purpose: "Cold-chain grocery dispatch",
      daysOffset: -4,
      hourUtc: 5,
      minuteUtc: 10,
      durationMinutes: 34,
      distanceKm: 13.9,
      maxSpeedKmh: 54,
      startIndex: 30,
      endIndex: 340,
    },
    {
      id: "trip-seed-8",
      vehicleId: "veh-pickup-7781",
      driverId: "drv-nadia",
      purpose: "Construction site supply drop",
      daysOffset: -5,
      hourUtc: 7,
      minuteUtc: 45,
      durationMinutes: 43,
      distanceKm: 19.15,
      maxSpeedKmh: 63,
      startIndex: 0,
      endIndex: 360,
    },
    {
      id: "trip-seed-9",
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      purpose: "Weekly regional hub replenishment",
      daysOffset: -7,
      hourUtc: 2,
      minuteUtc: 40,
      durationMinutes: 38,
      distanceKm: 17.25,
      maxSpeedKmh: 57,
      startIndex: 0,
      endIndex: 360,
      reverse: true,
    },
    {
      id: "trip-seed-10",
      vehicleId: "veh-sedan-3390",
      driverId: "drv-nadia",
      purpose: "Financial district courier run",
      daysOffset: -9,
      hourUtc: 9,
      minuteUtc: 20,
      durationMinutes: 32,
      distanceKm: 12.45,
      maxSpeedKmh: 51,
      startIndex: 50,
      endIndex: 330,
    },
    {
      id: "trip-seed-11",
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      purpose: "Central depot outbound freight",
      daysOffset: -11,
      hourUtc: 3,
      minuteUtc: 50,
      durationMinutes: 45,
      distanceKm: 21.6,
      maxSpeedKmh: 62,
      startIndex: 0,
      endIndex: 360,
    },
  ];

  return specs.map((spec) => {
    const startMs = dateTimeFromNow(
      spec.daysOffset,
      spec.hourUtc,
      spec.minuteUtc
    );
    const endMs = startMs + spec.durationMinutes * 60_000;
    return {
      id: spec.id,
      vehicleId: spec.vehicleId,
      driverId: spec.driverId,
      purpose: spec.purpose,
      status: "done",
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      distanceKm: spec.distanceKm,
      maxSpeedKmh: spec.maxSpeedKmh,
      points: buildSeedTrackPoints(
        spec.startIndex,
        spec.endIndex,
        startMs,
        spec.durationMinutes,
        spec.reverse
      ),
    };
  });
}

export function createSeedVehicles(): Vehicle[] {
  return [
    {
      id: "veh-van-2045",
      name: "Delivery Van",
      plate: "DHA-11-2045",
      type: "Van",
      odometerKm: 48250,
      createdAt: "2026-01-10T08:00:00.000Z",
    },
    {
      id: "veh-sedan-3390",
      name: "Office Sedan",
      plate: "DHA-12-3390",
      type: "Sedan",
      odometerKm: 29140,
      createdAt: "2026-02-05T09:30:00.000Z",
    },
    {
      id: "veh-pickup-7781",
      name: "Pickup",
      plate: "DHA-14-7781",
      type: "Pickup",
      odometerKm: 63890,
      createdAt: "2026-03-14T11:15:00.000Z",
    },
  ];
}

export function createSeedDrivers(): Driver[] {
  return [
    {
      id: "drv-rafiq",
      name: "Rafiq Hasan",
      phone: "+880 1711-234567",
      licenseNumber: "DL-DHK-904821",
      licenseExpiry: daysFromNowIso(240),
      assignedVehicleId: "veh-van-2045",
    },
    {
      id: "drv-nadia",
      name: "Nadia Karim",
      phone: "+880 1819-876543",
      licenseNumber: "DL-DHK-612304",
      licenseExpiry: daysFromNowIso(18),
      assignedVehicleId: "veh-sedan-3390",
    },
  ];
}

export function createSeedFuelLogs(): FuelLog[] {
  return [
    {
      id: "fuel-1",
      vehicleId: "veh-van-2045",
      date: daysFromNowIso(-24),
      liters: 42,
      pricePerLiter: 1.25,
      totalCost: 52.5,
      odometerKm: 47210,
      fullTank: true,
    },
    {
      id: "fuel-2",
      vehicleId: "veh-van-2045",
      date: daysFromNowIso(-12),
      liters: 44,
      pricePerLiter: 1.28,
      totalCost: 56.32,
      odometerKm: 47740,
      fullTank: true,
    },
    {
      id: "fuel-3",
      vehicleId: "veh-van-2045",
      date: daysFromNowIso(-3),
      liters: 40,
      pricePerLiter: 1.3,
      totalCost: 52.0,
      odometerKm: 48250,
      fullTank: true,
    },
  ];
}

export function createSeedMaintenance(): MaintenanceRecord[] {
  return [
    {
      id: "maint-1",
      vehicleId: "veh-van-2045",
      title: "Engine oil and filter change",
      type: "Oil change",
      scheduledDate: daysFromNowIso(6),
      dueOdometerKm: 48600,
      cost: 85,
    },
    {
      id: "maint-2",
      vehicleId: "veh-pickup-7781",
      title: "Brake pad inspection",
      type: "Brake inspection",
      scheduledDate: daysFromNowIso(-3),
      dueOdometerKm: 63800,
      cost: 120,
    },
    {
      id: "maint-3",
      vehicleId: "veh-sedan-3390",
      title: "Tire rotation and balance",
      type: "Tire service",
      scheduledDate: daysFromNowIso(45),
      dueOdometerKm: 32000,
      cost: 60,
    },
  ];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface FleetDataSnapshot {
  vehicles: Vehicle[];
  trips: Trip[];
  activeTripId: string | null;
  fuelLogs: FuelLog[];
  maintenanceRecords: MaintenanceRecord[];
  drivers: Driver[];
}

export interface FleetState extends FleetDataSnapshot {
  // Vehicles
  addVehicle: (input: {
    name: string;
    plate: string;
    type: VehicleType;
    odometerKm: number;
  }) => Vehicle;
  updateVehicle: (
    id: string,
    input: {
      name: string;
      plate: string;
      type: VehicleType;
      odometerKm: number;
    }
  ) => void;
  removeVehicle: (id: string) => ActionResult;

  // Trips
  startTrip: (
    vehicleId: string,
    purpose: string,
    driverId?: string
  ) => ActionResult;
  addPoint: (lat: number, lng: number, timestamp?: number) => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: () => void;

  // Fuel logs
  addFuelLog: (input: Omit<FuelLog, "id">) => FuelLog;
  updateFuelLog: (id: string, input: Omit<FuelLog, "id">) => void;
  removeFuelLog: (id: string) => void;

  // Maintenance
  addMaintenanceRecord: (
    input: Omit<MaintenanceRecord, "id">
  ) => MaintenanceRecord;
  updateMaintenanceRecord: (
    id: string,
    input: Omit<MaintenanceRecord, "id">
  ) => void;
  completeMaintenanceRecord: (
    id: string,
    completedDate: string,
    cost?: number
  ) => void;
  removeMaintenanceRecord: (id: string) => void;

  // Drivers
  addDriver: (input: Omit<Driver, "id">) => Driver;
  updateDriver: (id: string, input: Omit<Driver, "id">) => void;
  removeDriver: (id: string) => void;

  // Backup / reset
  importData: (payload: FleetExportPayload) => void;
  resetDemoData: () => void;
}

export function migrateFleetState(
  persistedState: unknown,
  version: number
): FleetDataSnapshot {
  const state = (persistedState ?? {}) as Partial<FleetDataSnapshot>;
  if (version < 2) {
    return {
      vehicles: Array.isArray(state.vehicles)
        ? state.vehicles
        : createSeedVehicles(),
      trips: Array.isArray(state.trips) ? state.trips : [],
      activeTripId:
        typeof state.activeTripId === "string" ? state.activeTripId : null,
      fuelLogs: Array.isArray(state.fuelLogs) ? state.fuelLogs : [],
      maintenanceRecords: Array.isArray(state.maintenanceRecords)
        ? state.maintenanceRecords
        : [],
      drivers: Array.isArray(state.drivers) ? state.drivers : [],
    };
  }
  const hasTrips = Array.isArray(state.trips) && state.trips.length > 0;
  return {
    vehicles: Array.isArray(state.vehicles)
      ? state.vehicles
      : createSeedVehicles(),
    trips: hasTrips ? (state.trips as Trip[]) : createSeedTrips(),
    activeTripId:
      typeof state.activeTripId === "string" ? state.activeTripId : null,
    fuelLogs: Array.isArray(state.fuelLogs)
      ? state.fuelLogs
      : createSeedFuelLogs(),
    maintenanceRecords: Array.isArray(state.maintenanceRecords)
      ? state.maintenanceRecords
      : createSeedMaintenance(),
    drivers: Array.isArray(state.drivers)
      ? state.drivers
      : createSeedDrivers(),
  };
}

function getInitialSnapshot(): FleetDataSnapshot {
  return {
    vehicles: createSeedVehicles(),
    trips: createSeedTrips(),
    activeTripId: null,
    fuelLogs: createSeedFuelLogs(),
    maintenanceRecords: createSeedMaintenance(),
    drivers: createSeedDrivers(),
  };
}

export const useFleetStore = create<FleetState>()(
  persist(
    (set, get) => ({
      ...getInitialSnapshot(),

      addVehicle: (input) => {
        const vehicle: Vehicle = {
          id: `veh-${crypto.randomUUID()}`,
          name: input.name.trim(),
          plate: input.plate.trim().toUpperCase(),
          type: input.type,
          odometerKm: Math.max(0, Number(input.odometerKm) || 0),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ vehicles: [vehicle, ...state.vehicles] }));
        return vehicle;
      },

      updateVehicle: (id, input) => {
        set((state) => ({
          vehicles: state.vehicles.map((v) =>
            v.id === id
              ? {
                  ...v,
                  name: input.name.trim(),
                  plate: input.plate.trim().toUpperCase(),
                  type: input.type,
                  odometerKm: Math.max(0, Number(input.odometerKm) || 0),
                }
              : v
          ),
        }));
      },

      removeVehicle: (id) => {
        const { trips, activeTripId } = get();
        const activeTrip = trips.find(
          (t) =>
            (t.id === activeTripId || t.status !== "done") &&
            t.vehicleId === id
        );
        if (activeTrip) {
          return {
            ok: false,
            error: "End the active trip before deleting this vehicle.",
          };
        }
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v.id !== id),
          fuelLogs: state.fuelLogs.filter((f) => f.vehicleId !== id),
          maintenanceRecords: state.maintenanceRecords.filter(
            (m) => m.vehicleId !== id
          ),
          drivers: state.drivers.map((d) =>
            d.assignedVehicleId === id
              ? { ...d, assignedVehicleId: undefined }
              : d
          ),
        }));
        return { ok: true };
      },

      startTrip: (vehicleId, purpose, driverId) => {
        const { activeTripId, trips, vehicles } = get();
        const hasOpenTrip =
          activeTripId !== null || trips.some((t) => t.status !== "done");
        if (hasOpenTrip) {
          return {
            ok: false,
            error: "Finish or end the current trip before starting another.",
          };
        }
        const vehicleExists = vehicles.some((v) => v.id === vehicleId);
        if (!vehicleExists) {
          return { ok: false, error: "Select a valid vehicle." };
        }
        const newTrip: Trip = {
          id: `trip-${crypto.randomUUID()}`,
          vehicleId,
          driverId: driverId || undefined,
          purpose: purpose.trim() || "General trip",
          status: "active",
          startedAt: new Date().toISOString(),
          distanceKm: 0,
          maxSpeedKmh: 0,
          points: [],
        };
        set((state) => ({
          trips: [newTrip, ...state.trips],
          activeTripId: newTrip.id,
        }));
        return { ok: true };
      },

      addPoint: (lat, lng, timestamp) => {
        const { activeTripId, trips } = get();
        if (!activeTripId) return;
        const activeTrip = trips.find((t) => t.id === activeTripId);
        if (!activeTrip || activeTrip.status !== "active") return;

        const now = timestamp ?? Date.now();
        const lastPoint = activeTrip.points[activeTrip.points.length - 1];
        const nextPoint = { lat, lng, t: now };

        if (!isUsefulPoint(lastPoint, nextPoint)) {
          return;
        }

        let addedKm = 0;
        let speedKmh = 0;

        if (lastPoint) {
          addedKm = haversineKm(lastPoint, nextPoint);
          const deltaHours = (now - lastPoint.t) / 3_600_000;
          if (deltaHours > 0) {
            speedKmh = Math.min(MAX_SPEED_KMH, addedKm / deltaHours);
          }
        }

        const updatedTrip: Trip = {
          ...activeTrip,
          distanceKm: Number((activeTrip.distanceKm + addedKm).toFixed(4)),
          maxSpeedKmh: Math.max(
            activeTrip.maxSpeedKmh,
            Number(speedKmh.toFixed(1))
          ),
          points: [...activeTrip.points, nextPoint],
        };

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId ? updatedTrip : t
          ),
        }));
      },

      pauseTrip: () => {
        const { activeTripId } = get();
        if (!activeTripId) return;
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId && t.status === "active"
              ? { ...t, status: "paused" }
              : t
          ),
        }));
      },

      resumeTrip: () => {
        const { activeTripId } = get();
        if (!activeTripId) return;
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId && t.status === "paused"
              ? { ...t, status: "active" }
              : t
          ),
        }));
      },

      endTrip: () => {
        const { activeTripId, trips } = get();
        if (!activeTripId) return;
        const activeTrip = trips.find((t) => t.id === activeTripId);
        if (!activeTrip) {
          set({ activeTripId: null });
          return;
        }
        const endedAt = new Date().toISOString();
        set((state) => ({
          activeTripId: null,
          trips: state.trips.map((t) =>
            t.id === activeTripId ? { ...t, status: "done", endedAt } : t
          ),
          vehicles: state.vehicles.map((v) =>
            v.id === activeTrip.vehicleId
              ? {
                  ...v,
                  odometerKm: Number(
                    (v.odometerKm + activeTrip.distanceKm).toFixed(2)
                  ),
                }
              : v
          ),
        }));
      },

      addFuelLog: (input) => {
        const log: FuelLog = {
          ...input,
          id: `fuel-${crypto.randomUUID()}`,
          totalCost: Number((input.liters * input.pricePerLiter).toFixed(2)),
        };
        set((state) => ({ fuelLogs: [log, ...state.fuelLogs] }));
        return log;
      },

      updateFuelLog: (id, input) => {
        set((state) => ({
          fuelLogs: state.fuelLogs.map((log) =>
            log.id === id
              ? {
                  ...input,
                  id,
                  totalCost: Number(
                    (input.liters * input.pricePerLiter).toFixed(2)
                  ),
                }
              : log
          ),
        }));
      },

      removeFuelLog: (id) => {
        set((state) => ({
          fuelLogs: state.fuelLogs.filter((log) => log.id !== id),
        }));
      },

      addMaintenanceRecord: (input) => {
        const record: MaintenanceRecord = {
          ...input,
          id: `maint-${crypto.randomUUID()}`,
          title: input.title.trim(),
          type: input.type as MaintenanceType,
        };
        set((state) => ({
          maintenanceRecords: [record, ...state.maintenanceRecords],
        }));
        return record;
      },

      updateMaintenanceRecord: (id, input) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.map((rec) =>
            rec.id === id
              ? { ...input, id, title: input.title.trim() }
              : rec
          ),
        }));
      },

      completeMaintenanceRecord: (id, completedDate, cost) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.map((rec) =>
            rec.id === id
              ? {
                  ...rec,
                  completedDate,
                  cost: typeof cost === "number" ? cost : rec.cost,
                }
              : rec
          ),
        }));
      },

      removeMaintenanceRecord: (id) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.filter(
            (rec) => rec.id !== id
          ),
        }));
      },

      addDriver: (input) => {
        const driver: Driver = {
          ...input,
          id: `drv-${crypto.randomUUID()}`,
          name: input.name.trim(),
          phone: input.phone.trim(),
          licenseNumber: input.licenseNumber.trim().toUpperCase(),
        };
        set((state) => ({ drivers: [driver, ...state.drivers] }));
        return driver;
      },

      updateDriver: (id, input) => {
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === id
              ? {
                  ...input,
                  id,
                  name: input.name.trim(),
                  phone: input.phone.trim(),
                  licenseNumber: input.licenseNumber.trim().toUpperCase(),
                }
              : d
          ),
        }));
      },

      removeDriver: (id) => {
        set((state) => ({
          drivers: state.drivers.filter((d) => d.id !== id),
        }));
      },

      importData: (payload) => {
        const openTrip = payload.trips.find((t) => t.status !== "done");
        set({
          vehicles: payload.vehicles,
          trips: payload.trips,
          activeTripId: openTrip?.id ?? null,
          fuelLogs: payload.fuelLogs ?? [],
          maintenanceRecords: payload.maintenanceRecords ?? [],
          drivers: payload.drivers ?? [],
        });
      },

      resetDemoData: () => {
        set(getInitialSnapshot());
      },
    }),
    {
      name: "tf-fleet",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) =>
        migrateFleetState(persistedState, version),
    }
  )
);
