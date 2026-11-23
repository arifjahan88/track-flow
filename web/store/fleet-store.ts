"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AuditLogEntry,
  ComplianceDocument,
  Driver,
  DriverLeave,
  DriverShift,
  FleetExportPayload,
  FuelLog,
  GeofenceAlert,
  GeofenceZone,
  IncidentReport,
  IncidentStatus,
  MaintenanceRecord,
  MaintenanceType,
  OperatingExpense,
  TrackPoint,
  Trip,
  TripBooking,
  TripChecklist,
  TripWaypoint,
  UserRole,
  Vehicle,
  VehicleLifecycleStatus,
  WorkOrder,
  WorkOrderStatus,
} from "@/types";
import { haversineKm, isUsefulPoint, SIM_ROUTE } from "@/lib/geo";
import { evaluateGeofenceTransitions } from "@/lib/geofence";
import { useAuthStore } from "@/store/auth-store";

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
    harshBraking: number;
    speeding: number;
    idleMinutes: number;
    onTime: boolean;
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 6,
      onTime: true,
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
      harshBraking: 1,
      speeding: 1,
      idleMinutes: 9,
      onTime: true,
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 5,
      onTime: true,
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
      harshBraking: 1,
      speeding: 0,
      idleMinutes: 11,
      onTime: true,
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
      harshBraking: 0,
      speeding: 1,
      idleMinutes: 8,
      onTime: true,
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 4,
      onTime: true,
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 7,
      onTime: true,
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
      harshBraking: 1,
      speeding: 1,
      idleMinutes: 14,
      onTime: false,
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 6,
      onTime: true,
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
      harshBraking: 0,
      speeding: 0,
      idleMinutes: 5,
      onTime: true,
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
      harshBraking: 1,
      speeding: 0,
      idleMinutes: 10,
      onTime: true,
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
      safetyMetrics: {
        harshBrakingCount: spec.harshBraking,
        speedingIncidents: spec.speeding,
        idleMinutes: spec.idleMinutes,
        onTime: spec.onTime,
      },
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
      vin: "JTFSX22P806041291",
      make: "Toyota",
      model: "HiAce Super GL",
      year: 2023,
      fuelType: "Diesel",
      engineCapacityCc: 2755,
      tankCapacityLiters: 65,
      engineHours: 1420,
      status: "available",
      purchaseCost: 34000,
      monthlyDepreciation: 320,
    },
    {
      id: "veh-sedan-3390",
      name: "Office Sedan",
      plate: "DHA-12-3390",
      type: "Sedan",
      odometerKm: 29140,
      createdAt: "2026-02-05T09:30:00.000Z",
      vin: "JTDKN3DU701829402",
      make: "Toyota",
      model: "Corolla Axio Hybrid",
      year: 2024,
      fuelType: "Hybrid",
      engineCapacityCc: 1496,
      tankCapacityLiters: 42,
      engineHours: 780,
      status: "available",
      purchaseCost: 24500,
      monthlyDepreciation: 210,
    },
    {
      id: "veh-pickup-7781",
      name: "Pickup",
      plate: "DHA-14-7781",
      type: "Pickup",
      odometerKm: 63890,
      createdAt: "2026-03-14T11:15:00.000Z",
      vin: "MROHA3CD402914588",
      make: "Mitsubishi",
      model: "L200 Triton 4WD",
      year: 2022,
      fuelType: "Diesel",
      engineCapacityCc: 2442,
      tankCapacityLiters: 75,
      engineHours: 2150,
      status: "under_maintenance",
      purchaseCost: 38500,
      monthlyDepreciation: 360,
    },
  ];
}

