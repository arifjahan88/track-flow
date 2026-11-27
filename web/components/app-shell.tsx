"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuthStore } from "@/store/auth-store";
import { canAccessRoute, ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const activeRole = users.find((u) => u.id === currentUserId)?.role ?? "super_admin";

  const baseRoute = `/${pathname.split("/").filter(Boolean)[0] ?? "dashboard"}`;
  const isRouteAllowed = canAccessRoute(activeRole, baseRoute);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen",
          collapsed ? "w-18.5" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((prev) => !prev)} />
      </aside>

      {/* Mobile Drawer Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation menu</SheetTitle>
          </SheetHeader>
          <Sidebar isMobileSheet onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area with Sticky Topbar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />

        <main className="mx-auto w-full max-w-360 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageTransition key={pathname}>
            {isRouteAllowed ? (
              children
            ) : (
              <Card className="mx-auto mt-12 max-w-lg rounded-2xl border-amber-500/35">
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="size-6" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    Access Restricted ({ROLE_LABELS[activeRole]})
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your current role does not have permission to view{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{baseRoute}</code>.
                    You can only access modules and records assigned to your role.
                  </p>
                  <Link href="/dashboard" className="pt-1">
                    <Button
                      type="button"
                      className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Return to My Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
