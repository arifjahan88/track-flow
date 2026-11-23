"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const currentUserId = useAuthStore((s) => s.currentUserId);

  useEffect(() => {
    if (!hydrated) return;
    if (!currentUserId) {
      router.replace("/login");
    }
  }, [hydrated, currentUserId, router]);

  const isAuthorized = hydrated && Boolean(currentUserId);

  return (
    <>
      {!isAuthorized ? (
        <div className="flex min-h-screen bg-background">
          <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-5 lg:block">
            <Skeleton className="h-9 w-36 rounded-xl" />
            <div className="mt-8 space-y-2.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          </aside>
          <div className="flex-1 p-6 lg:p-8">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
            <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
          </div>
        </div>
      ) : null}

      <div
        className={isAuthorized ? undefined : "hidden"}
        aria-hidden={!isAuthorized || undefined}
      >
        {children}
      </div>
    </>
  );
}