export function createSeedComplianceDocs(): ComplianceDocument[] {
  return [
    {
      id: "comp-1",
      vehicleId: "veh-van-2045",
      docType: "insurance",
      documentNumber: "INS-BD-2026-8841",
      issuer: "Green Delta Insurance",
      issueDate: daysFromNowIso(-350),
      expiryDate: daysFromNowIso(6),
      cost: 420,
      notes: "Comprehensive commercial cargo coverage",
    },
    {
      id: "comp-2",
      vehicleId: "veh-van-2045",
      docType: "fitness",
      documentNumber: "FIT-BRTA-44021",
      issuer: "BRTA Dhaka Metro",
      issueDate: daysFromNowIso(-340),
      expiryDate: daysFromNowIso(24),
      cost: 110,
    },
    {
      id: "comp-3",
      vehicleId: "veh-sedan-3390",
      docType: "registration",
      documentNumber: "TAX-2026-3390",
      issuer: "BRTA Tax Token",
      issueDate: daysFromNowIso(-352),
      expiryDate: daysFromNowIso(13),
      cost: 180,
    },
    {
      id: "comp-4",
      vehicleId: "veh-pickup-7781",
      docType: "route_permit",
      documentNumber: "RP-DHK-7781-C",
      issuer: "Metro Transport Authority",
      issueDate: daysFromNowIso(-300),
      expiryDate: daysFromNowIso(65),
      cost: 150,
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
      licenseClass: "Heavy Commercial (Class C)",
      licenseExpiry: daysFromNowIso(240),
      assignedVehicleId: "veh-van-2045",
      assignedVehicleHistory: [
        {
          vehicleId: "veh-pickup-7781",
          assignedAt: "2025-09-01",
          unassignedAt: "2026-01-09",
        },
        {
          vehicleId: "veh-van-2045",
          assignedAt: "2026-01-10",
        },
      ],
      shifts: [
        { id: "sh-1", dayOfWeek: 0, startTime: "07:00", endTime: "18:00" },
        { id: "sh-2", dayOfWeek: 1, startTime: "07:00", endTime: "18:00" },
        { id: "sh-3", dayOfWeek: 2, startTime: "07:00", endTime: "18:00" },
        { id: "sh-4", dayOfWeek: 3, startTime: "07:00", endTime: "18:00" },
        { id: "sh-5", dayOfWeek: 4, startTime: "07:00", endTime: "18:00" },
        { id: "sh-6", dayOfWeek: 6, startTime: "08:00", endTime: "16:00" },
      ],
      leaveLogs: [],
    },
    {
      id: "drv-nadia",
      name: "Nadia Karim",
      phone: "+880 1819-876543",
      licenseNumber: "DL-DHK-612304",
      licenseClass: "Light Motor (Class B)",
      licenseExpiry: daysFromNowIso(18),
      assignedVehicleId: "veh-sedan-3390",
      assignedVehicleHistory: [
        {
          vehicleId: "veh-sedan-3390",
          assignedAt: "2026-02-05",
        },
      ],
      shifts: [
        { id: "sh-7", dayOfWeek: 0, startTime: "08:30", endTime: "19:30" },
        { id: "sh-8", dayOfWeek: 1, startTime: "08:30", endTime: "19:30" },
        { id: "sh-9", dayOfWeek: 2, startTime: "08:30", endTime: "19:30" },
        { id: "sh-10", dayOfWeek: 3, startTime: "08:30", endTime: "19:30" },
        { id: "sh-11", dayOfWeek: 4, startTime: "08:30", endTime: "19:30" },
      ],
      leaveLogs: [
        {
          id: "lv-1",
          fromDate: daysFromNowIso(5),
          toDate: daysFromNowIso(7),
          reason: "Annual leave",
        },
      ],
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
      station: "Gulshan Ave Filling Station",
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
      station: "Tejgaon Central Fuel Hub",
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
      station: "Banani Express Station",
    },
  ];
}

