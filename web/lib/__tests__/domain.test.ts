import { describe, expect, it } from "vitest";
import {
  computeBearingDegrees,
  formatCardinalDirection,
  haversineKm,
  isUsefulPoint,
  ROUTE_WAYPOINTS,
  SIM_ROUTE,
} from "@/lib/geo";
import {
  computeFuelEfficiency,
  detectFuelAnomalies,
  getAverageEfficiency,
  kmPerLiterToMpg,
} from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import {
  checkDriverAvailability,
  computeDriverSafetyScore,
  getLicenseStatus,
} from "@/lib/drivers";
import { getComplianceStatus } from "@/lib/compliance";
import {
  evaluateGeofenceTransitions,
  isPointInPolygon,
} from "@/lib/geofence";
import { computeUtilization, computeVehicleTco } from "@/lib/analytics";
import { can } from "@/lib/rbac";
import { formatShortDate, parseIsoDate, toIsoDate } from "@/lib/format";
import { paginateItems } from "@/components/table-pagination";
import type {
  Driver,
  FuelLog,
  GeofenceZone,
  MaintenanceRecord,
  Trip,
  Vehicle,
} from "@/types";

describe("geo utilities", () => {
  it("computes a known short Dhaka distance accurately", () => {
    // Gulshan 2 circle to Banani 11 (~1.1 - 1.3 km)
    const dist = haversineKm(
      { lat: 23.7925, lng: 90.4078 },
      { lat: 23.796, lng: 90.415 }
    );
    expect(dist).toBeGreaterThan(0.7);
    expect(dist).toBeLessThan(1.0);
  });

  it("rejects points closer than 3 meters", () => {
    const origin = { lat: 23.7925, lng: 90.4078 };
    const veryClose = { lat: 23.79251, lng: 90.40781 }; // ~1.5 m
    const further = { lat: 23.7926, lng: 90.4078 }; // ~11 m

    expect(isUsefulPoint(undefined, origin)).toBe(true);
    expect(isUsefulPoint(origin, veryClose)).toBe(false);
    expect(isUsefulPoint(origin, further)).toBe(true);
  });

  it("builds SIM_ROUTE with 60 interpolated points per segment plus final point", () => {
    expect(SIM_ROUTE.length).toBe(6 * 60 + 1);
    expect(ROUTE_WAYPOINTS).toHaveLength(7);
  });

  it("computes compass bearing degrees and cardinal directions accurately", () => {
    const north = computeBearingDegrees(
      { lat: 23.78, lng: 90.41 },
      { lat: 23.79, lng: 90.41 }
    );
    const east = computeBearingDegrees(
      { lat: 23.78, lng: 90.41 },
      { lat: 23.78, lng: 90.42 }
    );

    expect(Math.round(north)).toBe(0);
    expect(Math.round(east)).toBe(90);
    expect(formatCardinalDirection(0)).toBe("N");
    expect(formatCardinalDirection(90)).toBe("E");
    expect(formatCardinalDirection(135)).toBe("SE");
    expect(formatCardinalDirection(225)).toBe("SW");
  });
});

describe("fuel efficiency calculation", () => {
  it("computes km/L between consecutive full-tank logs including partial fills", () => {
    const logs: FuelLog[] = [
      {
        id: "1",
        vehicleId: "v1",
        date: "2026-05-01",
        liters: 40,
        pricePerLiter: 1.2,
        totalCost: 48,
        odometerKm: 10000,
        fullTank: true,
      },
      {
        id: "2",
        vehicleId: "v1",
        date: "2026-05-05",
        liters: 15,
        pricePerLiter: 1.2,
        totalCost: 18,
        odometerKm: 10200,
        fullTank: false,
      },
      {
        id: "3",
        vehicleId: "v1",
        date: "2026-05-10",
        liters: 35,
        pricePerLiter: 1.25,
        totalCost: 43.75,
        odometerKm: 10500,
        fullTank: true,
      },
      {
        id: "4",
        vehicleId: "v1",
        date: "2026-05-20",
        liters: 40,
        pricePerLiter: 1.25,
        totalCost: 50,
        odometerKm: 10980,
        fullTank: true,
      },
    ];

    const points = computeFuelEfficiency(logs);
    expect(points).toHaveLength(2);
    // 500 km / (15 + 35) L = 10 km/L
    expect(points[0]?.kmPerLiter).toBe(10);
    // 480 km / 40 L = 12 km/L
    expect(points[1]?.kmPerLiter).toBe(12);
    // Total 980 / 90 = 10.89 km/L
    expect(getAverageEfficiency(points)).toBe(10.89);
  });
});

