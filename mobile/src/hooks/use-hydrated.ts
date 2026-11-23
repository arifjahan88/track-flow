import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import { useThemeStore } from "@/store/theme-store";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const checkAll = () => {
      const a = useAuthStore.persist?.hasHydrated?.() ?? true;
      const f = useFleetStore.persist?.hasHydrated?.() ?? true;
      const t = useThemeStore.persist?.hasHydrated?.() ?? true;
      if (a && f && t) {
        setHydrated(true);
      }
    };

    checkAll();

    const unsubAuth = useAuthStore.persist?.onFinishHydration?.(checkAll);
    const unsubFleet = useFleetStore.persist?.onFinishHydration?.(checkAll);
    const unsubTheme = useThemeStore.persist?.onFinishHydration?.(checkAll);

    // Fallback safety timer in case AsyncStorage resolves synchronously
    const fallback = setTimeout(() => setHydrated(true), 350);

    return () => {
      unsubAuth?.();
      unsubFleet?.();
      unsubTheme?.();
      clearTimeout(fallback);
    };
  }, []);

  return hydrated;
}
