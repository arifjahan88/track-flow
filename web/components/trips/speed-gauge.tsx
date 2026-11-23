"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SpeedGaugeProps {
  speedKmh: number;
  maxSpeedKmh?: number;
  isMoving: boolean;
}

export function SpeedGauge({
  speedKmh,
  maxSpeedKmh = 120,
  isMoving,
}: SpeedGaugeProps) {
  const clamped = Math.max(0, Math.min(maxSpeedKmh, speedKmh));
  const ratio = clamped / maxSpeedKmh;

  const radius = 76;
  const cx = 100;
  const cy = 96;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const isOverspeed = clamped >= 88;
  const isWarning = clamped >= 75 && clamped < 88;

  const strokeColor = !isMoving
    ? "#64748B"
    : isOverspeed
      ? "#F43F5E"
      : isWarning
        ? "#F59E0B"
        : "#06B6D4";

  const statusLabel = !isMoving
    ? "STANDBY"
    : isOverspeed
      ? "OVERSPEED"
      : isWarning
        ? "FAST CRUISE"
        : "OPTIMAL";

  const statusTone = !isMoving
    ? "text-slate-500 border-slate-500/30 bg-slate-500/10 dark:text-slate-400"
    : isOverspeed
      ? "text-rose-600 border-rose-500/40 bg-rose-500/15 dark:text-rose-400"
      : isWarning
        ? "text-amber-600 border-amber-500/40 bg-amber-500/15 dark:text-amber-400"
        : "text-cyan-600 border-cyan-500/40 bg-cyan-500/15 dark:text-cyan-400";

  const ticks = React.useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const angle = Math.PI + (i / 8) * Math.PI;
      const x1 = cx + (radius - 13) * Math.cos(angle);
      const y1 = cy + (radius - 13) * Math.sin(angle);
      const x2 = cx + (radius - 7) * Math.cos(angle);
      const y2 = cy + (radius - 7) * Math.sin(angle);
      return { x1, y1, x2, y2, i };
    });
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      <svg
        viewBox="0 0 200 118"
        className="h-32 w-full max-w-[230px] overflow-visible"
        aria-label={`Current speed ${Math.round(clamped)} km/h`}
      >
        <defs>
          <filter
            id="tf-gauge-glow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-slate-200 dark:text-white/10"
        />

        {/* Tick marks */}
        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            strokeWidth={t.i % 2 === 0 ? "1.8" : "1"}
            className="text-slate-400/50 dark:text-slate-500/50"
          />
        ))}

        {/* Active Speed Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          filter={isMoving ? "url(#tf-gauge-glow)" : undefined}
          style={{
            transition: "stroke-dashoffset 180ms ease-out, stroke 240ms ease",
          }}
        />

        {/* Scale Labels */}
        <text
          x={cx - radius + 2}
          y={cy + 16}
          textAnchor="middle"
          className="fill-slate-400 font-mono text-[9px]"
        >
          0
        </text>
        <text
          x={cx}
          y={cy - radius - 8}
          textAnchor="middle"
          className="fill-slate-400 font-mono text-[9px]"
        >
          {Math.round(maxSpeedKmh / 2)}
        </text>
        <text
          x={cx + radius - 2}
          y={cy + 16}
          textAnchor="middle"
          className="fill-slate-400 font-mono text-[9px]"
        >
          {maxSpeedKmh}
        </text>

        {/* Numeric Telemetry */}
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          className="fp-telemetry fill-foreground text-[32px] font-bold tracking-tight"
        >
          {Math.round(clamped)}
        </text>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="fp-telemetry fill-muted-foreground text-[10px] font-semibold tracking-widest uppercase"
        >
          KM/H
        </text>
      </svg>

      <span
        className={cn(
          "fp-telemetry -mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider",
          statusTone
        )}
      >
        {statusLabel}
      </span>
    </div>
  );
}
