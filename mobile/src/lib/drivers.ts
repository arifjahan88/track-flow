import dayjs from "dayjs";
import type { Driver, Trip } from "@/types";

export type LicenseStatus = "expired" | "expiring_soon" | "valid";

const EXPIRING_SOON_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export const DAY_OF_WEEK_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

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

export interface DriverSafetySummary {
  score: number;
  harshBraking: number;
  speedingIncidents: number;
  idleMinutes: number;
  onTimeRatePct: number;
  grade: "Excellent" | "Good" | "Watch" | "At Risk";
}

export function computeDriverSafetyScore(
  driverId: string,
  trips: readonly Trip[]
): DriverSafetySummary {
  const doneTrips = trips.filter(
    (t) => t.driverId === driverId && t.status === "done"
  );
  if (doneTrips.length === 0) {
    return {
      score: 100,
      harshBraking: 0,
      speedingIncidents: 0,
      idleMinutes: 0,
      onTimeRatePct: 100,
      grade: "Excellent",
    };
  }

  let harshBraking = 0;
  let speedingIncidents = 0;
  let idleMinutes = 0;
  let onTimeCount = 0;

  for (const t of doneTrips) {
    if (t.safetyMetrics) {
      harshBraking += t.safetyMetrics.harshBrakingCount;
      speedingIncidents += t.safetyMetrics.speedingIncidents;
      idleMinutes += t.safetyMetrics.idleMinutes;
      if (t.safetyMetrics.onTime) onTimeCount += 1;
    } else {
      if (t.maxSpeedKmh > 60) speedingIncidents += 1;
      onTimeCount += 1;
    }
  }

  const onTimeRatePct = Math.round((onTimeCount / doneTrips.length) * 100);
  const penalty =
    harshBraking * 4 +
    speedingIncidents * 6 +
    Math.floor(idleMinutes / 15) * 2 +
    Math.round((100 - onTimeRatePct) * 0.25);

  const score = Math.max(0, Math.min(100, 100 - penalty));
  const grade =
    score >= 90
      ? "Excellent"
      : score >= 75
        ? "Good"
        : score >= 60
          ? "Watch"
          : "At Risk";

  return {
    score,
    harshBraking,
    speedingIncidents,
    idleMinutes,
    onTimeRatePct,
    grade,
  };
}

export interface DriverAvailabilityResult {
  available: boolean;
  reason?: string;
}

export function checkDriverAvailability(
  driver: Driver,
  dateIso: string,
  trips: readonly Trip[],
  checkTimeHHmm?: string
): DriverAvailabilityResult {
  const activeTrip = trips.find(
    (t) => t.driverId === driver.id && t.status !== "done"
  );
  if (activeTrip) {
    return {
      available: false,
      reason: `Currently on active trip "${activeTrip.purpose}"`,
    };
  }

  const targetDay = dayjs(dateIso).format("YYYY-MM-DD");
  const leaveMatch = (driver.leaveLogs ?? []).find(
    (leave) => targetDay >= leave.fromDate && targetDay <= leave.toDate
  );
  if (leaveMatch) {
    return {
      available: false,
      reason: `On leave (${leaveMatch.reason}: ${leaveMatch.fromDate} – ${leaveMatch.toDate})`,
    };
  }

  if (driver.shifts && driver.shifts.length > 0) {
    const dayOfWeek = dayjs(dateIso).day();
    const dayShifts = driver.shifts.filter((s) => s.dayOfWeek === dayOfWeek);
    if (dayShifts.length === 0) {
      return {
        available: false,
        reason: `No shift scheduled on ${DAY_OF_WEEK_LABELS[dayOfWeek]}`,
      };
    }
    if (checkTimeHHmm) {
      const withinShift = dayShifts.some(
        (s) => checkTimeHHmm >= s.startTime && checkTimeHHmm <= s.endTime
      );
      if (!withinShift) {
        return {
          available: false,
          reason: `Outside shift hours (${dayShifts[0].startTime}–${dayShifts[0].endTime})`,
        };
      }
    }
  }

  return { available: true };
}
