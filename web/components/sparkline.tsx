"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  values: readonly number[];
  labels?: readonly string[];
  unit?: string;
  className?: string;
}

export function Sparkline({
  values,
  labels,
  unit = "km/L",
  className,
}: SparklineProps) {
  const gradientId = useId();

  if (values.length < 2) {
    return (
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-3 text-xs text-muted-foreground",
          className
        )}
      >
        Add at least two full-tank logs to plot an efficiency trend.
      </div>
    );
  }

  const width = 260;
  const height = 64;
  const padX = 10;
  const padY = 10;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const coords = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (width - padX * 2);
    const y = height - padY - ((v - minVal) / range) * (height - padY * 2);
    return { x, y, v, label: labels?.[i] };
  });

  const linePath = coords
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - 2} L ${coords[0].x.toFixed(1)} ${height - 2} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-16 w-full overflow-visible"
        role="img"
        aria-label={`Fuel efficiency trend from ${values[0]} to ${values[values.length - 1]} ${unit}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-teal)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--brand-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--brand-teal)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={idx === coords.length - 1 ? 4 : 2.5}
            fill={
              idx === coords.length - 1
                ? "var(--brand-amber)"
                : "var(--brand-teal)"
            }
          >
            <title>
              {pt.label ? `${pt.label}: ` : ""}
              {pt.v} {unit}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
