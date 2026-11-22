import type { FuelLog } from "@/types";

export interface FuelEfficiencyPoint {
  logId: string;
  date: string;
  odometerKm: number;
  distanceKm: number;
  liters: number;
  kmPerLiter: number;
}

/**
 * Computes fuel efficiency (km/L) between consecutive full-tank logs.
 * Any partial-tank fills recorded between two full-tank logs are accumulated
 * into the liters consumed for that full-to-full interval.
 */
export function computeFuelEfficiency(
  logs: readonly FuelLog[]
): FuelEfficiencyPoint[] {
  const sorted = [...logs].sort((a, b) => {
    if (a.odometerKm !== b.odometerKm) return a.odometerKm - b.odometerKm;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const points: FuelEfficiencyPoint[] = [];
  let lastFullLog: FuelLog | null = null;
  let accumulatedLiters = 0;

  for (const log of sorted) {
    if (!lastFullLog) {
      if (log.fullTank) {
        lastFullLog = log;
        accumulatedLiters = 0;
      }
      continue;
    }

    accumulatedLiters += log.liters;

    if (log.fullTank) {
      const distanceKm = log.odometerKm - lastFullLog.odometerKm;
      if (distanceKm > 0 && accumulatedLiters > 0) {
        points.push({
          logId: log.id,
          date: log.date,
          odometerKm: log.odometerKm,
          distanceKm: Number(distanceKm.toFixed(2)),
          liters: Number(accumulatedLiters.toFixed(2)),
          kmPerLiter: Number((distanceKm / accumulatedLiters).toFixed(2)),
        });
      }
      lastFullLog = log;
      accumulatedLiters = 0;
    }
  }

  return points;
}

export function getAverageEfficiency(
  points: readonly FuelEfficiencyPoint[]
): number | null {
  if (points.length === 0) return null;
  const totalDist = points.reduce((sum, p) => sum + p.distanceKm, 0);
  const totalLiters = points.reduce((sum, p) => sum + p.liters, 0);
  if (totalLiters <= 0) return null;
  return Number((totalDist / totalLiters).toFixed(2));
}
