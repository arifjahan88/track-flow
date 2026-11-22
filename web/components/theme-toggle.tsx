"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/components/theme-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({
  className,
  showLabel = false,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeMode();
  const hydrated = useHydrated();

  const isDark = hydrated ? theme === "dark" : true;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn("rounded-xl border-border/80", className)}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[var(--brand-amber)]" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--brand-blue)]" />
      )}
      {showLabel ? (
        <span className="text-xs font-medium">
          {isDark ? "Light mode" : "Dark mode"}
        </span>
      ) : null}
    </Button>
  );
}
