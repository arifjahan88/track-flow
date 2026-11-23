"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Car,
  Fuel,
  LayoutDashboard,
  LogOut,
  Menu,
  Navigation,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PageTransition } from "@/components/motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const CORE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/trips", label: "Trips and tracking", icon: Navigation },
];

const OPERATIONS_NAV: readonly NavItem[] = [
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/fuel", label: "Fuel logs", icon: Fuel },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const SYSTEM_NAV: readonly NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const logout = useAuthStore((s) => s.logout);
  const activeTripId = useFleetStore((s) => s.activeTripId);

  const currentUser = users.find((u) => u.id === currentUserId);

  const handleSignOut = () => {
    logout();
    setMobileOpen(false);
    router.replace("/login");
  };

  const renderNavGroup = (title: string, items: readonly NavItem[]) => (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const showLiveDot = item.href === "/trips" && activeTripId !== null;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </span>
            {showLiveDot ? (
              <span className="relative flex h-2.5 w-2.5" aria-label="Active trip running">
                <span className="tf-live-pulse absolute inline-flex h-full w-full rounded-full bg-brand-amber" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-amber" />
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo size="md" showSubtitle />
        </Link>
      </div>

      <Separator />

      <nav aria-label="Primary navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {renderNavGroup("Fleet", CORE_NAV)}
        {renderNavGroup("Operations", OPERATIONS_NAV)}
        {renderNavGroup("System", SYSTEM_NAV)}
      </nav>

      <Separator />

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {currentUser?.name ?? "Demo Admin"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {currentUser?.role ? ROLE_LABELS[currentUser.role] : "Super Admin"}
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 rounded-xl"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md lg:hidden">
          <Link
            href="/dashboard"
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size="sm" />
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Open navigation menu"
                    className="rounded-xl"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation menu</SheetTitle>
                </SheetHeader>
                {sidebarContent}
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageTransition key={pathname}>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
