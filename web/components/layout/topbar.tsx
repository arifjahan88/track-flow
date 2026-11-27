"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronsUpDown,
  Info,
  LogOut,
  Menu,
  Radio,
  ShieldCheck,
  Truck,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { ROLE_LABELS } from "@/lib/rbac";
import { getScopedAlerts, getScopedVehicles } from "@/lib/rbac-scope";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Executive Dashboard",
    subtitle: "Fleet KPI telemetry, analytics, and live status feed",
  },
  "/trips": {
    title: "Live GPS Tracking",
    subtitle: "Live GPS tracking, geofence perimeters, and trip dispatch",
  },
  "/vehicles": {
    title: "Vehicles & Asset Registry",
    subtitle: "Fleet profiles, status lifecycle, and compliance vault",
  },
  "/drivers": {
    title: "Drivers & Staff Management",
    subtitle: "Safety scoring, shift schedules, and leave conflicts",
  },
  "/fuel": {
    title: "Fuel & Operating Expenses",
    subtitle: "Efficiency anomaly detection, fill-up logs, and cost centers",
  },
  "/maintenance": {
    title: "Preventive & Corrective Maintenance",
    subtitle: "Service rules, repair work orders, and incident reporting",
  },
  "/reports": {
    title: "Analytics, TCO & Utilization",
    subtitle: "Cost-per-kilometer breakdown, peak hours, and CSV exports",
  },
  "/settings": {
    title: "Settings, RBAC & Audit Trail",
    subtitle: "Role permissions, backup/restore, and full activity log",
  },
};

const ROLE_ICON: Record<UserRole, typeof ShieldCheck> = {
  super_admin: ShieldCheck,
  fleet_manager: UserCheck,
  dispatcher: Radio,
  mechanic: Wrench,
  driver: Truck,
  employee: User,
};

const ROLE_ORDER: UserRole[] = [
  "super_admin",
  "fleet_manager",
  "dispatcher",
  "mechanic",
  "driver",
  "employee",
];

