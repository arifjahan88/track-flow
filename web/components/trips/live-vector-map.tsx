"use client";

import * as React from "react";
import {
  Crosshair,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { LiveVehicleFrame, VectorGeofence, Vehicle } from "@/types";
import {
  CITY_BLOCKS,
  CITY_HIGHWAYS,
  CITY_ROUTES,
  MAP_HEIGHT,
  MAP_LANDMARKS,
  MAP_WIDTH,
  getRouteById,
} from "@/lib/city-routes";
import { pointsToSvgPath } from "@/lib/geo-sim";

export interface GeofenceBannerEvent {
  id: string;
  vehicleName: string;
  plateNumber: string;
  geofenceName: string;
  color: string;
}

interface LiveVectorMapProps {
  vehicles: Vehicle[];
  frames: Record<string, LiveVehicleFrame>;
  geofences: VectorGeofence[];
  selectedVehicleId: string;
  initialFollowCamera?: boolean;
  onSelectVehicle: (vehicleId: string) => void;
  onToggleGeofence: (geofenceId: string) => void;
  isSimulating: boolean;
  onToggleSimulating: () => void;
  simSpeedMultiplier: 1 | 2 | 4;
  onChangeSimSpeed: (speed: 1 | 2 | 4) => void;
  activeBanner: GeofenceBannerEvent | null;
}

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.2;

export function LiveVectorMap({
  vehicles,
  frames,
  geofences,
  selectedVehicleId,
  initialFollowCamera = false,
  onSelectVehicle,
  onToggleGeofence,
  isSimulating,
  onToggleSimulating,
  simSpeedMultiplier,
  onChangeSimSpeed,
  activeBanner,
}: LiveVectorMapProps) {
  const [zoom, setZoom] = React.useState(1.05);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [followCamera, setFollowCamera] = React.useState(initialFollowCamera);
  const [showGeofencePanel, setShowGeofencePanel] = React.useState(false);
  const [showGeofencesLayer, setShowGeofencesLayer] = React.useState(true);
  const [isDragging, setIsDragging] = React.useState(false);

  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const selectedFrame = frames[selectedVehicleId];

  const effectivePan = React.useMemo(() => {
    if (followCamera && selectedFrame) {
      return {
        x: (MAP_WIDTH / 2 - selectedFrame.x) * zoom,
        y: (MAP_HEIGHT / 2 - selectedFrame.y) * zoom,
      };
    }
    return pan;
  }, [followCamera, selectedFrame, zoom, pan]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, [data-map-hud="true"]')) {
      return;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    if (followCamera) {
      setPan(effectivePan);
      setFollowCamera(false);
    }
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: followCamera ? effectivePan.x : pan.x,
      panY: followCamera ? effectivePan.y : pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) =>
      Number(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)).toFixed(2))
    );
  };

  const zoomIn = () =>
    setZoom((z) => Number(Math.min(MAX_ZOOM, z + 0.2).toFixed(2)));
  const zoomOut = () =>
    setZoom((z) => Number(Math.max(MIN_ZOOM, z - 0.2).toFixed(2)));
  const resetView = () => {
    setFollowCamera(false);
    setZoom(1.05);
    setPan({ x: 0, y: 0 });
  };

  const activeGeofenceCount = geofences.filter((g) => g.active).length;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      className="relative h-full min-h-[500px] w-full cursor-grab overflow-hidden rounded-2xl border border-border bg-[#070C18] select-none active:cursor-grabbing lg:min-h-[600px]"
    >
      {/* Subtle Ambient Vignette */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(4,8,16,0.65)_100%)]" />

      {/* Top-Left HUD: Playback Controls & Speed Multiplier */}
      <div
        data-map-hud="true"
        className="absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2"
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-white/12 bg-[#0F172A]/88 p-1.5 shadow-xl backdrop-blur-xl">
          <Button
            type="button"
            size="sm"
            onClick={onToggleSimulating}
            className={cn(
              "h-7 gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
              isSimulating
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            )}
          >
            {isSimulating ? (
              <>
                <Pause className="size-3.5" />
                Live
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                Resume
              </>
            )}
          </Button>

          <div className="mx-0.5 h-4 w-px bg-white/10" />

          {([1, 2, 4] as const).map((mult) => (
            <button
              key={mult}
              type="button"
              onClick={() => onChangeSimSpeed(mult)}
              className={cn(
                "fp-telemetry h-7 rounded-lg px-2 text-xs font-semibold transition-all",
                simSpeedMultiplier === mult
                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {mult}x
            </button>
          ))}
        </div>

        {/* Geofences Toggle Button */}
        <button
          type="button"
          onClick={() => setShowGeofencePanel((prev) => !prev)}
          className={cn(
            "flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-medium shadow-xl backdrop-blur-xl transition-colors",
            showGeofencePanel
              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
              : "border-white/12 bg-[#0F172A]/88 text-slate-200 hover:border-white/25"
          )}
        >
          <Shield className="size-3.5 text-cyan-400" />
          <span>Geofences</span>
          <span className="fp-telemetry rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-cyan-300">
            {activeGeofenceCount}/{geofences.length}
          </span>
        </button>
      </div>

      {/* Geofence Popover Panel */}
      {showGeofencePanel ? (
        <div
          data-map-hud="true"
          className="absolute top-16 left-3.5 z-20 w-72 rounded-xl border border-white/12 bg-[#0F172A]/95 p-3.5 text-slate-100 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-cyan-400" />
              <span className="text-xs font-semibold">Geofence Perimeters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Layer</span>
              <Switch
                checked={showGeofencesLayer}
                onCheckedChange={setShowGeofencesLayer}
              />
            </div>
          </div>
          <div className="space-y-2">
            {geofences.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: zone.color,
                      boxShadow: `0 0 8px ${zone.color}`,
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">
                      {zone.name}
                    </p>
                    <p className="fp-telemetry text-[10px] text-slate-400">
                      R={zone.radiusMeters}m
                    </p>
                  </div>
                </div>
                <Switch
                  checked={zone.active}
                  onCheckedChange={() => onToggleGeofence(zone.id)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Top-Center Live Geofence Entry Banner */}
      {activeBanner ? (
        <div
          data-map-hud="true"
          className="pointer-events-none absolute top-3.5 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/15 bg-[#0F172A]/92 px-4 py-2 text-xs text-white shadow-2xl backdrop-blur-xl xl:flex"
        >
          <span
            className="animate-fp-pulse-dot size-2.5 rounded-full"
            style={{
              backgroundColor: activeBanner.color,
              boxShadow: `0 0 10px ${activeBanner.color}`,
            }}
          />
          <Sparkles className="size-3.5 text-cyan-400" />
          <span className="font-semibold">{activeBanner.vehicleName}</span>
          <span className="fp-telemetry text-slate-400">
            ({activeBanner.plateNumber})
          </span>
          <span className="text-slate-300">entered</span>
          <span className="font-semibold" style={{ color: activeBanner.color }}>
            {activeBanner.geofenceName}
          </span>
        </div>
      ) : null}

      {/* Top-Right HUD: Zoom, Reset & Follow Camera Lock */}
      <div
        data-map-hud="true"
        className="absolute top-3.5 right-3.5 z-20 flex flex-col items-end gap-2"
      >
        <div className="flex items-center gap-1 rounded-xl border border-white/12 bg-[#0F172A]/88 p-1 shadow-xl backdrop-blur-xl">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            className="text-slate-200 hover:bg-white/10 hover:text-white"
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </Button>
          <span className="fp-telemetry w-12 text-center text-xs font-semibold text-cyan-300">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            className="text-slate-200 hover:bg-white/10 hover:text-white"
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
          <div className="mx-0.5 h-4 w-px bg-white/10" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={resetView}
            className="text-slate-200 hover:bg-white/10 hover:text-white"
            aria-label="Reset camera view"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setFollowCamera((f) => !f)}
          className={cn(
            "h-8 gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-xl backdrop-blur-xl",
            followCamera
              ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:bg-cyan-500/30"
              : "border-white/12 bg-[#0F172A]/88 text-slate-300 hover:bg-[#16213A] hover:text-white"
          )}
        >
          <Crosshair
            className={cn("size-3.5", followCamera && "animate-spin")}
          />
          {followCamera ? "Camera Locked" : "Follow Camera"}
        </Button>
      </div>

      {/* Bottom-Left HUD: Route Legend */}
      <div
        data-map-hud="true"
        className="absolute bottom-3.5 left-3.5 z-20 hidden items-center gap-3 rounded-xl border border-white/10 bg-[#0F172A]/85 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-xl sm:flex"
      >
        {CITY_ROUTES.map((route) => (
          <div key={route.id} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: route.color,
                boxShadow: `0 0 8px ${route.color}`,
              }}
            />
            <span className="fp-telemetry text-[10px] text-slate-300">
              {route.code}
            </span>
          </div>
        ))}
        <div className="h-3 w-px bg-white/10" />
        <span className="text-[10px] text-slate-400">
          Drag to pan · Scroll to zoom
        </span>
      </div>

      {/* Interactive Live Vector SVG Canvas */}
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="tf-map-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(56, 189, 248, 0.065)"
              strokeWidth="1"
            />
          </pattern>

          <filter
            id="tf-neon-glow"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="3.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="tf-water-grad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0C243D" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#071324" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* Camera Pan & Zoom Transform Group */}
        <g
          transform={`translate(${MAP_WIDTH / 2 + effectivePan.x}, ${MAP_HEIGHT / 2 + effectivePan.y}) scale(${zoom}) translate(${-MAP_WIDTH / 2}, ${-MAP_HEIGHT / 2})`}
          style={{
            transition: isDragging
              ? "none"
              : followCamera
                ? "transform 120ms linear"
                : "transform 160ms ease-out",
          }}
        >
          {/* Base Map Canvas + Grid */}
          <rect
            x={-200}
            y={-200}
            width={MAP_WIDTH + 400}
            height={MAP_HEIGHT + 400}
            fill="#070C18"
          />
          <rect
            x={-200}
            y={-200}
            width={MAP_WIDTH + 400}
            height={MAP_HEIGHT + 400}
            fill="url(#tf-map-grid)"
          />

          {/* Bayfront Water Polygon */}
          <path
            d="M 850 0 L 1160 0 L 1160 720 L 760 720 Q 805 560 855 460 Q 900 330 870 185 Q 845 90 850 0 Z"
            fill="url(#tf-water-grad)"
            stroke="rgba(6, 182, 212, 0.16)"
            strokeWidth="1.5"
          />

          {/* Urban City Blocks */}
          {CITY_BLOCKS.map((b, idx) => (
            <rect
              key={idx}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={b.rx}
              fill="rgba(15, 23, 42, 0.72)"
              stroke="rgba(148, 163, 184, 0.08)"
              strokeWidth="1"
            />
          ))}

          {/* City Highway & Arterial Roads */}
          {CITY_HIGHWAYS.map((d, idx) => (
            <g key={idx}>
              <path
                d={d}
                fill="none"
                stroke="rgba(30, 41, 59, 0.85)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke="rgba(148, 163, 184, 0.16)"
                strokeWidth="1.2"
                strokeDasharray="6 8"
              />
            </g>
          ))}

          {/* Base Faint Corridor Outlines */}
          {CITY_ROUTES.map((route) => (
            <path
              key={route.id}
              d={pointsToSvgPath(route.waypoints)}
              fill="none"
              stroke={route.color}
              strokeOpacity="0.14"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Map Landmarks */}
          {MAP_LANDMARKS.map((lm) => (
            <text
              key={lm.label}
              x={lm.x}
              y={lm.y}
              textAnchor="middle"
              className="fill-slate-500/70 font-mono text-[8.5px] font-semibold tracking-[0.18em]"
            >
              {lm.label}
            </text>
          ))}

          {/* Geofence Zones Layer */}
          {showGeofencesLayer &&
            geofences.map((zone) => {
              if (!zone.active) return null;
              return (
                <g key={zone.id}>
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={zone.radius}
                    fill={zone.color}
                    fillOpacity="0.09"
                    stroke={zone.color}
                    strokeOpacity="0.55"
                    strokeWidth="1.6"
                    strokeDasharray="6 4"
                  />
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={3.5}
                    fill={zone.color}
                    fillOpacity="0.85"
                  />
                  <g
                    transform={`translate(${zone.x}, ${zone.y - zone.radius - 8})`}
                  >
                    <rect
                      x={-68}
                      y={-12}
                      width={136}
                      height={18}
                      rx={6}
                      fill="rgba(7, 11, 20, 0.86)"
                      stroke={zone.color}
                      strokeOpacity="0.45"
                      strokeWidth="1"
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={zone.color}
                      className="font-mono text-[8.5px] font-semibold"
                    >
                      {zone.name.toUpperCase()}
                    </text>
                  </g>
                </g>
              );
            })}

          {/* Active Vehicle Covered & Remaining Animated Route Polylines */}
          {vehicles.map((vehicle) => {
            const frame = frames[vehicle.id];
            if (!frame) return null;
            const isSelected = vehicle.id === selectedVehicleId;
            if (vehicle.status !== "on_trip" && !isSelected) return null;

            const route = getRouteById(vehicle.routeId);
            const coveredPath = pointsToSvgPath(frame.coveredPoints);
            const remainingPath = pointsToSvgPath(frame.remainingPoints);

            return (
              <g key={`route-${vehicle.id}`} opacity={isSelected ? 1 : 0.65}>
                {remainingPath ? (
                  <path
                    d={remainingPath}
                    fill="none"
                    stroke={route.color}
                    strokeOpacity={isSelected ? 0.58 : 0.35}
                    strokeWidth={isSelected ? 3 : 2.2}
                    strokeDasharray="10 8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-fp-dash"
                  />
                ) : null}

                {coveredPath ? (
                  <path
                    d={coveredPath}
                    fill="none"
                    stroke={route.color}
                    strokeWidth={isSelected ? 4 : 2.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#tf-neon-glow)"
                  />
                ) : null}
              </g>
            );
          })}

          {/* Vehicle Markers (Sonar Rings + Heading-Rotated Arrow + Floating Plate Badge) */}
          {vehicles.map((vehicle) => {
            const frame = frames[vehicle.id];
            if (!frame) return null;

            const isMoving = vehicle.status === "on_trip";
            const isSelected = vehicle.id === selectedVehicleId;
            const route = getRouteById(vehicle.routeId);
            const markerColor =
              vehicle.status === "under_maintenance"
                ? "#F59E0B"
                : vehicle.status === "out_of_service" ||
                    vehicle.status === "decommissioned"
                  ? "#64748B"
                  : isMoving
                    ? route.color
                    : "#10B981";

            return (
              <g
                key={vehicle.id}
                transform={`translate(${frame.x}, ${frame.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectVehicle(vehicle.id);
                }}
                className="cursor-pointer"
              >
                {isMoving ? (
                  <>
                    <circle
                      cx={0}
                      cy={0}
                      r={14}
                      fill="none"
                      stroke={markerColor}
                      strokeWidth="1.8"
                      className="animate-fp-sonar"
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={14}
                      fill="none"
                      stroke={markerColor}
                      strokeWidth="1.4"
                      className="animate-fp-sonar-delayed"
                    />
                  </>
                ) : null}

                {isSelected ? (
                  <circle
                    cx={0}
                    cy={0}
                    r={22}
                    fill={markerColor}
                    fillOpacity="0.14"
                    stroke={markerColor}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                ) : null}

                <g transform={`rotate(${frame.headingDeg})`}>
                  <circle
                    cx={0}
                    cy={0}
                    r={12}
                    fill="#091224"
                    stroke={markerColor}
                    strokeWidth={isSelected ? "2.4" : "1.8"}
                    filter={
                      isMoving || isSelected ? "url(#tf-neon-glow)" : undefined
                    }
                  />
                  <path
                    d="M 0 -7.5 L 5.8 5.8 L 0 2.6 L -5.8 5.8 Z"
                    fill={markerColor}
                  />
                </g>

                <g transform="translate(0, -26)">
                  <rect
                    x={-56}
                    y={-12}
                    width={112}
                    height={20}
                    rx={6}
                    fill={
                      isSelected
                        ? "rgba(6, 182, 212, 0.22)"
                        : "rgba(9, 15, 29, 0.9)"
                    }
                    stroke={
                      isSelected ? "#22D3EE" : "rgba(255, 255, 255, 0.16)"
                    }
                    strokeWidth={isSelected ? "1.3" : "1"}
                  />
                  <text
                    x={0}
                    y={-1.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fp-telemetry fill-white text-[9px] font-bold"
                  >
                    {vehicle.plate} · {Math.round(frame.speedKmh)} km/h
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
