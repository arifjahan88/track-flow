import dayjs from "dayjs";
import type {
  ComplianceDocument,
  FuelLog,
  MaintenanceRecord,
  OperatingExpense,
  Trip,
  Vehicle,
  WorkOrder,
} from "@/types";

export interface VehicleTcoRow {
  vehicleId: string;
  vehicleName: string;
  plate: string;
  distanceKm: number;
  fuelCost: number;
  maintenanceCost: number;
  expenseCost: number;
  insuranceCost: number;
  depreciationCost: number;
  totalTco: number;
  cpk: number | null;
}

export function computeWorkOrderTotal(wo: WorkOrder): number {
  const partsTotal = wo.parts.reduce((s, p) => s + p.qty * p.unitCost, 0);
  return Number((partsTotal + wo.laborCost).toFixed(2));
}

export function computeVehicleTco(
  vehicles: readonly Vehicle[],
  trips: readonly Trip[],
  fuelLogs: readonly FuelLog[],
  maintenanceRecords: readonly MaintenanceRecord[],
  workOrders: readonly WorkOrder[],
  expenses: readonly OperatingExpense[],
  complianceDocs: readonly ComplianceDocument[],
  monthsHorizon = 3
): VehicleTcoRow[] {
  return vehicles.map((v) => {
    const distanceKm = trips
      .filter((t) => t.status === "done" && t.vehicleId === v.id)
      .reduce((sum, t) => sum + t.distanceKm, 0);

    const fuelCost = fuelLogs
      .filter((f) => f.vehicleId === v.id)
      .reduce((sum, f) => sum + f.totalCost, 0);

    const scheduledMaintCost = maintenanceRecords
      .filter((m) => m.vehicleId === v.id && typeof m.cost === "number")
      .reduce((sum, m) => sum + (m.cost ?? 0), 0);

    const workOrderCost = workOrders
      .filter((wo) => wo.vehicleId === v.id)
      .reduce((sum, wo) => sum + computeWorkOrderTotal(wo), 0);

    const maintenanceCost = scheduledMaintCost + workOrderCost;

    const expenseCost = expenses
      .filter((e) => e.vehicleId === v.id)
      .reduce((sum, e) => sum + e.amount, 0);

    const insuranceCost = complianceDocs
      .filter((d) => d.vehicleId === v.id && typeof d.cost === "number")
      .reduce((sum, d) => sum + (d.cost ?? 0), 0);

    const depreciationCost = (v.monthlyDepreciation ?? 220) * monthsHorizon;
    const totalTco =
      fuelCost +
      maintenanceCost +
      expenseCost +
      insuranceCost +
      depreciationCost;

    return {
      vehicleId: v.id,
      vehicleName: v.name,
      plate: v.plate,
      distanceKm: Number(distanceKm.toFixed(2)),
      fuelCost: Number(fuelCost.toFixed(2)),
      maintenanceCost: Number(maintenanceCost.toFixed(2)),
      expenseCost: Number(expenseCost.toFixed(2)),
      insuranceCost: Number(insuranceCost.toFixed(2)),
      depreciationCost: Number(depreciationCost.toFixed(2)),
      totalTco: Number(totalTco.toFixed(2)),
      cpk: distanceKm > 0 ? Number((totalTco / distanceKm).toFixed(2)) : null,
    };
  });
}

export interface VehicleUtilizationRow {
  vehicleId: string;
  vehicleName: string;
  plate: string;
  tripCount: number;
  activeDays: number;
  totalDistanceKm: number;
  utilizationPct: number;
  underused: boolean;
}

export function computeUtilization(
  vehicles: readonly Vehicle[],
  trips: readonly Trip[],
  windowDays = 30
): {
  byVehicle: VehicleUtilizationRow[];
} {
  const completed = trips.filter((t) => t.status === "done");

  const byVehicle: VehicleUtilizationRow[] = vehicles.map((v) => {
    const vTrips = completed.filter((t) => t.vehicleId === v.id);
    const activeDaySet = new Set(
      vTrips.map((t) => dayjs(t.startedAt).format("YYYY-MM-DD"))
    );
    const activeDays = activeDaySet.size;
    const totalDistanceKm = vTrips.reduce((s, t) => s + t.distanceKm, 0);
    const utilizationPct = Math.min(
      100,
      Math.round((activeDays / Math.max(1, windowDays)) * 100)
    );

    return {
      vehicleId: v.id,
      vehicleName: v.name,
      plate: v.plate,
      tripCount: vTrips.length,
      activeDays,
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      utilizationPct,
      underused: utilizationPct < 15 || vTrips.length <= 1,
    };
  });

  return { byVehicle };
}
