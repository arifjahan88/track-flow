import type { MaintenanceRecord } from "@/types";

export type MaintenanceStatus =
  | "completed"
  | "overdue"
  | "due_soon"
  | "upcoming";

const DUE_SOON_DAYS = 14;
const DUE_SOON_KM = 500;
const DUE_SOON_ENGINE_HOURS = 25;
const MS_PER_DAY = 86_400_000;

export function getMaintenanceStatus(
  record: MaintenanceRecord,
  vehicleOdometerKm: number,
  nowMs: number = Date.now(),
  vehicleEngineHours?: number
): MaintenanceStatus {
  if (record.completedDate) {
    return "completed";
  }

  let isOverdue = false;
  let isDueSoon = false;

  if (record.scheduledDate) {
    const dueTime = new Date(record.scheduledDate).getTime();
    if (!Number.isNaN(dueTime)) {
      const daysUntil = (dueTime - nowMs) / MS_PER_DAY;
      if (daysUntil < 0) {
        isOverdue = true;
      } else if (daysUntil <= DUE_SOON_DAYS) {
        isDueSoon = true;
      }
    }
  }

  if (typeof record.dueOdometerKm === "number") {
    const kmRemaining = record.dueOdometerKm - vehicleOdometerKm;
    if (kmRemaining <= 0) {
      isOverdue = true;
    } else if (kmRemaining <= DUE_SOON_KM) {
      isDueSoon = true;
    }
  }

  if (
    typeof record.dueEngineHours === "number" &&
    typeof vehicleEngineHours === "number"
  ) {
    const hoursRemaining = record.dueEngineHours - vehicleEngineHours;
    if (hoursRemaining <= 0) {
      isOverdue = true;
    } else if (hoursRemaining <= DUE_SOON_ENGINE_HOURS) {
      isDueSoon = true;
    }
  }

  if (isOverdue) return "overdue";
  if (isDueSoon) return "due_soon";
  return "upcoming";
}