describe("maintenance and driver status helpers", () => {
  const now = new Date("2026-06-01T00:00:00.000Z").getTime();

  it("classifies maintenance records by date and odometer thresholds", () => {
    const base: MaintenanceRecord = {
      id: "m1",
      vehicleId: "v1",
      title: "Service",
      type: "Oil change",
    };

    expect(
      getMaintenanceStatus(
        { ...base, completedDate: "2026-05-30" },
        10000,
        now
      )
    ).toBe("completed");
    expect(
      getMaintenanceStatus(
        { ...base, scheduledDate: "2026-05-25" },
        10000,
        now
      )
    ).toBe("overdue");
    expect(
      getMaintenanceStatus({ ...base, dueOdometerKm: 9900 }, 10000, now)
    ).toBe("overdue");
    expect(
      getMaintenanceStatus(
        { ...base, scheduledDate: "2026-06-10" },
        10000,
        now
      )
    ).toBe("due_soon");
    expect(
      getMaintenanceStatus({ ...base, dueOdometerKm: 10400 }, 10000, now)
    ).toBe("due_soon");
    expect(
      getMaintenanceStatus(
        { ...base, scheduledDate: "2026-07-15", dueOdometerKm: 12000 },
        10000,
        now
      )
    ).toBe("upcoming");
  });

  it("classifies driver license expiry correctly", () => {
    expect(getLicenseStatus("2026-05-20", now)).toBe("expired");
    expect(getLicenseStatus("2026-06-20", now)).toBe("expiring_soon");
    expect(getLicenseStatus("2026-10-01", now)).toBe("valid");
  });
});

describe("dayjs date formatting & table pagination helpers", () => {
  it("formats and parses ISO dates cleanly with dayjs", () => {
    expect(formatShortDate("2026-11-23")).toBe("Nov 23, 2026");
    const parsed = parseIsoDate("2026-11-23");
    expect(parsed).toBeInstanceOf(Date);
    expect(toIsoDate(parsed)).toBe("2026-11-23");
    expect(parseIsoDate("")).toBeUndefined();
  });

  it("paginates items and clamps out-of-range page numbers", () => {
    const data = Array.from({ length: 23 }, (_, i) => i + 1);
    const first = paginateItems(data, 1, 10);
    expect(first.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.totalPages).toBe(3);
    expect(first.startIndex).toBe(1);
    expect(first.endIndex).toBe(10);

    const clamped = paginateItems(data, 99, 10);
    expect(clamped.page).toBe(3);
    expect(clamped.pageItems).toEqual([21, 22, 23]);
    expect(clamped.startIndex).toBe(21);
    expect(clamped.endIndex).toBe(23);

    const empty = paginateItems([], 1, 10);
    expect(empty.page).toBe(1);
    expect(empty.totalPages).toBe(1);
    expect(empty.startIndex).toBe(0);
    expect(empty.endIndex).toBe(0);
  });
});

