import type { UserRole } from "@/types";

export type Permission =
  | "vehicles:write"
  | "compliance:write"
  | "drivers:write"
  | "dispatch:approve"
  | "trips:operate"
  | "geofences:write"
  | "fuel:write"
  | "expenses:write"
  | "maintenance:write"
  | "work_orders:write"
  | "incidents:write"
  | "reports:view"
  | "admin:rbac"
  | "audit:view";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  fleet_manager: "Fleet Manager",
  dispatcher: "Dispatcher",
  mechanic: "Mechanic",
  driver: "Driver",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: "Full access to all modules, user roles, RBAC policies, and audit logs.",
  fleet_manager: "Manages vehicles, compliance, drivers, approvals, expenses, and analytics.",
  dispatcher: "Creates and approves trip bookings, assigns drivers, monitors GPS & geofences.",
  mechanic: "Manages preventive service rules, work orders, spare parts, and vehicle maintenance status.",
  driver: "Operates assigned trips, submits checklists/POD, logs fuel, expenses, and incidents.",
};

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([
    "vehicles:write",
    "compliance:write",
    "drivers:write",
    "dispatch:approve",
    "trips:operate",
    "geofences:write",
    "fuel:write",
    "expenses:write",
    "maintenance:write",
    "work_orders:write",
    "incidents:write",
    "reports:view",
    "admin:rbac",
    "audit:view",
  ]),
  fleet_manager: new Set<Permission>([
    "vehicles:write",
    "compliance:write",
    "drivers:write",
    "dispatch:approve",
    "trips:operate",
    "geofences:write",
    "fuel:write",
    "expenses:write",
    "maintenance:write",
    "work_orders:write",
    "incidents:write",
    "reports:view",
    "audit:view",
  ]),
  dispatcher: new Set<Permission>([
    "dispatch:approve",
    "trips:operate",
    "geofences:write",
    "expenses:write",
    "incidents:write",
    "reports:view",
  ]),
  mechanic: new Set<Permission>([
    "maintenance:write",
    "work_orders:write",
    "incidents:write",
    "reports:view",
  ]),
  driver: new Set<Permission>([
    "trips:operate",
    "fuel:write",
    "expenses:write",
    "incidents:write",
  ]),
};

export const ALL_ROLES: readonly UserRole[] = [
  "super_admin",
  "fleet_manager",
  "dispatcher",
  "mechanic",
  "driver",
];

export const ALL_PERMISSIONS: readonly { key: Permission; label: string }[] = [
  { key: "vehicles:write", label: "Vehicles & Lifecycle" },
  { key: "compliance:write", label: "Compliance Vault" },
  { key: "drivers:write", label: "Drivers & Shifts" },
  { key: "dispatch:approve", label: "Approve Bookings" },
  { key: "trips:operate", label: "Operate Trips & POD" },
  { key: "geofences:write", label: "Manage Geofences" },
  { key: "fuel:write", label: "Log Fuel" },
  { key: "expenses:write", label: "Operating Expenses" },
  { key: "maintenance:write", label: "Service Rules" },
  { key: "work_orders:write", label: "Work Orders" },
  { key: "incidents:write", label: "Incident Reports" },
  { key: "reports:view", label: "TCO & Utilization" },
  { key: "admin:rbac", label: "Manage RBAC" },
  { key: "audit:view", label: "View Audit Log" },
];

export function can(
  role: UserRole | undefined | null,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
