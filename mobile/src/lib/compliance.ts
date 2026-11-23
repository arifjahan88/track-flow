import dayjs from "dayjs";
import type { ComplianceDocType } from "@/types";

export type ComplianceAlertLevel =
  | "expired"
  | "critical_7d"
  | "warning_15d"
  | "notice_30d"
  | "valid";

export const COMPLIANCE_DOC_LABELS: Record<ComplianceDocType, string> = {
  registration: "Registration / Tax Token",
  fitness: "Fitness Certificate",
  route_permit: "Route Permit",
  insurance: "Insurance Policy",
};

export const COMPLIANCE_DOC_TYPES: readonly ComplianceDocType[] = [
  "registration",
  "fitness",
  "route_permit",
  "insurance",
];

export interface ComplianceStatusInfo {
  level: ComplianceAlertLevel;
  daysRemaining: number;
  label: string;
}

export function getComplianceStatus(
  expiryDate: string,
  nowMs?: number
): ComplianceStatusInfo {
  const expiry = dayjs(expiryDate).startOf("day");
  if (!expiry.isValid()) {
    return { level: "valid", daysRemaining: 999, label: "Valid" };
  }
  const reference = dayjs(nowMs ?? Date.now()).startOf("day");
  const daysRemaining = expiry.diff(reference, "day");

  if (daysRemaining < 0) {
    return {
      level: "expired",
      daysRemaining,
      label: `Expired ${Math.abs(daysRemaining)}d ago`,
    };
  }
  if (daysRemaining <= 7) {
    return {
      level: "critical_7d",
      daysRemaining,
      label: daysRemaining === 0 ? "Expires today" : `Due in ${daysRemaining}d`,
    };
  }
  if (daysRemaining <= 15) {
    return {
      level: "warning_15d",
      daysRemaining,
      label: `Due in ${daysRemaining}d`,
    };
  }
  if (daysRemaining <= 30) {
    return {
      level: "notice_30d",
      daysRemaining,
      label: `Due in ${daysRemaining}d`,
    };
  }
  return {
    level: "valid",
    daysRemaining,
    label: `Valid (${daysRemaining}d)`,
  };
}
