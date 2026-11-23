import { describe, expect, it } from "vitest";
import {
  computeBearingDegrees,
  formatCardinalDirection,
  haversineKm,
  isUsefulPoint,
  ROUTE_WAYPOINTS,
  SIM_ROUTE,
} from "@/lib/geo";
import { computeFuelEfficiency, getAverageEfficiency } from "@/lib/fuel";
import { getMaintenanceStatus } from "@/lib/maintenance";
import { getLicenseStatus } from "@/lib/drivers";
import { formatShortDate, parseIsoDate, toIsoDate } from "@/lib/format";
import { paginateItems } from "@/components/table-pagination";
import type { FuelLog, MaintenanceRecord } from "@/types";

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
