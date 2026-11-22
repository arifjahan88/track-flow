import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  className?: string;
}

const ICON_SIZES = {
  sm: 28,
  md: 36,
  lg: 44,
} as const;

export function BrandLogo({
  size = "md",
  showSubtitle = false,
  className,
}: BrandLogoProps) {
  const px = ICON_SIZES[size];

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div
        className="relative shrink-0 overflow-hidden rounded-xl border border-border/80 bg-[#0b1522] shadow-sm"
        style={{ width: px, height: px }}
      >
        <Image
          src="/brand/trackflow-logo.jpg"
          alt="TrackFlow logo"
          width={px}
          height={px}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-xl"
          )}
        >
          TrackFlow
        </span>
        {showSubtitle ? (
          <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            Fleet &amp; GPS telemetry
          </span>
        ) : null}
      </div>
    </div>
  );
}