export function createSeedExpenses(): OperatingExpense[] {
  return [
    {
      id: "exp-1",
      vehicleId: "veh-van-2045",
      tripId: "trip-seed-1",
      date: daysFromNowIso(-1),
      category: "Tolls",
      amount: 14.5,
      costCenter: "Logistics-North",
      description: "Elevated expressway & bridge toll pass",
    },
    {
      id: "exp-2",
      vehicleId: "veh-sedan-3390",
      tripId: "trip-seed-2",
      date: daysFromNowIso(-2),
      category: "Parking",
      amount: 8.0,
      costCenter: "Executive-Ops",
      description: "Airport terminal short-stay parking",
    },
    {
      id: "exp-3",
      vehicleId: "veh-pickup-7781",
      date: daysFromNowIso(-4),
      category: "Driver allowance",
      amount: 25.0,
      costCenter: "Field-Engineering",
      description: "Late-shift loading crew meal allowance",
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
      dueEngineHours: 1450,
      intervalKm: 5000,
      intervalDays: 90,
      intervalEngineHours: 250,
      cost: 85,
    },
    {
      id: "maint-2",
      vehicleId: "veh-pickup-7781",
      title: "Brake pad inspection",
      type: "Brake inspection",
      scheduledDate: daysFromNowIso(-3),
      dueOdometerKm: 63800,
      dueEngineHours: 2140,
      intervalKm: 10000,
      intervalDays: 180,
      cost: 120,
    },
    {
      id: "maint-3",
      vehicleId: "veh-sedan-3390",
      title: "Tire rotation and balance",
      type: "Tire service",
      scheduledDate: daysFromNowIso(45),
      dueOdometerKm: 32000,
      intervalKm: 8000,
      intervalDays: 120,
      cost: 60,
    },
  ];
}

export function createSeedWorkOrders(): WorkOrder[] {
  return [
    {
      id: "wo-1",
      vehicleId: "veh-pickup-7781",
      title: "Front brake caliper & rotor replacement",
      status: "in_progress",
      priority: "high",
      vendorName: "Dhaka Fleet Motors Garage",
      mechanicPhone: "+880 1755-908112",
      openedAt: daysFromNowIso(-2),
      downtimeHours: 18,
      warrantyUntil: daysFromNowIso(180),
      parts: [
        { id: "pt-1", name: "Ceramic Brake Pad Set", qty: 1, unitCost: 78 },
        { id: "pt-2", name: "Ventilated Front Rotor", qty: 2, unitCost: 65 },
      ],
      laborCost: 90,
      notes: "Test drive scheduled after bleed and torque check.",
    },
  ];
}

export function createSeedIncidents(): IncidentReport[] {
  return [
    {
      id: "inc-1",
      vehicleId: "veh-pickup-7781",
      driverId: "drv-rafiq",
      occurredAt: daysFromNowIso(-6),
      severity: "minor",
      status: "investigating",
      locationLabel: "Tejgaon Industrial Link Rd",
      lat: 23.7645,
      lng: 90.4021,
      description: "Rear bumper scuff while reversing into loading dock bay 3.",
      thirdPartyName: "Warehouse Dock Barrier",
      estimatedCost: 145,
      photos: [],
    },
  ];
}

export function createSeedBookings(): TripBooking[] {
  return [
    {
      id: "book-1",
      requesterName: "Samira Chowdhury",
      department: "Supply Chain",
      purpose: "Gulshan cold-chain restock run",
      requestedDate: daysFromNowIso(1),
      estimatedKm: 24,
      vehicleId: "veh-van-2045",
      driverId: "drv-rafiq",
      status: "pending",
      notes: "Requires insulated cargo bay",
      createdAt: new Date().toISOString(),
    },
    {
      id: "book-2",
      requesterName: "Arif Mahmud",
      department: "Operations",
      purpose: "Airport VIP client pickup",
      requestedDate: daysFromNowIso(2),
      estimatedKm: 32,
      vehicleId: "veh-sedan-3390",
      driverId: "drv-nadia",
      status: "approved",
      approvedBy: "Demo Admin",
      createdAt: new Date().toISOString(),
    },
  ];
}

