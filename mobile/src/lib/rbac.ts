import type { UserRole } from "@/types";

export type Permission =
  | "bookings:request"
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
  employee: "Employee / User",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin:
    "Full access to all modules, user roles, RBAC policies, and audit logs.",
  fleet_manager:
    "Manages vehicles, compliance, drivers, approvals, expenses, and analytics.",
  dispatcher:
    "Reviews trip requests, assigns drivers & vehicles, monitors GPS & geofences.",
  mechanic:
    "Manages preventive service rules, work orders, spare parts, and vehicle maintenance status.",
  driver:
    "Receives assigned trips, completes pre/post checks, operates trips & POD, logs fuel/SOS.",
  employee:
    "Requests trips, tracks assigned driver status live, and reviews personal trip history.",
};

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>([
    "bookings:request",
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
    "bookings:request",
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
    "bookings:request",
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
    "bookings:request",
    "trips:operate",
    "fuel:write",
    "expenses:write",
    "incidents:write",
  ]),
  employee: new Set<Permission>(["bookings:request"]),
};

export const ALL_ROLES: readonly UserRole[] = [
  "employee",
  "driver",
  "dispatcher",
  "fleet_manager",
  "mechanic",
  "super_admin",
];

export const ALL_PERMISSIONS: readonly { key: Permission; label: string }[] = [
  { key: "bookings:request", label: "Request Trips" },
  { key: "vehicles:write", label: "Vehicles & Lifecycle" },
  { key: "compliance:write", label: "Compliance Vault" },
  { key: "drivers:write", label: "Drivers & Shifts" },
  { key: "dispatch:approve", label: "Assign & Approve Trips" },
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

export type MobileTabName =
  | "dashboard"
  | "index"
  | "trips"
  | "logs"
  | "fleet"
  | "profile";

export const ROLE_VISIBLE_TABS: Record<UserRole, ReadonlySet<MobileTabName>> = {
  super_admin: new Set(["dashboard", "index", "trips", "fleet", "profile"]),
  fleet_manager: new Set(["dashboard", "index", "trips", "fleet", "profile"]),
  dispatcher: new Set(["dashboard", "index", "trips", "fleet", "profile"]),
  mechanic: new Set(["dashboard", "logs", "fleet", "profile"]),
  driver: new Set(["dashboard", "index", "trips", "logs", "profile"]),
  employee: new Set(["dashboard", "index", "profile"]),
};

export function can(
  role: UserRole | undefined | null,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canSeeMobileTab(
  role: UserRole | undefined | null,
  tab: MobileTabName
): boolean {
  if (!role) return false;
  return ROLE_VISIBLE_TABS[role]?.has(tab) ?? false;
}
