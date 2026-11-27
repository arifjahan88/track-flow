import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStateStorage } from "@/lib/storage";
import type {
  AuditLogEntry,
  CityRegionId,
  ComplianceDocument,
  Driver,
  DriverLeave,
  DriverShift,
  FleetAlert,
  FleetExportPayload,
  FuelLog,
  GeofenceAlert,
  GeofenceZone,
  GpsTrackingMode,
  IncidentReport,
  IncidentStatus,
  MaintenanceRecord,
  OperatingExpense,
  SimulationTickUpdate,
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
import { createId } from "@/lib/id";
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
    // fallback
  }
  return {
    actorId: "user-driver",
    actorName: "Marcus Vance",
    actorRole: "driver",
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
    id: createId("audit"),
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
  driverOnDuty: boolean;
  gpsMode: GpsTrackingMode;
  cityRegion: CityRegionId;
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
  // Mobile Driver Cockpit Controls
  setDriverOnDuty: (onDuty: boolean) => void;
  toggleDriverOnDuty: () => void;
  setGpsMode: (mode: GpsTrackingMode) => void;
  setCityRegion: (region: CityRegionId) => void;

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
  addActiveTripWaypoint: (waypoint: Omit<TripWaypoint, "id">) => void;
  completeWaypointPod: (
    waypointId: string,
    pod: {
      recipientName: string;
      podSignatureDataUrl?: string;
      podPhotoDataUrl?: string;
    },
    tripId?: string
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
  toggleGeofence: (id: string) => void;
  clearGeofenceAlerts: () => void;

  // Fuel & Operating Expenses
  addFuelLog: (input: Omit<FuelLog, "id">) => FuelLog;
  removeFuelLog: (id: string) => void;
  addExpense: (input: Omit<OperatingExpense, "id">) => OperatingExpense;
  removeExpense: (id: string) => void;

  // Maintenance, Work Orders & Incidents
  addMaintenanceRecord: (
    input: Omit<MaintenanceRecord, "id">
  ) => MaintenanceRecord;
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
    preTripChecklist?: TripChecklist
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

  // Audit & Reset
  logAudit: (
    action: string,
    entityType: AuditLogEntry["entityType"],
    summary: string,
    entityId?: string
  ) => void;
  importData: (payload: FleetExportPayload) => void;
  resetDemoData: () => void;
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
    driverOnDuty: true,
    gpsMode: "sim",
    cityRegion: "dhaka",
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

      setDriverOnDuty: (onDuty) => {
        set((state) => ({
          driverOnDuty: onDuty,
          auditLogs: [
            makeAudit(
              onDuty ? "driver.shift_online" : "driver.shift_offline",
              "driver",
              `Driver switched shift status to ${onDuty ? "ONLINE (On Duty)" : "OFFLINE (Off Duty)"}`
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      toggleDriverOnDuty: () => {
        const next = !get().driverOnDuty;
        get().setDriverOnDuty(next);
      },

      setGpsMode: (mode) => set({ gpsMode: mode }),

      setCityRegion: (region) => set({ cityRegion: region }),

      logAudit: (action, entityType, summary, entityId) => {
        const entry = makeAudit(action, entityType, summary, entityId);
        set((state) => ({
          auditLogs: [entry, ...state.auditLogs].slice(0, 250),
        }));
      },

      addVehicle: (input) => {
        const defaultRouteId = "route-1";
        const route = getRouteById(defaultRouteId);
        const initPos = interpolateRoutePosition(
          route.waypoints,
          0.05,
          route,
          get().cityRegion
        );
        const vehicle: Vehicle = {
          id: createId("veh"),
          name: input.name.trim(),
          plate: input.plate.trim().toUpperCase(),
          type: input.type,
          odometerKm: Math.max(0, Number(input.odometerKm) || 0),
          createdAt: new Date().toISOString(),
          vin: input.vin?.trim().toUpperCase() || undefined,
          make: input.make?.trim() || undefined,
          model: input.model?.trim() || undefined,
          year: input.year,
          fuelType: input.fuelType ?? "Diesel",
          engineCapacityCc: input.engineCapacityCc,
          tankCapacityLiters: input.tankCapacityLiters ?? 90,
          engineHours: input.engineHours ?? 0,
          status: input.status ?? "available",
          purchaseCost: input.purchaseCost ?? 42000,
          monthlyDepreciation: input.monthlyDepreciation ?? 340,
          routeId: defaultRouteId,
          routeProgress: 0.05,
          baseSpeedKmh: 62,
          fuelLevelPercent: 88,
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
                  make: input.make ?? v.make,
                  model: input.model ?? v.model,
                  year: input.year ?? v.year,
                  fuelType: input.fuelType ?? v.fuelType,
                  tankCapacityLiters:
                    input.tankCapacityLiters ?? v.tankCapacityLiters,
                  status: input.status ?? v.status,
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
          auditLogs: [
            makeAudit(
              "vehicle.deleted",
              "vehicle",
              `Removed vehicle ${target?.name ?? id}`,
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
          id: createId("comp"),
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
              "Removed compliance document",
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      startTrip: (vehicleId, purpose, driverId, options) => {
        const { trips, vehicles, drivers } = get();
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
            error: "Vehicle is locked in maintenance / out of service.",
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
        const assignedDriver =
          driverId ||
          drivers.find((d) => d.assignedVehicleId === vehicleId)?.id;
        const route = getRouteById(vehicle.routeId);
        const defaultWaypoints: TripWaypoint[] =
          options?.waypoints && options.waypoints.length > 0
            ? options.waypoints
            : [
                {
                  id: createId("wp"),
                  label: `${route.prompts[1]?.district ?? "Midway"} Distribution Dock`,
                  address: route.prompts[1]?.streetName ?? route.name,
                  lat: route.dhakaCoords[2]?.latitude ?? 23.7885,
                  lng: route.dhakaCoords[2]?.longitude ?? 90.4257,
                },
                {
                  id: createId("wp"),
                  label: `${route.prompts[2]?.district ?? "Terminal"} Logistics Hub`,
                  address: route.prompts[2]?.streetName ?? route.name,
                  lat: route.dhakaCoords[5]?.latitude ?? 23.7654,
                  lng: route.dhakaCoords[5]?.longitude ?? 90.4089,
                },
              ];

        const newTrip: Trip = {
          id: createId("trip"),
          vehicleId,
          driverId: assignedDriver,
          purpose: purpose.trim() || `Corridor Dispatch · ${route.name}`,
          routeId: route.id,
          routeName: route.name,
          status: "active",
          startedAt: new Date().toISOString(),
          distanceKm: 0,
          maxSpeedKmh: 0,
          points: [],
          bookingId: options?.bookingId,
          preTripChecklist: options?.preTripChecklist,
          waypoints: defaultWaypoints,
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
          isSimulating: true,
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
          alerts: [
            {
              id: createId("alert"),
              severity: "info" as const,
              title: options?.bookingId
                ? "Driver Started Assigned Trip"
                : "Trip Started",
              message: `${vehicle.name} (${vehicle.plate}) departed on "${newTrip.purpose}".`,
              vehicleId,
              timestamp: Date.now(),
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
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
        const { activeTripId, trips, geofences, selectedVehicleId } = get();
        const targetTrip =
          trips.find((t) => t.id === activeTripId && t.status === "active") ??
          trips.find(
            (t) => t.vehicleId === selectedVehicleId && t.status === "active"
          );
        if (!targetTrip) return;

        const now = timestamp ?? Date.now();
        const lastPoint = targetTrip.points[targetTrip.points.length - 1];
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

        const prevMetrics = targetTrip.safetyMetrics ?? {
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
          id: createId("gfa"),
          zoneId: ev.zone.id,
          zoneName: ev.zone.name,
          vehicleId: targetTrip.vehicleId,
          tripId: targetTrip.id,
          eventType: ev.eventType,
          timestamp: new Date(now).toISOString(),
        }));

        const updatedTrip: Trip = {
          ...targetTrip,
          distanceKm: Number((targetTrip.distanceKm + addedKm).toFixed(3)),
          maxSpeedKmh: Math.max(
            targetTrip.maxSpeedKmh,
            Number(speedKmh.toFixed(1))
          ),
          points: [...targetTrip.points, nextPoint],
          safetyMetrics: {
            ...prevMetrics,
            speedingIncidents: prevMetrics.speedingIncidents + speedingDelta,
          },
        };

        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === targetTrip.id ? updatedTrip : t
          ),
          vehicles: state.vehicles.map((v) =>
            v.id === targetTrip.vehicleId
              ? {
                  ...v,
                  odometerKm: Number((v.odometerKm + addedKm).toFixed(1)),
                  lastKnownLocation: {
                    latitude: lat,
                    longitude: lng,
                    speed: Number(speedKmh.toFixed(1)),
                    heading: v.lastKnownLocation?.heading ?? 0,
                    timestamp: now,
                  },
                }
              : v
          ),
          geofenceAlerts:
            newAlerts.length > 0
              ? [...newAlerts, ...state.geofenceAlerts].slice(0, 100)
              : state.geofenceAlerts,
        }));
      },

      pauseTrip: () => {
        const { activeTripId, selectedVehicleId } = get();
        set((state) => ({
          trips: state.trips.map((t) =>
            (t.id === activeTripId || t.vehicleId === selectedVehicleId) &&
            t.status === "active"
              ? { ...t, status: "paused" }
              : t
          ),
        }));
      },

      resumeTrip: () => {
        const { activeTripId, selectedVehicleId } = get();
        set((state) => ({
          trips: state.trips.map((t) =>
            (t.id === activeTripId || t.vehicleId === selectedVehicleId) &&
            t.status === "paused"
              ? { ...t, status: "active" }
              : t
          ),
        }));
      },

      endTrip: (postTripChecklist) => {
        const { activeTripId, selectedVehicleId } = get();
        const target =
          get().trips.find((t) => t.id === activeTripId) ??
          get().trips.find(
            (t) => t.vehicleId === selectedVehicleId && t.status !== "done"
          );
        if (!target) return;
        get().endActiveTripForVehicle(target.vehicleId, postTripChecklist);
      },

      addActiveTripWaypoint: (waypoint) => {
        const { activeTripId, selectedVehicleId } = get();
        const newWp: TripWaypoint = {
          ...waypoint,
          id: createId("wp"),
        };
        set((state) => ({
          trips: state.trips.map((t) =>
            (t.id === activeTripId || t.vehicleId === selectedVehicleId) &&
            t.status !== "done"
              ? { ...t, waypoints: [...(t.waypoints ?? []), newWp] }
              : t
          ),
        }));
      },

      completeWaypointPod: (waypointId, pod, tripId) => {
        const { activeTripId, selectedVehicleId } = get();
        const arrivedAt = new Date().toISOString();
        set((state) => ({
          trips: state.trips.map((t) => {
            const isTarget = tripId
              ? t.id === tripId
              : t.id === activeTripId ||
                (t.vehicleId === selectedVehicleId && t.status !== "done");
            if (!isTarget) return t;
            return {
              ...t,
              waypoints: (t.waypoints ?? []).map((wp) =>
                wp.id === waypointId
                  ? {
                      ...wp,
                      arrivedAt,
                      recipientName: pod.recipientName,
                      podSignatureDataUrl: pod.podSignatureDataUrl,
                      podPhotoDataUrl: pod.podPhotoDataUrl,
                    }
                  : wp
              ),
            };
          }),
          auditLogs: [
            makeAudit(
              "trip.pod_completed",
              "trip",
              `Captured Proof of Delivery signed by ${pod.recipientName}`,
              tripId ?? activeTripId ?? undefined
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
          id: createId("book"),
          requesterUserId: input.requesterUserId ?? actor.actorId,
          requesterName: input.requesterName.trim(),
          purpose: input.purpose.trim(),
          pickupLocation:
            input.pickupLocation?.trim() || "Gulshan-2 Central Logistics Hub",
          dropoffLocation:
            input.dropoffLocation?.trim() || input.purpose.trim(),
          status: "pending",
          createdAt: new Date(now).toISOString(),
        };
        set((state) => ({
          bookings: [booking, ...state.bookings],
          alerts: [
            {
              id: createId("alert"),
              severity: "warning" as const,
              title: "New Trip Request — Pending Assignment",
              message: `${booking.requesterName} requested "${booking.purpose}" (${booking.pickupLocation} → ${booking.dropoffLocation}).`,
              timestamp: now,
              read: false,
            },
            ...state.alerts,
          ].slice(0, 60),
          auditLogs: [
            makeAudit(
              "booking.created",
              "booking",
              `Created trip request "${booking.purpose}" (${booking.requesterName})`,
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
            error: "Cannot reassign a trip already in progress or completed.",
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
            error: `${driver.name} is on leave (${onLeave.reason}).`,
          };
        }
        if (!assignment.allowQueuedDriver) {
          const avail = checkDriverAvailability(
            driver,
            booking.requestedDate,
            trips
          );
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
              id: createId("alert"),
              severity: "info" as const,
              title: "Driver Assigned to Trip",
              message: `${actor.actorName} assigned ${driver.name} (${vehicle.name} · ${vehicle.plate}) to "${booking.purpose}".`,
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
              `Assigned ${driver.name} & ${vehicle.name} to "${booking.purpose}"`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return { ok: true };
      },

      rejectBooking: (id, reason) => {
        const booking = get().bookings.find((b) => b.id === id);
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
          alerts: booking
            ? [
                {
                  id: createId("alert"),
                  severity: "warning" as const,
                  title: "Trip Request Rejected",
                  message: `${actor.actorName} rejected "${booking.purpose}".`,
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
              `Rejected booking "${booking?.purpose ?? id}"`,
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
            error: "Admin must assign a driver and vehicle first.",
          };
        }
        const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
        if (!vehicle) return { ok: false, error: "Assigned vehicle not found." };
        const route = getRouteById(vehicle.routeId);
        const destCoord =
          route.dhakaCoords[Math.max(0, route.dhakaCoords.length - 2)];
        const waypoints: TripWaypoint[] = [
          {
            id: createId("wp"),
            label: booking.dropoffLocation || booking.purpose,
            address: booking.dropoffLocation || route.name,
            lat: destCoord?.latitude ?? 23.775,
            lng: destCoord?.longitude ?? 90.414,
          },
        ];
        return get().startTrip(
          booking.vehicleId,
          booking.purpose,
          booking.driverId,
          {
            bookingId: booking.id,
            preTripChecklist,
            waypoints,
          }
        );
      },

      updateBookingStatus: (id, status, updates) => {
        const booking = get().bookings.find((b) => b.id === id);
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
              `Marked booking "${booking?.purpose ?? id}" as ${status}`,
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

      toggleGeofence: (id) => {
        set((state) => ({
          geofences: state.geofences.map((g) =>
            g.id === id ? { ...g, active: !g.active } : g
          ),
        }));
      },

      clearGeofenceAlerts: () => set({ geofenceAlerts: [] }),

      addFuelLog: (input) => {
        const log: FuelLog = {
          ...input,
          id: createId("fuel"),
        };
        set((state) => ({
          fuelLogs: [log, ...state.fuelLogs],
          vehicles: state.vehicles.map((v) =>
            v.id === input.vehicleId
              ? {
                  ...v,
                  odometerKm: Math.max(v.odometerKm, input.odometerKm),
                  fuelLevelPercent: input.fullTank
                    ? 100
                    : Math.min(100, (v.fuelLevelPercent ?? 50) + 35),
                }
              : v
          ),
          auditLogs: [
            makeAudit(
              "fuel.logged",
              "fuel",
              `Logged ${log.liters.toFixed(1)} L fuel fill-up ($${log.totalCost.toFixed(2)})`,
              log.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return log;
      },

      removeFuelLog: (id) => {
        set((state) => ({
          fuelLogs: state.fuelLogs.filter((f) => f.id !== id),
        }));
      },

      addExpense: (input) => {
        const exp: OperatingExpense = {
          ...input,
          id: createId("exp"),
          description: input.description.trim(),
        };
        set((state) => ({
          expenses: [exp, ...state.expenses],
          auditLogs: [
            makeAudit(
              "expense.logged",
              "expense",
              `Logged ${exp.category} expense ($${exp.amount.toFixed(2)}): ${exp.description}`,
              exp.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return exp;
      },

      removeExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
      },

      addMaintenanceRecord: (input) => {
        const rec: MaintenanceRecord = {
          ...input,
          id: createId("maint"),
          title: input.title.trim(),
        };
        set((state) => ({
          maintenanceRecords: [rec, ...state.maintenanceRecords],
          auditLogs: [
            makeAudit(
              "maintenance.scheduled",
              "maintenance",
              `Scheduled ${rec.type}: ${rec.title}`,
              rec.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return rec;
      },

      completeMaintenanceRecord: (id, completedDate, cost) => {
        const rec = get().maintenanceRecords.find((m) => m.id === id);
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.map((m) =>
            m.id === id
              ? {
                  ...m,
                  completedDate,
                  cost: cost !== undefined ? cost : m.cost,
                }
              : m
          ),
          auditLogs: [
            makeAudit(
              "maintenance.completed",
              "maintenance",
              `Completed service rule "${rec?.title ?? id}"`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeMaintenanceRecord: (id) => {
        set((state) => ({
          maintenanceRecords: state.maintenanceRecords.filter(
            (m) => m.id !== id
          ),
        }));
      },

      addWorkOrder: (input) => {
        const wo: WorkOrder = {
          ...input,
          id: createId("wo"),
          title: input.title.trim(),
          vendorName: input.vendorName.trim(),
        };
        set((state) => ({
          workOrders: [wo, ...state.workOrders],
          vehicles: state.vehicles.map((v) =>
            v.id === wo.vehicleId && wo.status !== "completed"
              ? { ...v, status: "under_maintenance" }
              : v
          ),
          auditLogs: [
            makeAudit(
              "work_order.created",
              "work_order",
              `Opened work order "${wo.title}" (${wo.priority} priority)`,
              wo.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return wo;
      },

      updateWorkOrderStatus: (id, status, completedAt) => {
        const target = get().workOrders.find((w) => w.id === id);
        set((state) => ({
          workOrders: state.workOrders.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status,
                  completedAt:
                    status === "completed"
                      ? (completedAt ?? new Date().toISOString().slice(0, 10))
                      : w.completedAt,
                }
              : w
          ),
          vehicles:
            status === "completed" && target
              ? state.vehicles.map((v) =>
                  v.id === target.vehicleId && v.status === "under_maintenance"
                    ? { ...v, status: "available" }
                    : v
                )
              : state.vehicles,
          auditLogs: [
            makeAudit(
              "work_order.status_updated",
              "work_order",
              `Updated work order "${target?.title ?? id}" to ${status.replaceAll("_", " ")}`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeWorkOrder: (id) => {
        set((state) => ({
          workOrders: state.workOrders.filter((w) => w.id !== id),
        }));
      },

      addIncident: (input) => {
        const inc: IncidentReport = {
          ...input,
          id: createId("inc"),
          locationLabel: input.locationLabel.trim(),
          description: input.description.trim(),
        };
        const vehicle = get().vehicles.find((v) => v.id === inc.vehicleId);
        const alertItem: FleetAlert = {
          id: createId("alert"),
          severity: inc.severity === "major" ? "critical" : "warning",
          title: `Incident Reported (${inc.severity.toUpperCase()})`,
          message: `${vehicle?.name ?? "Vehicle"} at ${inc.locationLabel}: ${inc.description}`,
          vehicleId: inc.vehicleId,
          timestamp: Date.now(),
          read: false,
        };
        set((state) => ({
          incidents: [inc, ...state.incidents],
          alerts: [alertItem, ...state.alerts].slice(0, 60),
          auditLogs: [
            makeAudit(
              "incident.reported",
              "incident",
              `Reported ${inc.severity} incident at ${inc.locationLabel}`,
              inc.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return inc;
      },

      updateIncidentStatus: (id, status) => {
        set((state) => ({
          incidents: state.incidents.map((inc) =>
            inc.id === id ? { ...inc, status } : inc
          ),
          auditLogs: [
            makeAudit(
              "incident.status_updated",
              "incident",
              `Marked incident ${id} as ${status}`,
              id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeIncident: (id) => {
        set((state) => ({
          incidents: state.incidents.filter((inc) => inc.id !== id),
        }));
      },

      addDriver: (input) => {
        const drv: Driver = {
          ...input,
          id: createId("drv"),
          name: input.name.trim(),
          phone: input.phone.trim(),
          licenseNumber: input.licenseNumber.trim().toUpperCase(),
        };
        set((state) => ({
          drivers: [drv, ...state.drivers],
          auditLogs: [
            makeAudit(
              "driver.added",
              "driver",
              `Registered driver ${drv.name} (${drv.licenseNumber})`,
              drv.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return drv;
      },

      addDriverShift: (driverId, shift) => {
        const newShift: DriverShift = { ...shift, id: createId("sh") };
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? { ...d, shifts: [...(d.shifts ?? []), newShift] }
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
        const newLeave: DriverLeave = { ...leave, id: createId("lv") };
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? { ...d, leaveLogs: [...(d.leaveLogs ?? []), newLeave] }
              : d
          ),
          auditLogs: [
            makeAudit(
              "driver.leave_logged",
              "driver",
              `Logged leave (${leave.reason}: ${leave.fromDate} to ${leave.toDate})`,
              driverId
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
      },

      removeDriverLeave: (driverId, leaveId) => {
        set((state) => ({
          drivers: state.drivers.map((d) =>
            d.id === driverId
              ? {
                  ...d,
                  leaveLogs: (d.leaveLogs ?? []).filter(
                    (l) => l.id !== leaveId
                  ),
                }
              : d
          ),
        }));
      },

      setSelectedVehicle: (vehicleId) => set({ selectedVehicleId: vehicleId }),

      setIsSimulating: (simulating) => set({ isSimulating: simulating }),

      setSimSpeedMultiplier: (speed) => set({ simSpeedMultiplier: speed }),

      startTripForVehicle: (vehicleId, routeId, purpose, preTripChecklist) => {
        const { vehicles, drivers } = get();
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (!vehicle) {
          return { ok: false, error: "Vehicle not found." };
        }
        const effectiveRoute = getRouteById(routeId ?? vehicle.routeId);
        const assignedDriver = drivers.find(
          (d) => d.assignedVehicleId === vehicleId
        );
        return get().startTrip(
          vehicleId,
          purpose?.trim() || `Live Corridor Dispatch — ${effectiveRoute.name}`,
          assignedDriver?.id,
          { preTripChecklist }
        );
      },

      endActiveTripForVehicle: (vehicleId, postTripChecklist) => {
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const vehicle = get().vehicles.find((v) => v.id === vehicleId);
        const finishingTrip = get().trips.find(
          (t) => t.vehicleId === vehicleId && t.status !== "done"
        );
        set((state) => {
          const updatedTrips = state.trips.map((t) =>
            t.vehicleId === vehicleId && t.status !== "done"
              ? {
                  ...t,
                  status: "done" as const,
                  endedAt: nowIso,
                  distanceKm: Math.max(2.4, Number(t.distanceKm.toFixed(2))),
                  maxSpeedKmh: Math.max(54, Number(t.maxSpeedKmh.toFixed(1))),
                  postTripChecklist: postTripChecklist ?? t.postTripChecklist,
                }
              : t
          );
          const nextActive = updatedTrips.find((t) => t.status === "active");
          const linkedBookingId = finishingTrip?.bookingId;
          return {
            trips: updatedTrips,
            activeTripId: nextActive?.id ?? null,
            vehicles: state.vehicles.map((v) =>
              v.id === vehicleId
                ? {
                    ...v,
                    status: "available",
                    lastKnownLocation: v.lastKnownLocation
                      ? { ...v.lastKnownLocation, speed: 0 }
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
                        completedAt: nowIso,
                        tripId: finishingTrip?.id ?? b.tripId,
                      }
                    : b
                )
              : state.bookings,
            alerts: [
              {
                id: createId("alert"),
                severity: "info" as const,
                title: "Trip Completed",
                message: `${vehicle?.name ?? "Vehicle"} finished "${finishingTrip?.purpose ?? "corridor run"}" and returned to standby.`,
                vehicleId,
                timestamp: now,
                read: false,
              },
              ...state.alerts,
            ].slice(0, 60),
            auditLogs: [
              makeAudit(
                "trip.completed",
                "trip",
                `Completed active trip for ${vehicle?.name ?? vehicleId}`,
                finishingTrip?.id ?? vehicleId
              ),
              ...state.auditLogs,
            ].slice(0, 250),
          };
        });
      },

      applySimulationTick: (updates) => {
        if (updates.length === 0) return;
        const byId = new Map(updates.map((u) => [u.vehicleId, u]));

        set((state) => ({
          vehicles: state.vehicles.map((v) => {
            const u = byId.get(v.id);
            if (!u) return v;
            const nextOdometer = Number(
              (v.odometerKm + u.deltaDistanceKm).toFixed(1)
            );
            const currentFuel = v.fuelLevelPercent ?? 75;
            const nextFuel = Math.max(
              8,
              Number((currentFuel - u.deltaFuelPercent).toFixed(1))
            );
            return {
              ...v,
              odometerKm: nextOdometer,
              routeProgress: u.routeProgress,
              fuelLevelPercent: nextFuel,
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
            return {
              ...t,
              distanceKm: Number(
                (t.distanceKm + u.deltaDistanceKm).toFixed(2)
              ),
              maxSpeedKmh: Math.max(
                t.maxSpeedKmh,
                Number(u.speed.toFixed(1))
              ),
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
        const item: FleetAlert = {
          ...alert,
          id: createId("alert"),
          read: false,
        };
        set((state) => ({
          alerts: [item, ...state.alerts].slice(0, 60),
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
        const snapshot = getInitialSnapshot();
        set({
          ...snapshot,
          vehicles:
            Array.isArray(payload.vehicles) && payload.vehicles.length > 0
              ? payload.vehicles
              : snapshot.vehicles,
          trips: Array.isArray(payload.trips) ? payload.trips : snapshot.trips,
          fuelLogs: Array.isArray(payload.fuelLogs)
            ? payload.fuelLogs
            : snapshot.fuelLogs,
          maintenanceRecords: Array.isArray(payload.maintenanceRecords)
            ? payload.maintenanceRecords
            : snapshot.maintenanceRecords,
          drivers: Array.isArray(payload.drivers)
            ? payload.drivers
            : snapshot.drivers,
          complianceDocs: Array.isArray(payload.complianceDocs)
            ? payload.complianceDocs
            : snapshot.complianceDocs,
          bookings: Array.isArray(payload.bookings)
            ? payload.bookings
            : snapshot.bookings,
          expenses: Array.isArray(payload.expenses)
            ? payload.expenses
            : snapshot.expenses,
          workOrders: Array.isArray(payload.workOrders)
            ? payload.workOrders
            : snapshot.workOrders,
          incidents: Array.isArray(payload.incidents)
            ? payload.incidents
            : snapshot.incidents,
        });
      },

      resetDemoData: () => {
        set({
          ...getInitialSnapshot(),
        });
      },
    }),
    {
      name: "tf-mobile-fleet",
      version: 3,
      storage: createJSONStorage(() => safeStateStorage),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<FleetDataSnapshot>;
        const rawBookings = Array.isArray(state.bookings)
          ? (state.bookings as unknown as Array<Record<string, unknown>>).map(
              (raw) => {
                const s = String(raw.status ?? "pending");
                const status: TripBooking["status"] =
                  s === "approved"
                    ? "assigned"
                    : s === "dispatched"
                      ? "in_progress"
                      : s === "assigned" ||
                          s === "in_progress" ||
                          s === "completed" ||
                          s === "rejected"
                        ? (s as TripBooking["status"])
                        : "pending";
                return {
                  ...(raw as unknown as TripBooking),
                  status,
                  pickupLocation:
                    typeof raw.pickupLocation === "string"
                      ? raw.pickupLocation
                      : "Gulshan-2 Central Logistics Hub",
                  dropoffLocation:
                    typeof raw.dropoffLocation === "string"
                      ? raw.dropoffLocation
                      : String(raw.purpose ?? "Destination"),
                };
              }
            )
          : createSeedBookings();
        return {
          ...getInitialSnapshot(),
          ...state,
          bookings: rawBookings,
        };
      },
    }
  )
);
