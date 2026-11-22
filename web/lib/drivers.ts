import type { Trip } from "@/types";

export type LicenseStatus = "expired" | "expiring_soon" | "valid";

const EXPIRING_SOON_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export function getLicenseStatus(
  licenseExpiry: string,
  nowMs: number = Date.now()
): LicenseStatus {
  const expiryTime = new Date(licenseExpiry).getTime();
  if (Number.isNaN(expiryTime)) return "valid";
  const daysRemaining = (expiryTime - nowMs) / MS_PER_DAY;
  if (daysRemaining < 0) return "expired";
  if (daysRemaining <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "valid";
}

export interface DriverStats {
  completedTrips: number;
  totalDistanceKm: number;
  topSpeedKmh: number;
}

export function computeDriverStats(
  driverId: string,
  trips: readonly Trip[]
): DriverStats {
  let completedTrips = 0;
  let totalDistanceKm = 0;
  let topSpeedKmh = 0;

  for (const trip of trips) {
    if (trip.driverId !== driverId || trip.status !== "done") continue;
    completedTrips += 1;
    totalDistanceKm += trip.distanceKm;
    if (trip.maxSpeedKmh > topSpeedKmh) {
      topSpeedKmh = trip.maxSpeedKmh;
    }
  }

  return {
    completedTrips,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    topSpeedKmh: Math.round(topSpeedKmh),
  };
}