export function createSeedGeofences(): GeofenceZone[] {
  return [
    {
      id: "geo-warehouse-gulshan",
      name: "Gulshan Dispatch Hub",
      type: "warehouse",
      polygon: [
        { lat: 23.7965, lng: 90.4045 },
        { lat: 23.7965, lng: 90.4125 },
        { lat: 23.7895, lng: 90.4125 },
        { lat: 23.7895, lng: 90.4045 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: true,
    },
    {
      id: "geo-client-banani",
      name: "Banani Client Zone",
      type: "client_site",
      polygon: [
        { lat: 23.7985, lng: 90.413 },
        { lat: 23.7985, lng: 90.422 },
        { lat: 23.7915, lng: 90.422 },
        { lat: 23.7915, lng: 90.413 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: false,
    },
    {
      id: "geo-restricted-hatirjheel",
      name: "Hatirjheel After-Hours Restricted",
      type: "restricted",
      polygon: [
        { lat: 23.7765, lng: 90.411 },
        { lat: 23.7765, lng: 90.423 },
        { lat: 23.7675, lng: 90.423 },
        { lat: 23.7675, lng: 90.411 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: false,
      afterHoursOnly: false,
      allowedStartHour: 6,
      allowedEndHour: 22,
    },
  ];
}

export function createSeedAuditLogs(): AuditLogEntry[] {
  return [
    {
      id: "audit-seed-1",
      timestamp: new Date(Date.now() - 3_600_000 * 6).toISOString(),
      actorId: "user-demo-admin",
      actorName: "Demo Admin",
      actorRole: "super_admin",
      action: "booking.approved",
      entityType: "booking",
      entityId: "book-2",
      summary: "Approved booking 'Airport VIP client pickup' for Office Sedan",
    },
    {
      id: "audit-seed-2",
      timestamp: new Date(Date.now() - 3_600_000 * 14).toISOString(),
      actorId: "user-mechanic",
      actorName: "Kamrul Islam",
      actorRole: "mechanic",
      action: "work_order.opened",
      entityType: "work_order",
      entityId: "wo-1",
      summary: "Opened work order 'Front brake caliper & rotor replacement' (Pickup)",
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
  complianceDocs: ComplianceDocument[];
  bookings: TripBooking[];
  geofences: GeofenceZone[];
  geofenceAlerts: GeofenceAlert[];
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
  updateBookingStatus: (
    id: string,
    status: TripBooking["status"],
    updates?: { vehicleId?: string; driverId?: string; approvedBy?: string }
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
      expenses: [],
      workOrders: [],
      incidents: [],
      auditLogs: [],
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
    complianceDocs: Array.isArray(state.complianceDocs)
      ? state.complianceDocs
      : createSeedComplianceDocs(),
    bookings: Array.isArray(state.bookings)
      ? state.bookings
      : createSeedBookings(),
    geofences: Array.isArray(state.geofences)
      ? state.geofences
      : createSeedGeofences(),
    geofenceAlerts: Array.isArray(state.geofenceAlerts)
      ? state.geofenceAlerts
      : [],
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
  return {
    vehicles: createSeedVehicles(),
    trips: createSeedTrips(),
    activeTripId: null,
    fuelLogs: createSeedFuelLogs(),
    maintenanceRecords: createSeedMaintenance(),
    drivers: createSeedDrivers(),
    complianceDocs: createSeedComplianceDocs(),
    bookings: createSeedBookings(),
    geofences: createSeedGeofences(),
    geofenceAlerts: [],
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
        const { activeTripId, trips, vehicles } = get();
        const hasOpenTrip =
          activeTripId !== null || trips.some((t) => t.status !== "done");
        if (hasOpenTrip) {
          return {
            ok: false,
            error: "Finish or end the current trip before starting another.",
          };
        }
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (!vehicle) {
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
          vehicles: state.vehicles.map((v) =>
            v.id === vehicleId ? { ...v, status: "on_trip" } : v
          ),
          bookings: options?.bookingId
            ? state.bookings.map((b) =>
                b.id === options.bookingId
                  ? { ...b, status: "dispatched" }
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
        const booking: TripBooking = {
          ...input,
          id: `book-${crypto.randomUUID()}`,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          bookings: [booking, ...state.bookings],
          auditLogs: [
            makeAudit(
              "booking.requested",
              "booking",
              `Submitted vehicle booking "${booking.purpose}" by ${booking.requesterName}`,
              booking.id
            ),
            ...state.auditLogs,
          ].slice(0, 250),
        }));
        return booking;
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
                    status === "approved"
                      ? updates?.approvedBy ?? actor.actorName
                      : b.approvedBy,
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
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) =>
        migrateFleetState(persistedState, version),
    }
  )
);
