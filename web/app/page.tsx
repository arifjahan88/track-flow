"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const currentUserId = useAuthStore((s) => s.currentUserId);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(currentUserId ? "/dashboard" : "/login");
  }, [hydrated, currentUserId, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <BrandLogo size="lg" showSubtitle />
      <div className="flex w-48 flex-col gap-2">
        <Skeleton className="h-2.5 w-full rounded-full" />
        <Skeleton className="h-2.5 w-2/3 self-center rounded-full" />
      </div>
    </main>
  );
}
