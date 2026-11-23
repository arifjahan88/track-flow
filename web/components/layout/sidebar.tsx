"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Car,
  ChevronLeft,
  ChevronRight,
  Fuel,
  LayoutDashboard,
  Navigation,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFleetStore } from "@/store/fleet-store";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeType?: "live";
}

const NAV_GROUPS: Array<{ title: string; items: readonly NavItem[] }> = [
  {
    title: "Command",
    items: [
      { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
      {
        href: "/trips",
        label: "Live GPS Tracking",
        icon: Navigation,
        badgeType: "live",
      },
      { href: "/vehicles", label: "Vehicles & Assets", icon: Car },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/drivers", label: "Drivers & Shifts", icon: Users },
      { href: "/fuel", label: "Fuel & Expenses", icon: Fuel },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/reports", label: "Reports & TCO", icon: BarChart3 },
    ],
  },
  {
    title: "System",
    items: [{ href: "/settings", label: "Settings & RBAC", icon: Settings }],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  isMobileSheet?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  isMobileSheet = false,
}: SidebarProps) {
  const pathname = usePathname();
  const vehicles = useFleetStore((s) => s.vehicles);
  const liveCount = vehicles.filter((v) => v.status === "on_trip").length;
  const isCompact = collapsed && !isMobileSheet;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-3.5",
          isCompact ? "justify-center" : "justify-between",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isCompact ? (
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/35">
              <Navigation className="size-4.5 text-cyan-500 dark:text-cyan-400" />
              {liveCount > 0 && (
                <span className="animate-fp-pulse-dot absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <span className="animate-fp-pulse-dot size-1.5 rounded-full bg-emerald-400" />
            </div>
          )}
        </Link>

        {!isMobileSheet && onToggleCollapse && !isCompact ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
      </div>

      {!isMobileSheet && onToggleCollapse && isCompact ? (
        <div className="flex justify-center border-b border-sidebar-border py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* Navigation Links */}
      <nav aria-label="Primary navigation" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            {!isCompact ? (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group.title}
              </p>
            ) : null}

            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const showLive = item.badgeType === "live" && liveCount > 0;

              const linkEl = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCompact && "justify-center px-0",
                    isActive
                      ? "bg-cyan-500/12 text-cyan-600 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.22)] dark:bg-cyan-500/15 dark:text-cyan-300"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-2 bottom-2 left-0 w-0.75 rounded-r-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]"
                    />
                  ) : null}

                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-cyan-600 dark:text-cyan-400"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />

                  {!isCompact ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {showLive ? (
                        <span className="fp-telemetry ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                          <span className="animate-fp-pulse-dot size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {liveCount} LIVE
                        </span>
                      ) : null}
                    </>
                  ) : showLive ? (
                    <span className="animate-fp-pulse-dot absolute top-2 right-2 size-2 rounded-full bg-emerald-400" />
                  ) : null}
                </Link>
              );

              if (isCompact) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={linkEl} />
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                      {showLive ? ` (${liveCount} live)` : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkEl;
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
