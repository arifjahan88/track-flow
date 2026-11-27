"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AuditLogEntry,
  ComplianceDocument,
  Driver,
  DriverLeave,
  DriverShift,
  FleetAlert,
  FleetExportPayload,
  FuelLog,
  GeofenceAlert,
  GeofenceZone,
  IncidentReport,
  IncidentStatus,
  MaintenanceRecord,
  MaintenanceType,
  OperatingExpense,
  SimulationTickUpdate,
  TrackPoint,
  Trip,
  TripBooking,
  TripChecklist,
  TripWaypoint,
  UserRole,
  VectorGeofence,
  Vehicle,
  VehicleLifecycleStatus,
  WorkOrder,
  WorkOrderStatus,
} from "@/types";
import { haversineKm, isUsefulPoint } from "@/lib/geo";
import { evaluateGeofenceTransitions } from "@/lib/geofence";
import { checkDriverAvailability } from "@/lib/drivers";
import { getRouteById } from "@/lib/city-routes";
import { interpolateRoutePosition } from "@/lib/geo-sim";
import {
  createSeedAlerts,
  createSeedAuditLogs,
  createSeedBookings,
  createSeedComplianceDocs,
  createSeedDrivers,
  createSeedExpenses,
  createSeedFuelLogs,
  createSeedGeofences,
  createSeedIncidents,
  createSeedMaintenance,
  createSeedTrips,
  createSeedVectorGeofences,
  createSeedVehicles,
  createSeedWorkOrders,
} from "@/lib/seed-data";
import { useAuthStore } from "@/store/auth-store";

export {
  createSeedAlerts,
  createSeedAuditLogs,
  createSeedBookings,
  createSeedComplianceDocs,
  createSeedDrivers,
  createSeedExpenses,
  createSeedFuelLogs,
  createSeedGeofences,
  createSeedIncidents,
  createSeedMaintenance,
  createSeedTrips,
  createSeedVectorGeofences,
  createSeedVehicles,
  createSeedWorkOrders,
};

const MAX_SPEED_KMH = 160;

function getCurrentActor(): {
  actorId: string;
  actorName: string;
  actorRole: UserRole;
} {
  try {
    const auth = useAuthStore.getState();
    const user = auth.users.find((u) => u.id === auth.currentUserId);
    if (user) {
      return {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
      };
    }
  } catch {
    // fallback in tests
  }
  return {
    actorId: "system",
    actorName: "System",
    actorRole: "super_admin",
  };
}

