import type {
  AuditLogEntry,
  ComplianceDocument,
  Driver,
  FleetAlert,
  FuelLog,
  GeofenceZone,
  IncidentReport,
  MaintenanceRecord,
  OperatingExpense,
  Trip,
  TripBooking,
  VectorGeofence,
  Vehicle,
  WorkOrder,
} from "@/types";
import {
  CITY_ROUTES,
  INITIAL_VECTOR_GEOFENCES,
  getRouteById,
} from "@/lib/city-routes";
import {
  interpolateRoutePosition,
  sampleRouteTrackPoints,
} from "@/lib/geo-sim";

export const SEED_BASE_TIME = Date.UTC(2026, 10, 23, 8, 30, 0);

function daysFromBaseIso(days: number): string {
  return new Date(SEED_BASE_TIME + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function buildInitialLocation(routeId: string, progress: number, speed: number) {
  const route = getRouteById(routeId);
  const pos = interpolateRoutePosition(route.waypoints, progress, route, "dhaka");
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    speed,
    heading: pos.headingDeg,
    timestamp: SEED_BASE_TIME,
  };
}

export function createSeedVehicles(): Vehicle[] {
  return [
    {
      id: "veh-1",
      name: "Atlas Hauler 01",
      plate: "FP-8421",
      type: "Truck",
      odometerKm: 48240.5,
      createdAt: "2025-09-12T08:00:00.000Z",
      vin: "JTFSX22P806041291",
      make: "Volvo",
      model: "FH16 Cargo",
      year: 2024,
      fuelType: "Diesel",
      engineCapacityCc: 4800,
      tankCapacityLiters: 180,
      engineHours: 1420,
      status: "on_trip",
      purchaseCost: 68000,
      monthlyDepreciation: 540,
      routeId: "route-1",
      routeProgress: 0.18,
      baseSpeedKmh: 66,
      fuelLevelPercent: 78,
      lastKnownLocation: buildInitialLocation("route-1", 0.18, 66),
    },
    {
      id: "veh-2",
      name: "Vanguard Van 04",
      plate: "FP-3190",
      type: "Van",
      odometerKm: 31582.2,
      createdAt: "2025-10-04T10:15:00.000Z",
      vin: "WDB9066351S842901",
      make: "Mercedes-Benz",
      model: "Sprinter 316 CDI",
      year: 2024,
      fuelType: "Diesel",
      engineCapacityCc: 2143,
      tankCapacityLiters: 75,
      engineHours: 980,
      status: "on_trip",
      purchaseCost: 42000,
      monthlyDepreciation: 350,
      routeId: "route-2",
      routeProgress: 0.42,
      baseSpeedKmh: 58,
      fuelLevelPercent: 64,
      lastKnownLocation: buildInitialLocation("route-2", 0.42, 58),
    },
    {
      id: "veh-3",
      name: "Horizon Cargo 07",
      plate: "FP-5508",
      type: "Truck",
      odometerKm: 62914.8,
      createdAt: "2025-07-21T14:20:00.000Z",
      vin: "1FUJGLDR5CSBM7702",
      make: "Isuzu",
      model: "NQR Freight 7.5T",
      year: 2023,
      fuelType: "Diesel",
      engineCapacityCc: 5193,
      tankCapacityLiters: 140,
      engineHours: 2140,
      status: "on_trip",
      purchaseCost: 56000,
      monthlyDepreciation: 460,
      routeId: "route-3",
      routeProgress: 0.64,
      baseSpeedKmh: 74,
      fuelLevelPercent: 21,
      lastKnownLocation: buildInitialLocation("route-3", 0.64, 74),
    },
    {
      id: "veh-4",
      name: "Pulse Courier 12",
      plate: "FP-1044",
      type: "SUV",
      odometerKm: 19428.0,
      createdAt: "2026-01-09T09:30:00.000Z",
      vin: "JTDKN3DU701829402",
      make: "Toyota",
      model: "RAV4 Fleet Hybrid",
      year: 2025,
      fuelType: "Hybrid",
      engineCapacityCc: 2487,
      tankCapacityLiters: 55,
      engineHours: 510,
      status: "available",
      purchaseCost: 34500,
      monthlyDepreciation: 280,
      routeId: "route-4",
      routeProgress: 0.08,
      baseSpeedKmh: 62,
      fuelLevelPercent: 91,
      lastKnownLocation: buildInitialLocation("route-4", 0.08, 0),
    },
    {
      id: "veh-5",
      name: "Titan Freight 09",
      plate: "FP-9920",
      type: "Truck",
      odometerKm: 84152.4,
      createdAt: "2024-11-18T12:00:00.000Z",
      vin: "MROHA3CD402914588",
      make: "Scania",
      model: "P320 Heavy Hauler",
      year: 2022,
      fuelType: "Diesel",
      engineCapacityCc: 9291,
      tankCapacityLiters: 220,
      engineHours: 3120,
      status: "under_maintenance",
      purchaseCost: 78000,
      monthlyDepreciation: 620,
      routeId: "route-4",
      routeProgress: 0.0,
      baseSpeedKmh: 65,
      fuelLevelPercent: 46,
      lastKnownLocation: buildInitialLocation("route-4", 0.0, 0),
    },
  ];
}

export function createSeedDrivers(): Driver[] {
  return [
    {
      id: "drv-1",
      name: "Marcus Vance",
      phone: "+1 (415) 555-0141",
      licenseNumber: "DL-CA-904821",
      licenseClass: "Class A Commercial",
      licenseExpiry: daysFromBaseIso(240),
      assignedVehicleId: "veh-1",
      assignedVehicleHistory: [
        { vehicleId: "veh-1", assignedAt: "2025-09-12" },
      ],
      shifts: [
        { id: "sh-1", dayOfWeek: 1, startTime: "07:00", endTime: "18:00" },
        { id: "sh-2", dayOfWeek: 2, startTime: "07:00", endTime: "18:00" },
        { id: "sh-3", dayOfWeek: 3, startTime: "07:00", endTime: "18:00" },
        { id: "sh-4", dayOfWeek: 4, startTime: "07:00", endTime: "18:00" },
        { id: "sh-5", dayOfWeek: 5, startTime: "07:00", endTime: "18:00" },
      ],
      leaveLogs: [],
    },
    {
      id: "drv-2",
      name: "Elena Rostova",
      phone: "+1 (415) 555-0182",
      licenseNumber: "DL-CA-612304",
      licenseClass: "Class B Commercial",
      licenseExpiry: daysFromBaseIso(18),
      assignedVehicleId: "veh-2",
      assignedVehicleHistory: [
        { vehicleId: "veh-2", assignedAt: "2025-10-04" },
      ],
      shifts: [
        { id: "sh-6", dayOfWeek: 1, startTime: "08:00", endTime: "19:00" },
        { id: "sh-7", dayOfWeek: 2, startTime: "08:00", endTime: "19:00" },
        { id: "sh-8", dayOfWeek: 3, startTime: "08:00", endTime: "19:00" },
        { id: "sh-9", dayOfWeek: 4, startTime: "08:00", endTime: "19:00" },
        { id: "sh-10", dayOfWeek: 5, startTime: "08:00", endTime: "19:00" },
      ],
      leaveLogs: [
        {
          id: "lv-1",
          fromDate: daysFromBaseIso(5),
          toDate: daysFromBaseIso(7),
          reason: "Annual leave",
        },
      ],
    },
    {
      id: "drv-3",
      name: "Devon Brooks",
      phone: "+1 (415) 555-0194",
      licenseNumber: "DL-CA-778312",
      licenseClass: "Class A Commercial",
      licenseExpiry: daysFromBaseIso(310),
      assignedVehicleId: "veh-3",
      assignedVehicleHistory: [
        { vehicleId: "veh-3", assignedAt: "2025-07-21" },
      ],
      shifts: [
        { id: "sh-11", dayOfWeek: 1, startTime: "06:00", endTime: "16:00" },
        { id: "sh-12", dayOfWeek: 2, startTime: "06:00", endTime: "16:00" },
        { id: "sh-13", dayOfWeek: 3, startTime: "06:00", endTime: "16:00" },
        { id: "sh-14", dayOfWeek: 4, startTime: "06:00", endTime: "16:00" },
        { id: "sh-15", dayOfWeek: 5, startTime: "06:00", endTime: "16:00" },
      ],
      leaveLogs: [],
    },
    {
      id: "drv-4",
      name: "Priya Nair",
      phone: "+1 (415) 555-0129",
      licenseNumber: "DL-CA-445210",
      licenseClass: "Class C Fleet",
      licenseExpiry: daysFromBaseIso(185),
      assignedVehicleId: "veh-4",
      assignedVehicleHistory: [
        { vehicleId: "veh-4", assignedAt: "2026-01-09" },
      ],
      shifts: [
        { id: "sh-16", dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
        { id: "sh-17", dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
        { id: "sh-18", dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
        { id: "sh-19", dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
        { id: "sh-20", dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
      ],
      leaveLogs: [],
    },
    {
      id: "drv-5",
      name: "Carlos Mendez",
      phone: "+1 (415) 555-0166",
      licenseNumber: "DL-CA-339812",
      licenseClass: "Class A Heavy",
      licenseExpiry: daysFromBaseIso(120),
      assignedVehicleId: "veh-5",
      assignedVehicleHistory: [
        { vehicleId: "veh-5", assignedAt: "2024-11-18" },
      ],
      shifts: [],
      leaveLogs: [],
    },
  ];
}

export function createSeedTrips(): Trip[] {
  const r1 = CITY_ROUTES[0];
  const r2 = CITY_ROUTES[1];
  const r3 = CITY_ROUTES[2];
  const r4 = CITY_ROUTES[3];

  const ongoingTrips: Trip[] = [
    {
      id: "trip-live-101",
      vehicleId: "veh-1",
      driverId: "drv-1",
      purpose: "Priority pallet manifest for Hatirjheel & Tejgaon drop-off",
      routeId: r1.id,
      routeName: r1.name,
      status: "active",
      startedAt: new Date(SEED_BASE_TIME - 42 * 60_000).toISOString(),
      distanceKm: 14.8,
      maxSpeedKmh: 76.4,
      points: sampleRouteTrackPoints(
        r1,
        0.18,
        20,
        SEED_BASE_TIME - 42 * 60_000
      ),
      preTripChecklist: {
        phase: "pre",
        completedAt: new Date(SEED_BASE_TIME - 45 * 60_000).toISOString(),
        tiresOk: true,
        lightsOk: true,
        brakesOk: true,
        fluidsOk: true,
        bodyOk: true,
        notes: "All systems verified at Gulshan-2 Central Hub.",
        damagePhotos: [],
      },
      waypoints: [
        {
          id: "wp-stop-1",
          label: "Merul Badda Distribution Dock",
          address: "Plot 14, Pragati Sarani, Badda",
          lat: 23.7885,
          lng: 90.4257,
          arrivedAt: new Date(SEED_BASE_TIME - 18 * 60_000).toISOString(),
          recipientName: "Tanvir Hossain",
        },
        {
          id: "wp-stop-2",
          label: "Tejgaon Cold-Storage Depot",
          address: "22 Shaheed Tajuddin Ave, Tejgaon",
          lat: 23.7654,
          lng: 90.4089,
        },
        {
          id: "wp-stop-3",
          label: "Gulshan-1 Corporate Exchange",
          address: "Tower B, Gulshan Avenue South",
          lat: 23.7809,
          lng: 90.4068,
        },
      ],
      safetyMetrics: {
        harshBrakingCount: 0,
        speedingIncidents: 0,
        idleMinutes: 4,
        onTime: true,
      },
    },
    {
      id: "trip-live-102",
      vehicleId: "veh-2",
      driverId: "drv-2",
      purpose: "Cold-chain medical supply run to Tejgaon Industrial Park",
      routeId: r2.id,
      routeName: r2.name,
      status: "active",
      startedAt: new Date(SEED_BASE_TIME - 58 * 60_000).toISOString(),
      distanceKm: 21.3,
      maxSpeedKmh: 69.2,
      points: sampleRouteTrackPoints(
        r2,
        0.42,
        22,
        SEED_BASE_TIME - 58 * 60_000
      ),
      waypoints: [
        {
          id: "wp-stop-4",
          label: "Mohakhali Pharma Hub",
          address: "88 New Airport Road, Mohakhali",
          lat: 23.7776,
          lng: 90.3982,
        },
      ],
      safetyMetrics: {
        harshBrakingCount: 0,
        speedingIncidents: 0,
        idleMinutes: 6,
        onTime: true,
      },
    },
    {
      id: "trip-live-103",
      vehicleId: "veh-3",
      driverId: "drv-3",
      purpose: "Express air cargo transfer from Airport & Kuril Terminal",
      routeId: r3.id,
      routeName: r3.name,
      status: "active",
      startedAt: new Date(SEED_BASE_TIME - 74 * 60_000).toISOString(),
      distanceKm: 28.6,
      maxSpeedKmh: 88.5,
      points: sampleRouteTrackPoints(
        r3,
        0.64,
        24,
        SEED_BASE_TIME - 74 * 60_000
      ),
      safetyMetrics: {
        harshBrakingCount: 1,
        speedingIncidents: 1,
        idleMinutes: 5,
        onTime: true,
      },
    },
  ];

  const completedSpecs = [
    {
      id: "trip-done-104",
      vehicleId: "veh-4",
      driverId: "drv-4",
      purpose: "Morning perimeter dispatch completed ahead of schedule",
      route: r4,
      daysAgo: 0,
      durationMin: 45,
      distanceKm: 28.9,
      maxSpeedKmh: 72.1,
      harsh: 0,
      speeding: 0,
      idle: 5,
      onTime: true,
    },
    {
      id: "trip-done-105",
      vehicleId: "veh-1",
      driverId: "drv-1",
      purpose: "Central Logistics Hub morning replenishment",
      route: r1,
      daysAgo: 1,
      durationMin: 36,
      distanceKm: 18.4,
      maxSpeedKmh: 74.2,
      harsh: 0,
      speeding: 0,
      idle: 6,
      onTime: true,
    },
    {
      id: "trip-done-106",
      vehicleId: "veh-2",
      driverId: "drv-2",
      purpose: "North Industrial Park pharmaceutical shuttle",
      route: r2,
      daysAgo: 2,
      durationMin: 42,
      distanceKm: 24.6,
      maxSpeedKmh: 66.8,
      harsh: 1,
      speeding: 0,
      idle: 8,
      onTime: true,
    },
    {
      id: "trip-done-107",
      vehicleId: "veh-3",
      driverId: "drv-3",
      purpose: "Airport Cargo Zone overnight freight linehaul",
      route: r3,
      daysAgo: 3,
      durationMin: 48,
      distanceKm: 32.1,
      maxSpeedKmh: 82.0,
      harsh: 0,
      speeding: 1,
      idle: 7,
      onTime: true,
    },
    {
      id: "trip-done-108",
      vehicleId: "veh-1",
      driverId: "drv-1",
      purpose: "Gulshan – Hatirjheel Express high-priority freight",
      route: r1,
      daysAgo: 4,
      durationMin: 34,
      distanceKm: 19.2,
      maxSpeedKmh: 71.3,
      harsh: 0,
      speeding: 0,
      idle: 5,
      onTime: true,
    },
  ];

  const completedTrips: Trip[] = completedSpecs.map((spec) => {
    const startMs = SEED_BASE_TIME - spec.daysAgo * 86_400_000 - 240 * 60_000;
    const endMs = startMs + spec.durationMin * 60_000;
    return {
      id: spec.id,
      vehicleId: spec.vehicleId,
      driverId: spec.driverId,
      purpose: spec.purpose,
      routeId: spec.route.id,
      routeName: spec.route.name,
      status: "done",
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      distanceKm: spec.distanceKm,
      maxSpeedKmh: spec.maxSpeedKmh,
      points: sampleRouteTrackPoints(spec.route, 0.98, 20, startMs),
      safetyMetrics: {
        harshBrakingCount: spec.harsh,
        speedingIncidents: spec.speeding,
        idleMinutes: spec.idle,
        onTime: spec.onTime,
      },
    };
  });

  return [...ongoingTrips, ...completedTrips];
}

export function createSeedAlerts(): FleetAlert[] {
  return [
    {
      id: "alert-1",
      severity: "critical",
      title: "Low Fuel Threshold Breached",
      message:
        "Horizon Cargo 07 (FP-5508) fuel dropped to 21% along Airport Cargo Express.",
      vehicleId: "veh-3",
      timestamp: SEED_BASE_TIME - 11 * 60_000,
      read: false,
    },
    {
      id: "alert-2",
      severity: "warning",
      title: "Service Bay Hold Active",
      message:
        "Titan Freight 09 (FP-9920) is locked in Maintenance for brake overhaul.",
      vehicleId: "veh-5",
      timestamp: SEED_BASE_TIME - 38 * 60_000,
      read: false,
    },
    {
      id: "alert-3",
      severity: "info",
      title: "Geofence Zone Entry",
      message:
        "Atlas Hauler 01 (FP-8421) departed Central Logistics Hub on RT-101.",
      vehicleId: "veh-1",
      timestamp: SEED_BASE_TIME - 52 * 60_000,
      read: true,
    },
  ];
}

export function createSeedComplianceDocs(): ComplianceDocument[] {
  return [
    {
      id: "comp-1",
      vehicleId: "veh-1",
      docType: "insurance",
      documentNumber: "INS-FP-2026-8421",
      issuer: "Pacific Commercial Underwriters",
      issueDate: daysFromBaseIso(-350),
      expiryDate: daysFromBaseIso(6),
      cost: 680,
      notes: "Comprehensive commercial cargo coverage",
    },
    {
      id: "comp-2",
      vehicleId: "veh-2",
      docType: "fitness",
      documentNumber: "FIT-DOT-3190",
      issuer: "BRTA / DOT Commercial Safety",
      issueDate: daysFromBaseIso(-340),
      expiryDate: daysFromBaseIso(24),
      cost: 140,
    },
    {
      id: "comp-3",
      vehicleId: "veh-3",
      docType: "registration",
      documentNumber: "REG-2026-5508",
      issuer: "Metro Fleet Registry",
      issueDate: daysFromBaseIso(-352),
      expiryDate: daysFromBaseIso(13),
      cost: 220,
    },
    {
      id: "comp-4",
      vehicleId: "veh-5",
      docType: "route_permit",
      documentNumber: "RP-HARBOR-9920",
      issuer: "Regional Transport Authority",
      issueDate: daysFromBaseIso(-300),
      expiryDate: daysFromBaseIso(65),
      cost: 195,
    },
  ];
}

export function createSeedFuelLogs(): FuelLog[] {
  return [
    {
      id: "fuel-1",
      vehicleId: "veh-1",
      date: daysFromBaseIso(-1),
      liters: 142.5,
      pricePerLiter: 1.67,
      totalCost: 238.4,
      odometerKm: 48020,
      fullTank: true,
      station: "Shell Fleet Hub #14 (Tejgaon)",
    },
    {
      id: "fuel-2",
      vehicleId: "veh-2",
      date: daysFromBaseIso(-2),
      liters: 68.0,
      pricePerLiter: 1.65,
      totalCost: 112.2,
      odometerKm: 31310,
      fullTank: true,
      station: "Padma Industrial Station (Mohakhali)",
    },
    {
      id: "fuel-3",
      vehicleId: "veh-4",
      date: daysFromBaseIso(-3),
      liters: 54.4,
      pricePerLiter: 1.65,
      totalCost: 89.76,
      odometerKm: 19360,
      fullTank: true,
      station: "Meghna Express Fuel (Gulshan)",
    },
    {
      id: "fuel-4",
      vehicleId: "veh-1",
      date: daysFromBaseIso(-9),
      liters: 135.0,
      pricePerLiter: 1.64,
      totalCost: 221.4,
      odometerKm: 47480,
      fullTank: true,
      station: "Shell Fleet Hub #14 (Tejgaon)",
    },
  ];
}

export function createSeedExpenses(): OperatingExpense[] {
  return [
    {
      id: "exp-1",
      vehicleId: "veh-1",
      tripId: "trip-live-101",
      date: daysFromBaseIso(0),
      category: "Tolls",
      amount: 18.5,
      costCenter: "Logistics-Expressway",
      description: "Elevated Expressway commercial freight toll pass",
    },
    {
      id: "exp-2",
      vehicleId: "veh-2",
      tripId: "trip-live-102",
      date: daysFromBaseIso(-1),
      category: "Parking",
      amount: 12.0,
      costCenter: "Medical-ColdChain",
      description: "Tejgaon Industrial Park loading dock fee",
    },
    {
      id: "exp-3",
      vehicleId: "veh-3",
      date: daysFromBaseIso(-3),
      category: "Driver allowance",
      amount: 32.0,
      costCenter: "Airport-Cargo",
      description: "Overnight air-cargo staging meal allowance",
    },
  ];
}

export function createSeedMaintenance(): MaintenanceRecord[] {
  return [
    {
      id: "maint-1",
      vehicleId: "veh-3",
      title: "65,000 km Preventive Inspection & Oil Change",
      type: "Oil change",
      scheduledDate: daysFromBaseIso(3),
      dueOdometerKm: 65000,
      dueEngineHours: 2250,
      intervalKm: 5000,
      intervalDays: 90,
      intervalEngineHours: 250,
      cost: 485,
    },
    {
      id: "maint-2",
      vehicleId: "veh-5",
      title: "Air Brake Compressor & Rotor Overhaul",
      type: "Brake inspection",
      scheduledDate: daysFromBaseIso(-2),
      dueOdometerKm: 84000,
      dueEngineHours: 3100,
      intervalKm: 10000,
      intervalDays: 180,
      cost: 1240,
    },
    {
      id: "maint-3",
      vehicleId: "veh-1",
      title: "All-Season Drive Axle Tire Replacement",
      type: "Tire service",
      scheduledDate: daysFromBaseIso(-5),
      completedDate: daysFromBaseIso(-5),
      dueOdometerKm: 48000,
      intervalKm: 20000,
      intervalDays: 180,
      cost: 920,
    },
  ];
}

export function createSeedWorkOrders(): WorkOrder[] {
  return [
    {
      id: "wo-1",
      vehicleId: "veh-5",
      title: "Air Brake Compressor & Rotor Overhaul",
      status: "in_progress",
      priority: "high",
      vendorName: "Apex Heavy Diesel Service",
      mechanicPhone: "+1 (415) 555-0199",
      openedAt: daysFromBaseIso(-2),
      downtimeHours: 18,
      warrantyUntil: daysFromBaseIso(180),
      parts: [
        {
          id: "pt-1",
          name: "Heavy Duty Brake Compressor",
          qty: 1,
          unitCost: 680,
        },
        { id: "pt-2", name: "Ventilated Front Rotor", qty: 2, unitCost: 195 },
      ],
      laborCost: 170,
      notes: "Pressure test and road calibration scheduled prior to release.",
    },
  ];
}

export function createSeedIncidents(): IncidentReport[] {
  return [
    {
      id: "inc-1",
      vehicleId: "veh-5",
      driverId: "drv-5",
      occurredAt: daysFromBaseIso(-6),
      severity: "minor",
      status: "investigating",
      locationLabel: "Tejgaon Freight Terminal Gate B",
      lat: 23.7654,
      lng: 90.4052,
      description:
        "Rear bumper scuff while reversing into container loading bay 4.",
      thirdPartyName: "Terminal Guardrail",
      estimatedCost: 240,
      photos: [],
    },
  ];
}

export function createSeedBookings(): TripBooking[] {
  return [
    {
      id: "book-1",
      requesterUserId: "user-employee",
      requesterName: "Nadia Karim",
      department: "Supply Chain",
      purpose: "Gulshan Hub cold-chain restock run",
      pickupLocation: "Gulshan-2 Central Logistics Hub",
      dropoffLocation: "Tejgaon Cold-Storage Depot",
      requestedDate: daysFromBaseIso(1),
      requestedTime: "10:00",
      passengerCount: 1,
      estimatedKm: 24,
      status: "pending",
      notes: "Requires temperature-controlled cargo bay — awaiting Admin driver assignment.",
      createdAt: new Date(SEED_BASE_TIME - 3_600_000 * 2).toISOString(),
    },
    {
      id: "book-2",
      requesterUserId: "user-employee",
      requesterName: "Nadia Karim",
      department: "Operations",
      purpose: "Airport VIP cargo staging shuttle",
      pickupLocation: "Banani Corporate HQ, Road 11",
      dropoffLocation: "Hazrat Shahjalal Airport Cargo Gate 4",
      requestedDate: daysFromBaseIso(0),
      requestedTime: "14:30",
      passengerCount: 2,
      estimatedKm: 32,
      vehicleId: "veh-4",
      driverId: "drv-1",
      status: "assigned",
      approvedBy: "Sarah Chen",
      assignedBy: "Sarah Chen",
      assignedAt: new Date(SEED_BASE_TIME - 3_600_000 * 3).toISOString(),
      notes: "Assigned to Marcus Vance — ready for pre-trip walkaround & start.",
      createdAt: new Date(SEED_BASE_TIME - 3_600_000 * 6).toISOString(),
    },
    {
      id: "book-3",
      requesterUserId: "user-employee",
      requesterName: "Nadia Karim",
      department: "Client Relations",
      purpose: "Uttara Sector-7 express document & parcel run",
      pickupLocation: "Gulshan-1 Exchange Tower",
      dropoffLocation: "Uttara Sector-7 Commercial Hub",
      requestedDate: daysFromBaseIso(-1),
      requestedTime: "09:15",
      passengerCount: 1,
      estimatedKm: 19,
      vehicleId: "veh-4",
      driverId: "drv-4",
      status: "completed",
      approvedBy: "Alex Morgan",
      assignedBy: "Alex Morgan",
      assignedAt: new Date(SEED_BASE_TIME - 3_600_000 * 26).toISOString(),
      startedAt: new Date(SEED_BASE_TIME - 3_600_000 * 25).toISOString(),
      completedAt: new Date(SEED_BASE_TIME - 3_600_000 * 24).toISOString(),
      tripId: "trip-hist-1",
      createdAt: new Date(SEED_BASE_TIME - 3_600_000 * 28).toISOString(),
    },
  ];
}

export function createSeedGeofences(): GeofenceZone[] {
  return [
    {
      id: "geo-hub-central",
      name: "Central Logistics Hub (Gulshan-2)",
      type: "warehouse",
      polygon: [
        { lat: 23.798, lng: 90.41 },
        { lat: 23.798, lng: 90.419 },
        { lat: 23.79, lng: 90.419 },
        { lat: 23.79, lng: 90.41 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: true,
    },
    {
      id: "geo-industrial-north",
      name: "Tejgaon Industrial Park",
      type: "client_site",
      polygon: [
        { lat: 23.77, lng: 90.4 },
        { lat: 23.77, lng: 90.412 },
        { lat: 23.76, lng: 90.412 },
        { lat: 23.76, lng: 90.4 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: false,
    },
  ];
}

export function createSeedVectorGeofences(): VectorGeofence[] {
  return INITIAL_VECTOR_GEOFENCES.map((g) => ({ ...g }));
}

export function createSeedAuditLogs(): AuditLogEntry[] {
  return [
    {
      id: "audit-seed-1",
      timestamp: new Date(SEED_BASE_TIME - 18 * 60_000).toISOString(),
      actorId: "user-driver",
      actorName: "Marcus Vance",
      actorRole: "driver",
      action: "trip.pod_completed",
      entityType: "trip",
      entityId: "trip-live-101",
      summary:
        "Captured Proof of Delivery at Merul Badda Distribution Dock (signed by Tanvir Hossain)",
    },
    {
      id: "audit-seed-2",
      timestamp: new Date(SEED_BASE_TIME - 42 * 60_000).toISOString(),
      actorId: "user-dispatcher",
      actorName: "Sarah Chen",
      actorRole: "dispatcher",
      action: "trip.started",
      entityType: "trip",
      entityId: "trip-live-101",
      summary: "Dispatched Atlas Hauler 01 (FP-8421) on RT-101 Express Loop",
    },
    {
      id: "audit-seed-3",
      timestamp: new Date(SEED_BASE_TIME - 120 * 60_000).toISOString(),
      actorId: "user-mechanic",
      actorName: "Kamrul Islam",
      actorRole: "mechanic",
      action: "work_order.updated",
      entityType: "work_order",
      entityId: "wo-1",
      summary:
        "Marked Air Brake Compressor & Rotor Overhaul (Titan Freight 09) as In Progress",
    },
  ];
}
