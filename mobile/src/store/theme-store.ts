import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ThemePreference } from "@/types";
import { triggerLightHaptic } from "@/lib/haptics";
import { safeStateStorage } from "@/lib/storage";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: (currentResolved: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "dark",
      setPreference: (preference) => {
        triggerLightHaptic();
        set({ preference });
      },
      toggleTheme: (currentResolved) => {
        triggerLightHaptic();
        set({ preference: currentResolved === "dark" ? "light" : "dark" });
      },
    }),
    {
      name: "tf-mobile-theme",
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
    }
  )
);