function makeAudit(
  action: string,
  entityType: AuditLogEntry["entityType"],
  summary: string,
  entityId?: string
): AuditLogEntry {
  const actor = getCurrentActor();
  return {
    id: `audit-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    ...actor,
    action,
    entityType,
    entityId,
    summary,
  };
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
  complianceDocs: ComplianceDocument[];
  bookings: TripBooking[];
  geofences: GeofenceZone[];
  geofenceAlerts: GeofenceAlert[];
  vectorGeofences: VectorGeofence[];
  alerts: FleetAlert[];
  selectedVehicleId: string;
  isSimulating: boolean;
  simSpeedMultiplier: 1 | 2 | 4;
  expenses: OperatingExpense[];
  workOrders: WorkOrder[];
  incidents: IncidentReport[];
  auditLogs: AuditLogEntry[];
}

export interface VehicleInput {
  name: string;
  plate: string;
  type: Vehicle["type"];
  odometerKm: number;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: Vehicle["fuelType"];
  engineCapacityCc?: number;
  tankCapacityLiters?: number;
  engineHours?: number;
  status?: VehicleLifecycleStatus;
  purchaseCost?: number;
  monthlyDepreciation?: number;
}

export interface FleetState extends FleetDataSnapshot {
  // Vehicles & Lifecycle
  addVehicle: (input: VehicleInput) => Vehicle;
  updateVehicle: (id: string, input: VehicleInput) => void;
  setVehicleStatus: (id: string, status: VehicleLifecycleStatus) => void;
  removeVehicle: (id: string) => ActionResult;

  // Compliance Vault
  addComplianceDoc: (
    input: Omit<ComplianceDocument, "id">
  ) => ComplianceDocument;
  removeComplianceDoc: (id: string) => void;

  // Trips, Checklists, Waypoints & POD
  startTrip: (
    vehicleId: string,
    purpose: string,
    driverId?: string,
    options?: {
      bookingId?: string;
      preTripChecklist?: TripChecklist;
      waypoints?: TripWaypoint[];
    }
  ) => ActionResult;
  addPoint: (lat: number, lng: number, timestamp?: number) => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: (postTripChecklist?: TripChecklist) => void;
  addActiveTripWaypoint: (
    waypoint: Omit<TripWaypoint, "id">
  ) => void;
  completeWaypointPod: (
    waypointId: string,
    pod: {
      recipientName: string;
      podSignatureDataUrl?: string;
      podPhotoDataUrl?: string;
    }
  ) => void;

  // Trip Bookings & Approvals
  addBooking: (
    input: Omit<TripBooking, "id" | "status" | "createdAt">
  ) => TripBooking;
  assignBooking: (
    id: string,
    assignment: {
      vehicleId: string;
      driverId: string;
      notes?: string;
      allowQueuedDriver?: boolean;
    }
  ) => ActionResult;
  rejectBooking: (id: string, reason?: string) => void;
  startAssignedBooking: (
    bookingId: string,
    preTripChecklist?: TripChecklist
  ) => ActionResult;
  rateCompletedBooking: (
    bookingId: string,
    rating: number,
    feedback?: string
  ) => void;
  updateBookingStatus: (
    id: string,
    status: TripBooking["status"],
    updates?: {
      vehicleId?: string;
      driverId?: string;
      approvedBy?: string;
      assignedBy?: string;
      rejectionReason?: string;
    }
  ) => void;
  removeBooking: (id: string) => void;

  // Geofencing
  addGeofence: (input: Omit<GeofenceZone, "id">) => GeofenceZone;
  toggleGeofence: (id: string) => void;
  removeGeofence: (id: string) => void;
  clearGeofenceAlerts: () => void;

  // Fuel & Operating Expenses
  addFuelLog: (input: Omit<FuelLog, "id">) => FuelLog;
  updateFuelLog: (id: string, input: Omit<FuelLog, "id">) => void;
  removeFuelLog: (id: string) => void;
  addExpense: (input: Omit<OperatingExpense, "id">) => OperatingExpense;
  removeExpense: (id: string) => void;

  // Maintenance, Work Orders & Incidents
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
  addWorkOrder: (input: Omit<WorkOrder, "id">) => WorkOrder;
  updateWorkOrderStatus: (
    id: string,
    status: WorkOrderStatus,
    completedAt?: string
  ) => void;
  removeWorkOrder: (id: string) => void;
  addIncident: (input: Omit<IncidentReport, "id">) => IncidentReport;
  updateIncidentStatus: (id: string, status: IncidentStatus) => void;
  removeIncident: (id: string) => void;

  // Drivers, Shifts & Leave
  addDriver: (input: Omit<Driver, "id">) => Driver;
  updateDriver: (id: string, input: Omit<Driver, "id">) => void;
  removeDriver: (id: string) => void;
  addDriverShift: (driverId: string, shift: Omit<DriverShift, "id">) => void;
  removeDriverShift: (driverId: string, shiftId: string) => void;
  addDriverLeave: (driverId: string, leave: Omit<DriverLeave, "id">) => void;
  removeDriverLeave: (driverId: string, leaveId: string) => void;

  // Live Tracking & Alerts
  setSelectedVehicle: (vehicleId: string) => void;
  setIsSimulating: (simulating: boolean) => void;
  setSimSpeedMultiplier: (speed: 1 | 2 | 4) => void;
  startTripForVehicle: (
    vehicleId: string,
    routeId?: string,
    purpose?: string,
    options?: {
      bookingId?: string;
      driverId?: string;
      preTripChecklist?: TripChecklist;
      waypoints?: TripWaypoint[];
    }
  ) => ActionResult;
  endActiveTripForVehicle: (
    vehicleId: string,
    postTripChecklist?: TripChecklist
  ) => void;
  applySimulationTick: (updates: SimulationTickUpdate[]) => void;
  toggleVectorGeofence: (id: string) => void;
  addFleetAlert: (alert: Omit<FleetAlert, "id" | "read">) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;

  // Audit
  logAudit: (
    action: string,
    entityType: AuditLogEntry["entityType"],
    summary: string,
    entityId?: string
  ) => void;

  // Backup / reset
  importData: (payload: FleetExportPayload) => void;
  resetDemoData: () => void;
}

function normalizeLegacyBookings(rawBookings: unknown): TripBooking[] {
  if (!Array.isArray(rawBookings)) return createSeedBookings();
  return (rawBookings as Array<Record<string, unknown>>).map((raw) => {
    const rawStatus = String(raw.status ?? "pending");
    const status: TripBooking["status"] =
      rawStatus === "approved"
        ? "assigned"
        : rawStatus === "dispatched"
          ? "in_progress"
          : rawStatus === "assigned" ||
              rawStatus === "in_progress" ||
              rawStatus === "completed" ||
              rawStatus === "rejected"
            ? (rawStatus as TripBooking["status"])
            : "pending";
    return {
      ...(raw as unknown as TripBooking),
      status,
      pickupLocation:
        typeof raw.pickupLocation === "string"
          ? raw.pickupLocation
          : "Central Logistics Hub",
      dropoffLocation:
        typeof raw.dropoffLocation === "string"
          ? raw.dropoffLocation
          : String(raw.purpose ?? "Destination"),
    };
  });
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
      complianceDocs: [],
      bookings: [],
      geofences: createSeedGeofences(),
      geofenceAlerts: [],
      vectorGeofences: createSeedVectorGeofences(),
      alerts: createSeedAlerts(),
      selectedVehicleId: "veh-1",
      isSimulating: true,
      simSpeedMultiplier: 1,
      expenses: [],
      workOrders: [],
      incidents: [],
      auditLogs: [],
    };
  }
  if (version < 5) {
    // Upgrade cleanly to Command Center rich pre-seeded dataset
    return getInitialSnapshot();
  }
  const hasTrips = Array.isArray(state.trips) && state.trips.length > 0;
  const vehicles = Array.isArray(state.vehicles)
    ? state.vehicles
    : createSeedVehicles();
  return {
    vehicles,
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
    complianceDocs: Array.isArray(state.complianceDocs)
      ? state.complianceDocs
      : createSeedComplianceDocs(),
    bookings: Array.isArray(state.bookings)
      ? normalizeLegacyBookings(state.bookings)
      : createSeedBookings(),
    geofences: Array.isArray(state.geofences)
      ? state.geofences
      : createSeedGeofences(),
    geofenceAlerts: Array.isArray(state.geofenceAlerts)
      ? state.geofenceAlerts
      : [],
    vectorGeofences: Array.isArray(state.vectorGeofences)
      ? state.vectorGeofences
      : createSeedVectorGeofences(),
    alerts: Array.isArray(state.alerts) ? state.alerts : createSeedAlerts(),
    selectedVehicleId:
      typeof state.selectedVehicleId === "string"
        ? state.selectedVehicleId
        : vehicles[0]?.id ?? "veh-1",
    isSimulating:
      typeof state.isSimulating === "boolean" ? state.isSimulating : true,
    simSpeedMultiplier:
      state.simSpeedMultiplier === 2 || state.simSpeedMultiplier === 4
        ? state.simSpeedMultiplier
        : 1,
    expenses: Array.isArray(state.expenses)
      ? state.expenses
      : createSeedExpenses(),
    workOrders: Array.isArray(state.workOrders)
      ? state.workOrders
      : createSeedWorkOrders(),
    incidents: Array.isArray(state.incidents)
      ? state.incidents
      : createSeedIncidents(),
    auditLogs: Array.isArray(state.auditLogs)
      ? state.auditLogs
      : createSeedAuditLogs(),
  };
}

function getInitialSnapshot(): FleetDataSnapshot {
  const trips = createSeedTrips();
  const firstActive = trips.find((t) => t.status === "active");
  return {
    vehicles: createSeedVehicles(),
    trips,
    activeTripId: firstActive?.id ?? null,
    fuelLogs: createSeedFuelLogs(),
    maintenanceRecords: createSeedMaintenance(),
    drivers: createSeedDrivers(),
    complianceDocs: createSeedComplianceDocs(),
    bookings: createSeedBookings(),
    geofences: createSeedGeofences(),
    geofenceAlerts: [],
    vectorGeofences: createSeedVectorGeofences(),
    alerts: createSeedAlerts(),
    selectedVehicleId: "veh-1",
    isSimulating: true,
    simSpeedMultiplier: 1,
    expenses: createSeedExpenses(),
    workOrders: createSeedWorkOrders(),
    incidents: createSeedIncidents(),
    auditLogs: createSeedAuditLogs(),
  };
}

export const useFleetStore = create<FleetState>()(
  persist(
    (set, get) => ({
      ...getInitialSnapshot(),

      logAudit: (action, entityType, summary, entityId) => {
        const entry = makeAudit(action, entityType, summary, entityId);
        set((state) => ({
          auditLogs: [entry, ...state.auditLogs].slice(0, 250),
        }));
      },

      addVehicle: (input) => {
        const defaultRouteId = "route-1";
        const route = getRouteById(defaultRouteId);
        const initPos = interpolateRoutePosition(route.waypoints, 0.05);
        const vehicle: Vehicle = {
          id: `veh-${crypto.randomUUID()}`,
          name: input.name.trim(),
          plate: input.plate.trim().toUpperCase(),
          type: input.type,
          odometerKm: Math.max(0, Number(input.odometerKm) || 0),
          createdAt: new Date().toISOString(),
          vin: input.vin?.trim().toUpperCase() || undefined,
          make: input.make?.trim() || undefined,
          model: input.model?.trim() || undefined,
          year: input.year,
          fuelType: input.fuelType,
          engineCapacityCc: input.engineCapacityCc,
          tankCapacityLiters: input.tankCapacityLiters,
          engineHours: input.engineHours ?? 0,
          status: input.status ?? "available",
          purchaseCost: input.purchaseCost,
          monthlyDepreciation: input.monthlyDepreciation,
          routeId: defaultRouteId,
          routeProgress: 0.05,
          baseSpeedKmh: 62,
          fuelLevelPercent: 85,
          lastKnownLocation: {
            latitude: initPos.latitude,
            longitude: initPos.longitude,
            speed: 0,
            heading: initPos.headingDeg,
            timestamp: Date.now(),
          },
        };
        set((state) => ({
          vehicles: [vehicle, ...state.vehicles],
          auditLogs: [
            makeAudit(
              "vehicle.created",
              "vehicle",
              `Added vehicle ${vehicle.name} (${vehicle.plate})`,
              vehicle.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
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
                  vin: input.vin !== undefined ? input.vin.trim().toUpperCase() || undefined : v.vin,
                  make: input.make !== undefined ? input.make.trim() || undefined : v.make,
                  model: input.model !== undefined ? input.model.trim() || undefined : v.model,
                  year: input.year !== undefined ? input.year : v.year,
                  fuelType: input.fuelType !== undefined ? input.fuelType : v.fuelType,
                  engineCapacityCc:
                    input.engineCapacityCc !== undefined
                      ? input.engineCapacityCc
                      : v.engineCapacityCc,
                  tankCapacityLiters:
                    input.tankCapacityLiters !== undefined
                      ? input.tankCapacityLiters
                      : v.tankCapacityLiters,
                  engineHours:
                    input.engineHours !== undefined
                      ? input.engineHours
                      : v.engineHours,
                  status: input.status !== undefined ? input.status : v.status,
                  purchaseCost:
                    input.purchaseCost !== undefined
                      ? input.purchaseCost
                      : v.purchaseCost,
                  monthlyDepreciation:
                    input.monthlyDepreciation !== undefined
                      ? input.monthlyDepreciation
                      : v.monthlyDepreciation,
                }
              : v
          ),
          auditLogs: [
            makeAudit(
              "vehicle.updated",
              "vehicle",
              `Updated vehicle ${input.name.trim()} (${input.plate.trim().toUpperCase()})`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      setVehicleStatus: (id, status) => {
        const vehicle = get().vehicles.find((v) => v.id === id);
        set((state) => ({
          vehicles: state.vehicles.map((v) =>
            v.id === id ? { ...v, status } : v
          ),
          auditLogs: [
            makeAudit(
              "vehicle.status_changed",
              "vehicle",
              `Changed ${vehicle?.name ?? id} status to ${status.replaceAll("_", " ")}`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeVehicle: (id) => {
        const { trips, activeTripId, vehicles } = get();
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
        const target = vehicles.find((v) => v.id === id);
        set((state) => ({
          vehicles: state.vehicles.filter((v) => v.id !== id),
          fuelLogs: state.fuelLogs.filter((f) => f.vehicleId !== id),
          maintenanceRecords: state.maintenanceRecords.filter(
            (m) => m.vehicleId !== id
          ),
          complianceDocs: state.complianceDocs.filter(
            (c) => c.vehicleId !== id
          ),
          workOrders: state.workOrders.filter((w) => w.vehicleId !== id),
          expenses: state.expenses.filter((e) => e.vehicleId !== id),
          drivers: state.drivers.map((d) =>
            d.assignedVehicleId === id
              ? { ...d, assignedVehicleId: undefined }
              : d
          ),
          auditLogs: [
            makeAudit(
              "vehicle.deleted",
              "vehicle",
              `Removed vehicle ${target?.name ?? id} (${target?.plate ?? ""})`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return { ok: true };
      },

      addComplianceDoc: (input) => {
        const doc: ComplianceDocument = {
          ...input,
          id: `comp-${crypto.randomUUID()}`,
          documentNumber: input.documentNumber.trim(),
          issuer: input.issuer.trim(),
        };
        set((state) => ({
          complianceDocs: [doc, ...state.complianceDocs],
          auditLogs: [
            makeAudit(
              "compliance.added",
              "compliance",
              `Added ${doc.docType} document (${doc.documentNumber})`,
              doc.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return doc;
      },

      removeComplianceDoc: (id) => {
        set((state) => ({
          complianceDocs: state.complianceDocs.filter((d) => d.id !== id),
          auditLogs: [
            makeAudit(
              "compliance.deleted",
              "compliance",
              `Removed compliance document`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      startTrip: (vehicleId, purpose, driverId, options) => {
        const { trips, vehicles } = get();
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (!vehicle) {
          return { ok: false, error: "Select a valid vehicle." };
        }
        if (
          vehicle.status === "under_maintenance" ||
          vehicle.status === "out_of_service" ||
          vehicle.status === "decommissioned"
        ) {
          return {
            ok: false,
            error: "Vehicle is unavailable for dispatch.",
          };
        }
        const vehicleHasOpenTrip = trips.some(
          (t) => t.vehicleId === vehicleId && t.status !== "done"
        );
        if (vehicleHasOpenTrip) {
          return {
            ok: false,
            error: `${vehicle.name} already has an active trip.`,
          };
        }
        const route = getRouteById(vehicle.routeId);
        const newTrip: Trip = {
          id: `trip-${crypto.randomUUID()}`,
          vehicleId,
          driverId: driverId || undefined,
          purpose: purpose.trim() || "General trip",
          routeId: route.id,
          routeName: route.name,
          status: "active",
          startedAt: new Date().toISOString(),
          distanceKm: 0,
          maxSpeedKmh: 0,
          points: [],
          bookingId: options?.bookingId,
          preTripChecklist: options?.preTripChecklist,
          waypoints: options?.waypoints ?? [],
          safetyMetrics: {
            harshBrakingCount: 0,
            speedingIncidents: 0,
            idleMinutes: 0,
            onTime: true,
          },
        };
        set((state) => ({
          trips: [newTrip, ...state.trips],
          activeTripId: newTrip.id,
          selectedVehicleId: vehicleId,
          vehicles: state.vehicles.map((v) =>
            v.id === vehicleId ? { ...v, status: "on_trip" } : v
          ),
          bookings: options?.bookingId
            ? state.bookings.map((b) =>
                b.id === options.bookingId
                  ? {
                      ...b,
                      status: "in_progress" as const,
                      startedAt: newTrip.startedAt,
                      tripId: newTrip.id,
                    }
                  : b
              )
            : state.bookings,
          auditLogs: [
            makeAudit(
              "trip.started",
              "trip",
              `Started trip "${newTrip.purpose}" with ${vehicle.name}`,
              newTrip.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return { ok: true };
      },

      addPoint: (lat, lng, timestamp) => {
        const { activeTripId, trips, geofences } = get();
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

        const prevMetrics = activeTrip.safetyMetrics ?? {
          harshBrakingCount: 0,
          speedingIncidents: 0,
          idleMinutes: 0,
          onTime: true,
        };

        const speedingDelta = speedKmh > 65 ? 1 : 0;

        const zoneTransitions = evaluateGeofenceTransitions(
          lastPoint,
          nextPoint,
          geofences,
          new Date(now).getHours()
        );
        const newAlerts: GeofenceAlert[] = zoneTransitions.map((ev) => ({
          id: `gfa-${crypto.randomUUID()}`,
          zoneId: ev.zone.id,
          zoneName: ev.zone.name,
          vehicleId: activeTrip.vehicleId,
          tripId: activeTrip.id,
          eventType: ev.eventType,
          timestamp: new Date(now).toISOString(),
        }));

        const updatedTrip: Trip = {
          ...activeTrip,
          distanceKm: Number((activeTrip.distanceKm + addedKm).toFixed(4)),
          maxSpeedKmh: Math.max(
            activeTrip.maxSpeedKmh,
            Number(speedKmh.toFixed(1))
          ),
          points: [...activeTrip.points, nextPoint],
          safetyMetrics: {
            ...prevMetrics,
            speedingIncidents: prevMetrics.speedingIncidents + speedingDelta,
          },
        };

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId ? updatedTrip : t
          ),
          geofenceAlerts:
            newAlerts.length > 0
              ? [...newAlerts, ...state.geofenceAlerts].slice(0, 100)
              : state.geofenceAlerts,
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

      endTrip: (postTripChecklist) => {
        const { activeTripId, trips } = get();
        if (!activeTripId) return;
        const activeTrip = trips.find((t) => t.id === activeTripId);
        if (!activeTrip) {
          set({ activeTripId: null });
          return;
        }
        const endedAt = new Date().toISOString();
        const durationHours = Math.max(
          0,
          (new Date(endedAt).getTime() -
            new Date(activeTrip.startedAt).getTime()) /
            3_600_000
        );
        set((state) => ({
          activeTripId: null,
          trips: state.trips.map((t) =>
            t.id === activeTripId
              ? {
                  ...t,
                  status: "done",
                  endedAt,
                  postTripChecklist: postTripChecklist ?? t.postTripChecklist,
                }
              : t
          ),
          vehicles: state.vehicles.map((v) =>
            v.id === activeTrip.vehicleId
              ? {
                  ...v,
                  status: v.status === "on_trip" ? "available" : v.status,
                  odometerKm: Number(
                    (v.odometerKm + activeTrip.distanceKm).toFixed(2)
                  ),
                  engineHours: Number(
                    ((v.engineHours ?? 0) + durationHours).toFixed(1)
                  ),
                }
              : v
          ),
          bookings: activeTrip.bookingId
            ? state.bookings.map((b) =>
                b.id === activeTrip.bookingId
                  ? {
                      ...b,
                      status: "completed" as const,
                      completedAt: endedAt,
                      tripId: activeTrip.id,
                    }
                  : b
              )
            : state.bookings,
          auditLogs: [
            makeAudit(
              "trip.completed",
              "trip",
              `Completed trip "${activeTrip.purpose}" (${activeTrip.distanceKm.toFixed(2)} km)`,
              activeTrip.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      addActiveTripWaypoint: (waypoint) => {
        const { activeTripId } = get();
        if (!activeTripId) return;
        const wp: TripWaypoint = {
          ...waypoint,
          id: `wp-${crypto.randomUUID()}`,
        };
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId
              ? { ...t, waypoints: [...(t.waypoints ?? []), wp] }
              : t
          ),
        }));
      },

      completeWaypointPod: (waypointId, pod) => {
        const { activeTripId } = get();
        if (!activeTripId) return;
        const arrivedAt = new Date().toISOString();
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === activeTripId
              ? {
                  ...t,
                  waypoints: (t.waypoints ?? []).map((wp) =>
                    wp.id === waypointId
                      ? {
                          ...wp,
                          arrivedAt,
                          recipientName: pod.recipientName.trim(),
                          podSignatureDataUrl: pod.podSignatureDataUrl,
                          podPhotoDataUrl: pod.podPhotoDataUrl,
                        }
                      : wp
                  ),
                }
              : t
          ),
          auditLogs: [
            makeAudit(
              "trip.pod_captured",
              "trip",
              `Captured Proof of Delivery signed by ${pod.recipientName.trim()}`,
              activeTripId
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      addBooking: (input) => {
        const now = Date.now();
        const actor = getCurrentActor();
        const booking: TripBooking = {
          ...input,
          id: `book-${crypto.randomUUID()}`,
          requesterUserId: input.requesterUserId ?? actor.actorId,
          requesterName: input.requesterName.trim(),
          purpose: input.purpose.trim(),
          pickupLocation: input.pickupLocation?.trim() || "Central Logistics Hub",
          dropoffLocation: input.dropoffLocation?.trim() || input.purpose.trim(),
          status: "pending",
          createdAt: new Date(now).toISOString(),
        };
        set((state) => ({
          bookings: [booking, ...state.bookings],
          alerts: [
            {
              id: `alert-${crypto.randomUUID()}`,
              severity: "warning" as const,
              title: "New Trip Request — Pending Assignment",
              message: `${booking.requesterName} requested "${booking.purpose}" (${booking.pickupLocation} → ${booking.dropoffLocation}) for ${booking.requestedDate}.`,
              timestamp: now,
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
          auditLogs: [
            makeAudit(
              "booking.requested",
              "booking",
              `Submitted trip request "${booking.purpose}" by ${booking.requesterName}`,
              booking.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return booking;
      },

      assignBooking: (id, assignment) => {
        const { bookings, vehicles, drivers, trips } = get();
        const booking = bookings.find((b) => b.id === id);
        if (!booking) return { ok: false, error: "Trip request not found." };
        if (booking.status === "in_progress" || booking.status === "completed") {
          return {
            ok: false,
            error: "Cannot reassign a trip that is already in progress or completed.",
          };
        }
        const vehicle = vehicles.find((v) => v.id === assignment.vehicleId);
        if (!vehicle) return { ok: false, error: "Select a valid vehicle." };
        if (
          vehicle.status === "under_maintenance" ||
          vehicle.status === "out_of_service" ||
          vehicle.status === "decommissioned"
        ) {
          return {
            ok: false,
            error: `${vehicle.name} is unavailable (${vehicle.status.replaceAll("_", " ")}).`,
          };
        }
        const driver = drivers.find((d) => d.id === assignment.driverId);
        if (!driver) return { ok: false, error: "Select a valid driver." };

        const targetDay = booking.requestedDate.slice(0, 10);
        const onLeave = (driver.leaveLogs ?? []).find(
          (l) => targetDay >= l.fromDate && targetDay <= l.toDate
        );
        if (onLeave) {
          return {
            ok: false,
            error: `${driver.name} is on leave (${onLeave.reason}: ${onLeave.fromDate} – ${onLeave.toDate}).`,
          };
        }
        if (!assignment.allowQueuedDriver) {
          const avail = checkDriverAvailability(driver, booking.requestedDate, trips);
          if (!avail.available) {
            return {
              ok: false,
              error: `${driver.name} conflict: ${avail.reason}`,
            };
          }
        }

        const actor = getCurrentActor();
        const now = Date.now();
        const assignedAt = new Date(now).toISOString();

        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "assigned" as const,
                  vehicleId: vehicle.id,
                  driverId: driver.id,
                  approvedBy: actor.actorName,
                  assignedBy: actor.actorName,
                  assignedAt,
                  rejectionReason: undefined,
                  notes: assignment.notes?.trim() || b.notes,
                }
              : b
          ),
          alerts: [
            {
              id: `alert-${crypto.randomUUID()}`,
              severity: "info" as const,
              title: "Driver Assigned to Trip",
              message: `${actor.actorName} assigned ${driver.name} (${vehicle.name} · ${vehicle.plate}) to "${booking.purpose}" for ${booking.requesterName}.`,
              vehicleId: vehicle.id,
              timestamp: now,
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
          auditLogs: [
            makeAudit(
              "booking.assigned",
              "booking",
              `Assigned ${driver.name} & ${vehicle.name} (${vehicle.plate}) to "${booking.purpose}"`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return { ok: true };
      },

      rejectBooking: (id, reason) => {
        const target = get().bookings.find((b) => b.id === id);
        const actor = getCurrentActor();
        const now = Date.now();
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "rejected" as const,
                  rejectionReason: reason?.trim() || "Declined by dispatcher",
                }
              : b
          ),
          alerts: target
            ? [
                {
                  id: `alert-${crypto.randomUUID()}`,
                  severity: "warning" as const,
                  title: "Trip Request Rejected",
                  message: `${actor.actorName} rejected "${target.purpose}" (${reason?.trim() || "No reason provided"}).`,
                  timestamp: now,
                  read: false,
                },
                ...state.alerts,
              ].slice(0, 60)
            : state.alerts,
          auditLogs: [
            makeAudit(
              "booking.rejected",
              "booking",
              `Rejected booking "${target?.purpose ?? id}"`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      startAssignedBooking: (bookingId, preTripChecklist) => {
        const { bookings, vehicles } = get();
        const booking = bookings.find((b) => b.id === bookingId);
        if (!booking) return { ok: false, error: "Trip booking not found." };
        if (booking.status !== "assigned") {
          return {
            ok: false,
            error: "Only assigned bookings can be started by the driver.",
          };
        }
        if (!booking.vehicleId || !booking.driverId) {
          return {
            ok: false,
            error: "Admin must assign both a driver and a vehicle first.",
          };
        }
        const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
        if (!vehicle) return { ok: false, error: "Assigned vehicle not found." };
        const route = getRouteById(vehicle.routeId);
        const destPos = interpolateRoutePosition(route.waypoints, 0.85);
        const waypoints: TripWaypoint[] = [
          {
            id: `wp-${crypto.randomUUID()}`,
            label: booking.dropoffLocation || booking.purpose,
            address: booking.dropoffLocation || route.name,
            lat: destPos.latitude,
            lng: destPos.longitude,
          },
        ];
        return get().startTripForVehicle(
          booking.vehicleId,
          vehicle.routeId,
          booking.purpose,
          {
            bookingId: booking.id,
            driverId: booking.driverId,
            preTripChecklist,
            waypoints,
          }
        );
      },

      updateBookingStatus: (id, status, updates) => {
        const target = get().bookings.find((b) => b.id === id);
        const actor = getCurrentActor();
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status,
                  vehicleId: updates?.vehicleId ?? b.vehicleId,
                  driverId: updates?.driverId ?? b.driverId,
                  approvedBy:
                    status === "assigned"
                      ? updates?.approvedBy ?? actor.actorName
                      : b.approvedBy,
                  assignedBy:
                    status === "assigned"
                      ? updates?.assignedBy ?? actor.actorName
                      : b.assignedBy,
                  assignedAt:
                    status === "assigned"
                      ? b.assignedAt ?? new Date().toISOString()
                      : b.assignedAt,
                  rejectionReason:
                    updates?.rejectionReason ?? b.rejectionReason,
                }
              : b
          ),
          auditLogs: [
            makeAudit(
              `booking.${status}`,
              "booking",
              `Marked booking "${target?.purpose ?? id}" as ${status}`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeBooking: (id) => {
        set((state) => ({
          bookings: state.bookings.filter((b) => b.id !== id),
        }));
      },

      rateCompletedBooking: (bookingId, rating, feedback) => {
        const clamped = Math.max(1, Math.min(5, Math.round(rating)));
        const target = get().bookings.find((b) => b.id === bookingId);
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  rating: clamped,
                  feedback: feedback?.trim() || b.feedback,
                }
              : b
          ),
          auditLogs: [
            makeAudit(
              "booking.rated",
              "booking",
              `Rated completed trip "${target?.purpose ?? bookingId}" ${clamped}/5 stars`,
              bookingId
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      addGeofence: (input) => {
        const zone: GeofenceZone = {
          ...input,
          id: `geo-${crypto.randomUUID()}`,
          name: input.name.trim(),
        };
        set((state) => ({
          geofences: [zone, ...state.geofences],
          auditLogs: [
            makeAudit(
              "geofence.created",
              "geofence",
              `Created geofence zone "${zone.name}" (${zone.type})`,
              zone.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return zone;
      },

      toggleGeofence: (id) => {
        set((state) => ({
          geofences: state.geofences.map((z) =>
            z.id === id ? { ...z, active: !z.active } : z
          ),
        }));
      },

      removeGeofence: (id) => {
        set((state) => ({
          geofences: state.geofences.filter((z) => z.id !== id),
        }));
      },

      clearGeofenceAlerts: () => {
        set({ geofenceAlerts: [] });
      },

      addFuelLog: (input) => {
        const log: FuelLog = {
          ...input,
          id: `fuel-${crypto.randomUUID()}`,
          totalCost: Number((input.liters * input.pricePerLiter).toFixed(2)),
        };
        set((state) => ({
          fuelLogs: [log, ...state.fuelLogs],
          auditLogs: [
            makeAudit(
              "fuel.logged",
              "fuel",
              `Logged ${log.liters}L fuel ($${log.totalCost.toFixed(2)})`,
              log.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
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

      addExpense: (input) => {
        const expense: OperatingExpense = {
          ...input,
          id: `exp-${crypto.randomUUID()}`,
          description: input.description.trim(),
        };
        set((state) => ({
          expenses: [expense, ...state.expenses],
          auditLogs: [
            makeAudit(
              "expense.logged",
              "expense",
              `Logged ${expense.category} expense ($${expense.amount.toFixed(2)})`,
              expense.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return expense;
      },

      removeExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
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
          auditLogs: [
            makeAudit(
              "maintenance.scheduled",
              "maintenance",
              `Scheduled "${record.title}" (${record.type})`,
              record.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return record;
      },

      updateMaintenanceRecord: (id, input) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.map((rec) =>
            rec.id === id ? { ...input, id, title: input.title.trim() } : rec
          ),
        }));
      },

      completeMaintenanceRecord: (id, completedDate, cost) => {
        const target = get().maintenanceRecords.find((r) => r.id === id);
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
          auditLogs: [
            makeAudit(
              "maintenance.completed",
              "maintenance",
              `Completed service "${target?.title ?? id}"`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeMaintenanceRecord: (id) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.filter(
            (rec) => rec.id !== id
          ),
        }));
      },

      addWorkOrder: (input) => {
        const wo: WorkOrder = {
          ...input,
          id: `wo-${crypto.randomUUID()}`,
          title: input.title.trim(),
          vendorName: input.vendorName.trim(),
        };
        set((state) => ({
          workOrders: [wo, ...state.workOrders],
          vehicles:
            wo.status !== "completed"
              ? state.vehicles.map((v) =>
                  v.id === wo.vehicleId && v.status !== "on_trip"
                    ? { ...v, status: "under_maintenance" }
                    : v
                )
              : state.vehicles,
          auditLogs: [
            makeAudit(
              "work_order.created",
              "work_order",
              `Opened work order "${wo.title}" at ${wo.vendorName}`,
              wo.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return wo;
      },

      updateWorkOrderStatus: (id, status, completedAt) => {
        const target = get().workOrders.find((w) => w.id === id);
        set((state) => {
          const nextWorkOrders = state.workOrders.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status,
                  completedAt:
                    status === "completed"
                      ? completedAt ?? new Date().toISOString().slice(0, 10)
                      : w.completedAt,
                }
              : w
          );
          const stillHasOpenWo = target
            ? nextWorkOrders.some(
                (w) => w.vehicleId === target.vehicleId && w.status !== "completed"
              )
            : false;

          return {
            workOrders: nextWorkOrders,
            vehicles: target
              ? state.vehicles.map((v) => {
                  if (v.id !== target.vehicleId) return v;
                  if (status === "completed" && !stillHasOpenWo && v.status === "under_maintenance") {
                    return { ...v, status: "available" };
                  }
                  if (status !== "completed" && v.status === "available") {
                    return { ...v, status: "under_maintenance" };
                  }
                  return v;
                })
              : state.vehicles,
            auditLogs: [
              makeAudit(
                "work_order.status_changed",
                "work_order",
                `Updated work order "${target?.title ?? id}" to ${status.replaceAll("_", " ")}`,
                id
              ),
              ...state.auditLogs,
            ].slice(0, 250),
          };
        });
      },

      removeWorkOrder: (id) => {
        set((state) => ({
          workOrders: state.workOrders.filter((w) => w.id !== id),
        }));
      },

      addIncident: (input) => {
        const incident: IncidentReport = {
          ...input,
          id: `inc-${crypto.randomUUID()}`,
          locationLabel: input.locationLabel.trim(),
          description: input.description.trim(),
        };
        set((state) => ({
          incidents: [incident, ...state.incidents],
          auditLogs: [
            makeAudit(
              "incident.reported",
              "incident",
              `Reported ${incident.severity} incident at ${incident.locationLabel}`,
              incident.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return incident;
      },

      updateIncidentStatus: (id, status) => {
        set((state) => ({
          incidents: state.incidents.map((i) =>
            i.id === id ? { ...i, status } : i
          ),
          auditLogs: [
            makeAudit(
              "incident.status_changed",
              "incident",
              `Marked incident as ${status}`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeIncident: (id) => {
        set((state) => ({
          incidents: state.incidents.filter((i) => i.id !== id),
        }));
      },

      addDriver: (input) => {
        const today = new Date().toISOString().slice(0, 10);
        const driver: Driver = {
          ...input,
          id: `drv-${crypto.randomUUID()}`,
          name: input.name.trim(),
          phone: input.phone.trim(),
          licenseNumber: input.licenseNumber.trim().toUpperCase(),
          assignedVehicleHistory: input.assignedVehicleId
            ? [{ vehicleId: input.assignedVehicleId, assignedAt: today }]
            : [],
          shifts: input.shifts ?? [],
          leaveLogs: input.leaveLogs ?? [],
        };
        set((state) => ({
          drivers: [driver, ...state.drivers],
          auditLogs: [
            makeAudit(
              "driver.created",
              "driver",
              `Added driver ${driver.name}`,
              driver.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return driver;
      },

      updateDriver: (id, input) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          drivers: state.drivers.map((d) => {
            if (d.id !== id) return d;
            let history = [...(d.assignedVehicleHistory ?? [])];
            if (d.assignedVehicleId !== input.assignedVehicleId) {
              history = history.map((entry) =>
                !entry.unassignedAt && entry.vehicleId === d.assignedVehicleId
                  ? { ...entry, unassignedAt: today }
                  : entry
              );
              if (input.assignedVehicleId) {
                history.push({
                  vehicleId: input.assignedVehicleId,
                  assignedAt: today,
                });
              }
            }
            return {
              ...d,
              ...input,
              id,
              name: input.name.trim(),
              phone: input.phone.trim(),
              licenseNumber: input.licenseNumber.trim().toUpperCase(),
              assignedVehicleHistory: history,
            };
          }),
        }));
      },

      removeDriver: (id) => {
        set((state) => ({
          drivers: state.drivers.filter((d) => d.id !== id),
        }));
      },

      addDriverShift: (driverId, shift) => {
        const entry: DriverShift = { ...shift, id: `sh-${crypto.randomUUID()}` };
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? { ...d, shifts: [...(d.shifts ?? []), entry] }
              : d
          ),
        }));
      },

      removeDriverShift: (driverId, shiftId) => {
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? {
                  ...d,
                  shifts: (d.shifts ?? []).filter((s) => s.id !== shiftId),
                }
              : d
          ),
        }));
      },

      addDriverLeave: (driverId, leave) => {
        const entry: DriverLeave = { ...leave, id: `lv-${crypto.randomUUID()}` };
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? { ...d, leaveLogs: [...(d.leaveLogs ?? []), entry] }
              : d
          ),
        }));
      },

      removeDriverLeave: (driverId, leaveId) => {
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? {
                  ...d,
                  leaveLogs: (d.leaveLogs ?? []).filter((l) => l.id !== leaveId),
                }
              : d
          ),
        }));
      },

      setSelectedVehicle: (vehicleId) => {
        set({ selectedVehicleId: vehicleId });
      },

      setIsSimulating: (simulating) => {
        set({ isSimulating: simulating });
      },

      setSimSpeedMultiplier: (speed) => {
        set({ simSpeedMultiplier: speed });
      },

      startTripForVehicle: (vehicleId, routeId, purpose, options) => {
        const { vehicles, drivers, trips } = get();
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (!vehicle) {
          return { ok: false, error: "Vehicle not found." };
        }
        if (
          vehicle.status === "under_maintenance" ||
          vehicle.status === "out_of_service" ||
          vehicle.status === "decommissioned"
        ) {
          return {
            ok: false,
            error: "Vehicle is locked in maintenance or out of service.",
          };
        }
        if (
          vehicle.status === "on_trip" ||
          trips.some((t) => t.vehicleId === vehicleId && t.status !== "done")
        ) {
          return {
            ok: false,
            error: `${vehicle.name} is already on an active trip.`,
          };
        }

        const route = getRouteById(routeId ?? vehicle.routeId);
        const assignedDriver =
          (options?.driverId
            ? drivers.find((d) => d.id === options.driverId)
            : undefined) ??
          drivers.find((d) => d.assignedVehicleId === vehicleId);
        const startPos = interpolateRoutePosition(
          route.waypoints,
          vehicle.routeProgress ?? 0
        );
        const now = Date.now();
        const startedIso = new Date(now).toISOString();
        const newTrip: Trip = {
          id: `trip-${crypto.randomUUID()}`,
          vehicleId,
          driverId: options?.driverId ?? assignedDriver?.id,
          purpose: purpose?.trim() || `Live corridor dispatch (${route.code})`,
          routeId: route.id,
          routeName: route.name,
          status: "active",
          startedAt: startedIso,
          distanceKm: 0,
          maxSpeedKmh: vehicle.baseSpeedKmh ?? 64,
          points: [
            {
              lat: startPos.latitude,
              lng: startPos.longitude,
              t: now,
            },
          ],
          bookingId: options?.bookingId,
          preTripChecklist: options?.preTripChecklist,
          waypoints: options?.waypoints ?? [],
          safetyMetrics: {
            harshBrakingCount: 0,
            speedingIncidents: 0,
            idleMinutes: 0,
            onTime: true,
          },
        };

        set((state) => ({
          trips: [newTrip, ...state.trips],
          activeTripId: newTrip.id,
          selectedVehicleId: vehicleId,
          vehicles: state.vehicles.map((v) =>
            v.id === vehicleId
              ? {
                  ...v,
                  status: "on_trip",
                  routeId: route.id,
                  lastKnownLocation: {
                    latitude: startPos.latitude,
                    longitude: startPos.longitude,
                    speed: v.baseSpeedKmh ?? 64,
                    heading: startPos.headingDeg,
                    timestamp: now,
                  },
                }
              : v
          ),
          bookings: options?.bookingId
            ? state.bookings.map((b) =>
                b.id === options.bookingId
                  ? {
                      ...b,
                      status: "in_progress" as const,
                      startedAt: startedIso,
                      tripId: newTrip.id,
                    }
                  : b
              )
            : state.bookings,
          alerts: [
            {
              id: `alert-${crypto.randomUUID()}`,
              severity: "info" as const,
              title: options?.bookingId
                ? "Driver Started Assigned Trip"
                : "Trip Dispatched",
              message: `${assignedDriver?.name ?? "Driver"} departed in ${vehicle.name} (${vehicle.plate}) — ${newTrip.purpose}.`,
              vehicleId,
              timestamp: now,
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
          auditLogs: [
            makeAudit(
              options?.bookingId ? "trip.started_from_booking" : "trip.started",
              "trip",
              `Dispatched ${vehicle.name} on ${route.name} (${route.code})`,
              newTrip.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));

        return { ok: true };
      },

      endActiveTripForVehicle: (vehicleId, postTripChecklist) => {
        const { trips, vehicles } = get();
        const activeTrip = trips.find(
          (t) => t.vehicleId === vehicleId && t.status !== "done"
        );
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        const now = Date.now();
        const endedAt = new Date(now).toISOString();

        set((state) => {
          const nextTrips = activeTrip
            ? state.trips.map((t) =>
                t.id === activeTrip.id
                  ? {
                      ...t,
                      status: "done" as const,
                      endedAt,
                      postTripChecklist:
                        postTripChecklist ?? t.postTripChecklist,
                    }
                  : t
              )
            : state.trips;

          const remainingOpen = nextTrips.find((t) => t.status !== "done");
          const linkedBookingId = activeTrip?.bookingId;

          return {
            trips: nextTrips,
            activeTripId:
              state.activeTripId === activeTrip?.id
                ? remainingOpen?.id ?? null
                : state.activeTripId,
            vehicles: state.vehicles.map((v) =>
              v.id === vehicleId
                ? {
                    ...v,
                    status: v.status === "on_trip" ? "available" : v.status,
                    lastKnownLocation: v.lastKnownLocation
                      ? { ...v.lastKnownLocation, speed: 0, timestamp: now }
                      : undefined,
                  }
                : v
            ),
            bookings: linkedBookingId
              ? state.bookings.map((b) =>
                  b.id === linkedBookingId
                    ? {
                        ...b,
                        status: "completed" as const,
                        completedAt: endedAt,
                        tripId: activeTrip?.id ?? b.tripId,
                      }
                    : b
                )
              : state.bookings,
            alerts: vehicle
              ? [
                  {
                    id: `alert-${crypto.randomUUID()}`,
                    severity: "info" as const,
                    title: "Trip Completed",
                    message: `${vehicle.name} (${vehicle.plate}) completed "${activeTrip?.purpose ?? "its corridor run"}" and returned to standby.`,
                    vehicleId,
                    timestamp: now,
                    read: false,
                  },
                  ...state.alerts,
                ].slice(0, 60)
              : state.alerts,
            auditLogs: activeTrip
              ? [
                  makeAudit(
                    "trip.completed",
                    "trip",
                    `Completed trip "${activeTrip.purpose}" (${activeTrip.distanceKm.toFixed(1)} km)`,
                    activeTrip.id
                  ),
                  ...state.auditLogs,
                ].slice(0, 250)
              : state.auditLogs,
          };
        });
      },

      applySimulationTick: (updates) => {
        if (updates.length === 0) return;
        const byId = new Map(updates.map((u) => [u.vehicleId, u]));

        set((state) => ({
          vehicles: state.vehicles.map((v) => {
            const u = byId.get(v.id);
            if (!u || v.status !== "on_trip") return v;
            const currentFuel = v.fuelLevelPercent ?? 75;
            return {
              ...v,
              routeProgress: u.routeProgress,
              odometerKm: Number((v.odometerKm + u.deltaDistanceKm).toFixed(2)),
              fuelLevelPercent: Number(
                Math.max(5, currentFuel - u.deltaFuelPercent).toFixed(1)
              ),
              lastKnownLocation: {
                latitude: u.latitude,
                longitude: u.longitude,
                speed: u.speed,
                heading: u.heading,
                timestamp: u.timestamp,
              },
            };
          }),
          trips: state.trips.map((t) => {
            if (t.status !== "active") return t;
            const u = byId.get(t.vehicleId);
            if (!u) return t;
            const nextPt: TrackPoint = {
              lat: u.latitude,
              lng: u.longitude,
              t: u.timestamp,
            };
            const nextPoints = [...t.points, nextPt].slice(-120);
            return {
              ...t,
              distanceKm: Number((t.distanceKm + u.deltaDistanceKm).toFixed(2)),
              maxSpeedKmh: Math.max(t.maxSpeedKmh, Number(u.speed.toFixed(1))),
              points: nextPoints,
            };
          }),
        }));
      },

      toggleVectorGeofence: (id) => {
        set((state) => ({
          vectorGeofences: state.vectorGeofences.map((g) =>
            g.id === id ? { ...g, active: !g.active } : g
          ),
        }));
      },

      addFleetAlert: (alert) => {
        set((state) => ({
          alerts: [
            {
              ...alert,
              id: `alert-${crypto.randomUUID()}`,
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
        }));
      },

      markAlertRead: (id) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, read: true } : a
          ),
        }));
      },

      markAllAlertsRead: () => {
        set((state) => ({
          alerts: state.alerts.map((a) => ({ ...a, read: true })),
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
          complianceDocs: payload.complianceDocs ?? [],
          bookings: payload.bookings ?? [],
          geofences: payload.geofences ?? createSeedGeofences(),
          geofenceAlerts: payload.geofenceAlerts ?? [],
          vectorGeofences: createSeedVectorGeofences(),
          alerts: createSeedAlerts(),
          selectedVehicleId: payload.vehicles[0]?.id ?? "veh-1",
          expenses: payload.expenses ?? [],
          workOrders: payload.workOrders ?? [],
          incidents: payload.incidents ?? [],
          auditLogs: payload.auditLogs ?? [],
        });
      },

      resetDemoData: () => {
        set(getInitialSnapshot());
      },
    }),
    {
      name: "tf-fleet",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) =>
        migrateFleetState(persistedState, version),
    }
  )
);