const ROLE_DASHBOARD_META: Record<UserRole, { title: string; subtitle: string }> = {
  super_admin: {
    title: "Super Admin Command Center",
    subtitle: "Fleet KPIs, pending trip approvals, RBAC governance, and audit trail",
  },
  fleet_manager: {
    title: "Fleet Operations Dashboard",
    subtitle: "Compliance alerts, fuel anomalies, trip approvals, and cost control",
  },
  dispatcher: {
    title: "Dispatch Control Center",
    subtitle: "Assign drivers to pending requests, track available pool, and live GPS",
  },
  mechanic: {
    title: "Mechanic Service Bay",
    subtitle: "Active work orders, due preventive services, and maintenance holds",
  },
  driver: {
    title: "Driver Duty Dashboard",
    subtitle: "Assigned trips ready to start, active route control, and safety score",
  },
  employee: {
    title: "My Trip Portal",
    subtitle: "Request trips, check assigned driver details, and track rides live",
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const switchRole = useAuthStore((s) => s.switchRole);
  const logout = useAuthStore((s) => s.logout);

  const allVehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const bookings = useFleetStore((s) => s.bookings);
  const trips = useFleetStore((s) => s.trips);
  const allAlerts = useFleetStore((s) => s.alerts);
  const isSimulating = useFleetStore((s) => s.isSimulating);
  const markAlertRead = useFleetStore((s) => s.markAlertRead);
  const markAllAlertsRead = useFleetStore((s) => s.markAllAlertsRead);

  const currentUser = users.find((u) => u.id === currentUserId);
  const activeRole: UserRole = currentUser?.role ?? "super_admin";
  const vehicles = getScopedVehicles(
    currentUser,
    drivers,
    allVehicles,
    bookings,
    trips
  );
  const alerts = getScopedAlerts(
    currentUser,
    drivers,
    allVehicles,
    bookings,
    trips,
    allAlerts
  );
  const liveCount = vehicles.filter((v) => v.status === "on_trip").length;
  const unreadCount = alerts.filter((a) => !a.read).length;

  const meta =
    pathname === "/dashboard"
      ? ROLE_DASHBOARD_META[activeRole]
      : Object.entries(PAGE_TITLES).find(
          ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        )?.[1] ?? ROLE_DASHBOARD_META[activeRole];

  const handleSignOut = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur-xl sm:px-6">
      {/* Left: Mobile Menu Trigger + Dynamic Route Title */}
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="shrink-0 rounded-xl lg:hidden"
        >
          <Menu className="size-5" />
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
            {meta.title}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right: Live Pill, Notifications Bell, Theme Toggle, Quick Demo Role Switcher + Sign Out */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Live Telemetry Status Pill */}
        <Link
          href="/trips"
          className={cn(
            "fp-telemetry hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all md:inline-flex",
            isSimulating && liveCount > 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/18 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/18 dark:text-amber-300",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              isSimulating && liveCount > 0
                ? "animate-fp-pulse-dot bg-emerald-500"
                : "bg-amber-500",
            )}
          />
          {isSimulating && liveCount > 0
            ? `${liveCount} LIVE ON MAP`
            : liveCount > 0
              ? "SIM PAUSED"
              : "0 LIVE"}
        </Link>

        {/* Notifications Bell Popover */}
        <Popover open={alertsOpen} onOpenChange={setAlertsOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Notifications"
                className="relative size-9 rounded-xl"
              />
            }
          >
            <Bell className="size-4" />
            {unreadCount > 0 ? (
              <span className="fp-telemetry absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-2xl p-0 sm:w-96">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Telemetry &amp; Fleet Alerts
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {unreadCount} unread of {alerts.length} total
                </p>
              </div>
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAlertsRead()}
                  className="h-7 gap-1 rounded-lg px-2 text-xs text-cyan-600 dark:text-cyan-400"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </Button>
              ) : null}
            </div>

            <div className="max-h-80 divide-y divide-border/70 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  All clear — no fleet alerts recorded.
                </p>
              ) : (
                alerts.slice(0, 12).map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      markAlertRead(alert.id);
                      setAlertsOpen(false);
                      if (alert.vehicleId) {
                        router.push(`/trips?vehicle=${alert.vehicleId}`);
                      }
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !alert.read && "bg-cyan-500/4",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                        alert.severity === "critical"
                          ? "bg-rose-500/15 text-rose-500"
                          : alert.severity === "warning"
                            ? "bg-amber-500/15 text-amber-500"
                            : "bg-cyan-500/15 text-cyan-500",
                      )}
                    >
                      {alert.severity === "info" ? (
                        <Info className="size-3.5" />
                      ) : (
                        <AlertTriangle className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {alert.title}
                        </p>
                        {!alert.read ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-cyan-500" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {alert.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Light / Dark Theme Toggle */}
        <ThemeToggle />

        {/* Top-Right User & Quick Demo Role Switcher + Sign Out (beside Light/Dark toggle) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-xl border border-border bg-muted/40 px-2 py-1 text-left transition-colors hover:border-cyan-500/40 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 font-mono text-xs font-bold text-cyan-700 dark:text-cyan-300">
              {getInitials(currentUser?.name ?? "Alex Morgan")}
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-27.5 truncate text-xs font-semibold leading-tight text-foreground">
                {currentUser?.name ?? "Alex Morgan"}
              </p>
              <p className="max-w-27.5 truncate text-[10px] leading-tight text-muted-foreground">
                {ROLE_LABELS[activeRole]} · Switch
              </p>
            </div>
            <ChevronsUpDown className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
            <div className="px-2.5 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Demo Role Switcher
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {currentUser?.email ?? "demo@demo.com"}
                </span>
              </p>
            </div>

            <DropdownMenuSeparator />

            {ROLE_ORDER.map((roleKey) => {
              const Icon = ROLE_ICON[roleKey];
              const isCurrent = activeRole === roleKey;
              return (
                <DropdownMenuItem
                  key={roleKey}
                  onClick={() => switchRole(roleKey)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium",
                    isCurrent && "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0" />
                    <span>{ROLE_LABELS[roleKey]}</span>
                  </span>
                  {isCurrent ? (
                    <Badge
                      variant="outline"
                      className="border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0 text-[10px] text-cyan-600 dark:text-cyan-300"
                    >
                      Active
                    </Badge>
                  ) : null}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 focus:bg-rose-500/10 focus:text-rose-600 dark:text-rose-400"
            >
              <LogOut className="size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