describe("enterprise fleet domain engines (7 modules)", () => {
  it("enforces RBAC permissions across all 5 roles", () => {
    expect(can("super_admin", "admin:rbac")).toBe(true);
    expect(can("fleet_manager", "admin:rbac")).toBe(false);
    expect(can("fleet_manager", "audit:view")).toBe(true);
    expect(can("dispatcher", "dispatch:approve")).toBe(true);
    expect(can("mechanic", "work_orders:write")).toBe(true);
    expect(can("driver", "vehicles:write")).toBe(false);
    expect(can("driver", "trips:operate")).toBe(true);
  });

  it("classifies compliance expiry into 30/15/7-day and expired tiers", () => {
    const ref = new Date("2026-06-01T00:00:00.000Z").getTime();
    expect(getComplianceStatus("2026-05-25", ref).level).toBe("expired");
    expect(getComplianceStatus("2026-06-05", ref).level).toBe("critical_7d");
    expect(getComplianceStatus("2026-06-12", ref).level).toBe("warning_15d");
    expect(getComplianceStatus("2026-06-25", ref).level).toBe("notice_30d");
    expect(getComplianceStatus("2026-09-01", ref).level).toBe("valid");
  });

  it("computes driver safety scores and blocks leave/double-booking conflicts", () => {
    const driver: Driver = {
      id: "d1",
      name: "Test Driver",
      phone: "123",
      licenseNumber: "DL-1",
      licenseExpiry: "2027-01-01",
      leaveLogs: [
        { id: "l1", fromDate: "2026-06-10", toDate: "2026-06-12", reason: "Annual" },
      ],
    };
    const trips: Trip[] = [
      {
        id: "t1",
        vehicleId: "v1",
        driverId: "d1",
        purpose: "Delivery",
        status: "done",
        startedAt: "2026-06-01T08:00:00Z",
        endedAt: "2026-06-01T09:00:00Z",
        distanceKm: 20,
        maxSpeedKmh: 55,
        points: [],
        safetyMetrics: {
          harshBrakingCount: 1,
          speedingIncidents: 1,
          idleMinutes: 15,
          onTime: true,
        },
      },
    ];

    const safety = computeDriverSafetyScore("d1", trips);
    expect(safety.score).toBe(88);
    expect(safety.grade).toBe("Good");

    expect(checkDriverAvailability(driver, "2026-06-11", trips).available).toBe(
      false
    );
    expect(checkDriverAvailability(driver, "2026-06-15", trips).available).toBe(
      true
    );
  });

  it("detects polygon geofence entry, exit, and after-hours movement", () => {
    const zone: GeofenceZone = {
      id: "z1",
      name: "Depot",
      type: "restricted",
      polygon: [
        { lat: 23.8, lng: 90.4 },
        { lat: 23.8, lng: 90.42 },
        { lat: 23.78, lng: 90.42 },
        { lat: 23.78, lng: 90.4 },
      ],
      active: true,
      alertOnEntry: true,
      alertOnExit: true,
      afterHoursOnly: true,
      allowedStartHour: 6,
      allowedEndHour: 22,
    };

    const outside = { lat: 23.75, lng: 90.39 };
    const inside = { lat: 23.79, lng: 90.41 };
    expect(isPointInPolygon(inside, zone.polygon)).toBe(true);
    expect(isPointInPolygon(outside, zone.polygon)).toBe(false);

    const events = evaluateGeofenceTransitions(outside, inside, [zone], 23);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe("after_hours");
  });

  it("detects fuel over-capacity & efficiency-drop anomalies and converts MPG", () => {
    const vehicle: Vehicle = {
      id: "v1",
      name: "Van",
      plate: "P1",
      type: "Van",
      odometerKm: 2000,
      tankCapacityLiters: 50,
      createdAt: "2026-01-01T00:00:00Z",
    };
    const logs: FuelLog[] = [
      { id: "f1", vehicleId: "v1", date: "2026-05-01", liters: 40, pricePerLiter: 1, totalCost: 40, odometerKm: 1000, fullTank: true },
      { id: "f2", vehicleId: "v1", date: "2026-05-10", liters: 40, pricePerLiter: 1, totalCost: 40, odometerKm: 1600, fullTank: true },
      { id: "f3", vehicleId: "v1", date: "2026-05-20", liters: 60, pricePerLiter: 1, totalCost: 60, odometerKm: 1850, fullTank: true },
    ];
    const anomalies = detectFuelAnomalies(logs, new Map([["v1", vehicle]]));
    expect(anomalies.get("f3")?.some((a) => a.type === "over_capacity")).toBe(true);
    expect(anomalies.get("f3")?.some((a) => a.type === "efficiency_drop")).toBe(true);
    expect(kmPerLiterToMpg(10)).toBeCloseTo(23.52, 1);
  });

  it("computes vehicle TCO, CPK, and utilization peak demand hours", () => {
    const vehicles: Vehicle[] = [
      {
        id: "v1",
        name: "Van",
        plate: "P1",
        type: "Van",
        odometerKm: 5000,
        monthlyDepreciation: 100,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    const trips: Trip[] = [
      {
        id: "t1",
        vehicleId: "v1",
        purpose: "Run",
        status: "done",
        startedAt: "2026-05-10T09:00:00.000Z",
        endedAt: "2026-05-10T10:00:00.000Z",
        distanceKm: 100,
        maxSpeedKmh: 60,
        points: [],
      },
    ];
    const tco = computeVehicleTco(
      vehicles,
      trips,
      [{ id: "f1", vehicleId: "v1", date: "2026-05-10", liters: 10, pricePerLiter: 2, totalCost: 20, odometerKm: 5000, fullTank: true }],
      [{ id: "m1", vehicleId: "v1", title: "Oil", type: "Oil change", cost: 80 }],
      [],
      [{ id: "e1", vehicleId: "v1", date: "2026-05-10", category: "Tolls", amount: 10, description: "Toll" }],
      [{ id: "c1", vehicleId: "v1", docType: "insurance", documentNumber: "I1", issuer: "X", issueDate: "2026-01-01", expiryDate: "2027-01-01", cost: 90 }],
      3
    );
    // 20 + 80 + 10 + 90 + 300 = 500 -> 500 / 100 km = 5.00 CPK
    expect(tco[0].totalTco).toBe(500);
    expect(tco[0].cpk).toBe(5);

    const util = computeUtilization(vehicles, trips, 30);
    expect(util.byVehicle[0].tripCount).toBe(1);
    expect(util.peakHours.reduce((s, b) => s + b.trips, 0)).toBe(1);
  });
});
