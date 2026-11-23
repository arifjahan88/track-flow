import type { FuelLog, Vehicle } from "@/types";

export interface FuelEfficiencyPoint {
  logId: string;
  date: string;
  odometerKm: number;
  distanceKm: number;
  liters: number;
  kmPerLiter: number;
}

export interface FuelAnomaly {
  logId: string;
  type: "over_capacity" | "efficiency_drop";
  message: string;
}

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

export function detectFuelAnomalies(
  logs: readonly FuelLog[],
  vehiclesById: ReadonlyMap<string, Vehicle>
): Map<string, FuelAnomaly[]> {
  const anomalies = new Map<string, FuelAnomaly[]>();

  const pushAnomaly = (logId: string, item: FuelAnomaly) => {
    const list = anomalies.get(logId) ?? [];
    list.push(item);
    anomalies.set(logId, list);
  };

  for (const log of logs) {
    const vehicle = vehiclesById.get(log.vehicleId);
    const capacity = vehicle?.tankCapacityLiters;
    if (typeof capacity === "number" && capacity > 0 && log.liters > capacity) {
      pushAnomaly(log.id, {
        logId: log.id,
        type: "over_capacity",
        message: `${log.liters.toFixed(1)} L exceeds ${capacity} L tank capacity`,
      });
    }
  }

  const byVehicle = new Map<string, FuelLog[]>();
  for (const log of logs) {
    const arr = byVehicle.get(log.vehicleId) ?? [];
    arr.push(log);
    byVehicle.set(log.vehicleId, arr);
  }

  for (const [, vLogs] of byVehicle) {
    const points = computeFuelEfficiency(vLogs);
    if (points.length < 2) continue;
    const avg = getAverageEfficiency(points);
    if (!avg || avg <= 0) continue;

    for (const pt of points) {
      const dropRatio = (avg - pt.kmPerLiter) / avg;
      if (dropRatio >= 0.25) {
        pushAnomaly(pt.logId, {
          logId: pt.logId,
          type: "efficiency_drop",
          message: `${pt.kmPerLiter} km/L is ${Math.round(dropRatio * 100)}% below avg (${avg} km/L)`,
        });
      }
    }
  }

  return anomalies;
}
