"use client";

import { useId, useMemo, useState } from "react";
import {
  Compass,
  Crosshair,
  Layers,
  Maximize2,
  Minus,
  Navigation,
  Plus,
} from "lucide-react";
import type { GeofenceZone, LatLng, TrackPoint } from "@/types";
import {
  computeBearingDegrees,
  formatCardinalDirection,
  haversineKm,
  ROUTE_WAYPOINTS,
} from "@/lib/geo";
import { cn } from "@/lib/utils";

interface RouteMapProps {
  points: readonly TrackPoint[];
  live?: boolean;
  showPlannedRoute?: boolean;
  activeWaypointIndex?: number;
  headingDeg?: number;
  geofences?: readonly GeofenceZone[];
  className?: string;
}

type MapStyleMode = "night" | "street" | "radar";

const VIEW_WIDTH = 920;
const VIEW_HEIGHT = 540;
const PADDING = 62;

// Stylized water polygons in Dhaka (Gulshan Lake & Hatirjheel Lake) in LatLng space
const GULSHAN_LAKE_POLY: readonly LatLng[] = [
  { lat: 23.7985, lng: 90.4112 },
  { lat: 23.7962, lng: 90.4131 },
  { lat: 23.7885, lng: 90.4162 },
  { lat: 23.7825, lng: 90.4175 },
  { lat: 23.7822, lng: 90.4148 },
  { lat: 23.7892, lng: 90.4126 },
  { lat: 23.7958, lng: 90.4096 },
];

const HATIRJHEEL_LAKE_POLY: readonly LatLng[] = [
  { lat: 23.7808, lng: 90.4258 },
  { lat: 23.7775, lng: 90.4248 },
  { lat: 23.7728, lng: 90.4212 },
  { lat: 23.7675, lng: 90.4158 },
  { lat: 23.7652, lng: 90.4088 },
  { lat: 23.7688, lng: 90.4068 },
  { lat: 23.7732, lng: 90.4138 },
  { lat: 23.7778, lng: 90.4192 },
  { lat: 23.7812, lng: 90.4228 },
];

// Surrounding secondary arterial roads in Dhaka for authentic map context
const ARTERIAL_ROADS: readonly (readonly LatLng[])[] = [
  // Tejgaon - Gulshan Avenue Spine
  [
    { lat: 23.801, lng: 90.4065 },
    { lat: 23.7925, lng: 90.4078 },
    { lat: 23.781, lng: 90.4082 },
    { lat: 23.769, lng: 90.4062 },
    { lat: 23.757, lng: 90.4055 },
  ],
  // Pragati Sarani - Rampura Corridor
  [
    { lat: 23.801, lng: 90.4215 },
    { lat: 23.794, lng: 90.4222 },
    { lat: 23.789, lng: 90.423 },
    { lat: 23.78, lng: 90.425 },
    { lat: 23.768, lng: 90.4268 },
    { lat: 23.757, lng: 90.4275 },
  ],
  // Cross Connectors
  [
    { lat: 23.793, lng: 90.401 },
    { lat: 23.7925, lng: 90.4078 },
    { lat: 23.796, lng: 90.415 },
    { lat: 23.7975, lng: 90.429 },
  ],
  [
    { lat: 23.7815, lng: 90.401 },
    { lat: 23.7805, lng: 90.412 },
    { lat: 23.78, lng: 90.425 },
    { lat: 23.7795, lng: 90.431 },
  ],
  [
    { lat: 23.7665, lng: 90.401 },
    { lat: 23.766, lng: 90.412 },
    { lat: 23.765, lng: 90.427 },
  ],
  [
    { lat: 23.7595, lng: 90.402 },
    { lat: 23.76, lng: 90.416 },
    { lat: 23.7605, lng: 90.429 },
  ],
];

export function RouteMap({
  points,
  live = false,
  showPlannedRoute = true,
  activeWaypointIndex = 0,
  headingDeg,
  geofences = [],
  className,
}: RouteMapProps) {
  const uid = useId();
  const glowId = `route-glow-${uid}`;
  const pulseGlowId = `pulse-glow-${uid}`;

  const [zoom, setZoom] = useState(1);
  const [followVehicle, setFollowVehicle] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>("night");

  // Compute bounding box from either the planned corridor + recorded points or recorded points alone
  const projection = useMemo(() => {
    const referencePoints: LatLng[] = [];
    if (showPlannedRoute) {
      referencePoints.push(...ROUTE_WAYPOINTS);
    }
    for (const pt of points) {
      referencePoints.push(pt);
    }
    if (referencePoints.length < 2) {
      referencePoints.push(...ROUTE_WAYPOINTS);
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const pt of referencePoints) {
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lng < minLng) minLng = pt.lng;
      if (pt.lng > maxLng) maxLng = pt.lng;
    }

    const avgLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const lngScale = Math.cos(avgLatRad);

    const spanLng = Math.max((maxLng - minLng) * lngScale, 0.004);
    const spanLat = Math.max(maxLat - minLat, 0.004);

    const usableW = VIEW_WIDTH - PADDING * 2;
    const usableH = VIEW_HEIGHT - PADDING * 2;
    const scale = Math.min(usableW / spanLng, usableH / spanLat);

    const drawW = spanLng * scale;
    const drawH = spanLat * scale;
    const offsetX = PADDING + (usableW - drawW) / 2;
    const offsetY = PADDING + (usableH - drawH) / 2;

    const project = (pt: LatLng) => ({
      x: offsetX + (pt.lng - minLng) * lngScale * scale,
      y: offsetY + (maxLat - pt.lat) * scale,
    });

    return { project };
  }, [points, showPlannedRoute]);

  const projectedPoints = useMemo(
    () => points.map((pt) => projection.project(pt)),
    [points, projection]
  );

  const projectedWaypoints = useMemo(
    () =>
      ROUTE_WAYPOINTS.map((wp, idx) => ({
        ...wp,
        idx,
        ...projection.project(wp),
      })),
    [projection]
  );

  const gulshanLakeSvg = useMemo(
    () =>
      GULSHAN_LAKE_POLY.map((pt, i) => {
        const p = projection.project(pt);
        return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }).join(" ") + " Z",
    [projection]
  );

  const hatirjheelLakeSvg = useMemo(
    () =>
      HATIRJHEEL_LAKE_POLY.map((pt, i) => {
        const p = projection.project(pt);
        return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }).join(" ") + " Z",
    [projection]
  );

  const arterialPaths = useMemo(
    () =>
      ARTERIAL_ROADS.map((road) =>
        road
          .map((pt, i) => {
            const p = projection.project(pt);
            return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
          })
          .join(" ")
      ),
    [projection]
  );

  const projectedGeofences = useMemo(() => {
    return geofences
      .filter((z) => z.active && z.polygon.length >= 3)
      .map((zone) => {
        const pts = zone.polygon.map((pt) => projection.project(pt));
        const path =
          pts
            .map(
              (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
            )
            .join(" ") + " Z";
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        return { zone, path, cx, cy };
      });
  }, [geofences, projection]);

  const plannedPathData = useMemo(
    () =>
      projectedWaypoints
        .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(" "),
    [projectedWaypoints]
  );

  const traveledPathData = useMemo(() => {
    if (projectedPoints.length < 2) return "";
    return projectedPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(" ");
  }, [projectedPoints]);

  // Compute live vehicle heading
  const calculatedHeading = useMemo(() => {
    if (typeof headingDeg === "number") return headingDeg;
    if (points.length >= 2) {
      return computeBearingDegrees(
        points[points.length - 2],
        points[points.length - 1]
      );
    }
    if (ROUTE_WAYPOINTS.length >= 2) {
      return computeBearingDegrees(ROUTE_WAYPOINTS[0], ROUTE_WAYPOINTS[1]);
    }
    return 90;
  }, [headingDeg, points]);

  const currentMarkerPos =
    projectedPoints.length > 0
      ? projectedPoints[projectedPoints.length - 1]
      : projectedWaypoints[0];

  const startMarkerPos =
    projectedPoints.length > 0 ? projectedPoints[0] : projectedWaypoints[0];

  // Camera transform for zoom & follow-vehicle mode
  const cameraTransform = useMemo(() => {
    const effectiveZoom = followVehicle ? Math.max(zoom, 1.45) : zoom;
    if (effectiveZoom === 1 && !followVehicle) {
      return undefined;
    }
    const centerX = followVehicle && currentMarkerPos ? currentMarkerPos.x : VIEW_WIDTH / 2;
    const centerY = followVehicle && currentMarkerPos ? currentMarkerPos.y : VIEW_HEIGHT / 2;
    const tx = VIEW_WIDTH / 2 - centerX * effectiveZoom;
    const ty = VIEW_HEIGHT / 2 - centerY * effectiveZoom;
    return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${effectiveZoom.toFixed(2)})`;
  }, [zoom, followVehicle, currentMarkerPos]);

  const cycleMapStyle = () => {
    setMapStyle((prev) =>
      prev === "night" ? "street" : prev === "street" ? "radar" : "night"
    );
  };

  const bgSurface =
    mapStyle === "night"
      ? "#050f18"
      : mapStyle === "street"
        ? "#0b1a27"
        : "#030b12";

  const waterFill =
    mapStyle === "night"
      ? "rgba(6, 182, 212, 0.11)"
      : mapStyle === "street"
        ? "rgba(14, 165, 233, 0.16)"
        : "rgba(34, 211, 238, 0.08)";

  const roadCasingColor =
    mapStyle === "night"
      ? "rgba(27, 56, 79, 0.65)"
      : mapStyle === "street"
        ? "rgba(38, 76, 105, 0.78)"
        : "rgba(34, 211, 238, 0.22)";

  const roadFillColor =
    mapStyle === "night"
      ? "rgba(15, 34, 50, 0.9)"
      : mapStyle === "street"
        ? "rgba(22, 48, 68, 0.95)"
        : "rgba(7, 22, 34, 0.9)";

  // Intermediate direction chevrons along the traveled path
  const routeChevrons = useMemo(() => {
    if (projectedPoints.length < 18) return [];
    const step = Math.max(25, Math.floor(projectedPoints.length / 6));
    const list: { x: number; y: number; angle: number }[] = [];
    for (let i = step; i < projectedPoints.length - 8; i += step) {
      const prev = projectedPoints[i - 2];
      const curr = projectedPoints[i];
      if (!prev || !curr) continue;
      const angle = (Math.atan2(curr.y - prev.y, curr.x - prev.x) * 180) / Math.PI;
      list.push({ x: curr.x, y: curr.y, angle });
    }
    return list;
  }, [projectedPoints]);

  const scaleLabelMeters = Math.round(500 / (followVehicle ? Math.max(zoom, 1.45) : zoom));

  return (
    <div
      className={cn(
        "relative min-h-[420px] w-full overflow-hidden rounded-2xl border border-border select-none",
        className
      )}
      style={{ backgroundColor: bgSurface }}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label={`Interactive GPS navigation map with ${points.length} recorded points`}
      >
        <defs>
          <pattern
            id={`minor-grid-${uid}`}
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="rgba(34, 211, 238, 0.06)"
              strokeWidth="0.75"
            />
          </pattern>
          <pattern
            id={`major-grid-${uid}`}
            width="140"
            height="140"
            patternUnits="userSpaceOnUse"
          >
            <rect width="140" height="140" fill={`url(#minor-grid-${uid})`} />
            <path
              d="M 140 0 L 0 0 0 140"
              fill="none"
              stroke="rgba(34, 211, 238, 0.14)"
              strokeWidth="1"
            />
          </pattern>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={pulseGlowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Camera viewport group */}
        <g
          style={{
            transform: cameraTransform,
            transition: "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Cartographic Coordinate Grid */}
          <rect
            x="-400"
            y="-400"
            width={VIEW_WIDTH + 800}
            height={VIEW_HEIGHT + 800}
            fill={`url(#major-grid-${uid})`}
          />

          {/* Radar concentric rings in radar mode */}
          {mapStyle === "radar" && currentMarkerPos ? (
            <g opacity="0.35">
              {[90, 180, 270, 360].map((r) => (
                <circle
                  key={r}
                  cx={currentMarkerPos.x}
                  cy={currentMarkerPos.y}
                  r={r}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
            </g>
          ) : null}

          {/* Water bodies: Gulshan Lake & Hatirjheel Lake */}
          <path
            d={gulshanLakeSvg}
            fill={waterFill}
            stroke="rgba(34, 211, 238, 0.24)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d={hatirjheelLakeSvg}
            fill={waterFill}
            stroke="rgba(34, 211, 238, 0.28)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />

          {/* Geofence Zone Polygons */}
          {projectedGeofences.map(({ zone, path, cx, cy }) => {
            const fill =
              zone.type === "restricted"
                ? "rgba(239, 68, 68, 0.16)"
                : zone.type === "warehouse"
                  ? "rgba(6, 182, 212, 0.15)"
                  : "rgba(56, 189, 248, 0.15)";
            const stroke =
              zone.type === "restricted"
                ? "rgba(248, 113, 113, 0.8)"
                : zone.type === "warehouse"
                  ? "rgba(34, 211, 238, 0.78)"
                  : "rgba(56, 189, 248, 0.78)";
            return (
              <g key={zone.id}>
                <path
                  d={path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.6"
                  strokeDasharray={zone.type === "restricted" ? "6 4" : "4 3"}
                />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fill={stroke}
                  fontSize="9.5"
                  fontWeight="700"
                  style={{ letterSpacing: "0.05em" }}
                >
                  {zone.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Water labels */}
          <text
            x="455"
            y="188"
            fill="rgba(34, 211, 238, 0.38)"
            fontSize="10"
            fontStyle="italic"
            letterSpacing="1.5"
            className="font-mono uppercase"
          >
            Gulshan Lake
          </text>
          <text
            x="485"
            y="348"
            fill="rgba(34, 211, 238, 0.42)"
            fontSize="10"
            fontStyle="italic"
            letterSpacing="1.6"
            className="font-mono uppercase"
          >
            Hatirjheel Lake
          </text>

          {/* Surrounding Urban Arterial Road Network */}
          {arterialPaths.map((d, idx) => (
            <g key={idx}>
              <path
                d={d}
                fill="none"
                stroke={roadCasingColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={d}
                fill="none"
                stroke={roadFillColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Main Navigation Corridor Road Bed */}
          {showPlannedRoute ? (
            <g>
              <path
                d={plannedPathData}
                fill="none"
                stroke="rgba(6, 182, 212, 0.16)"
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={plannedPathData}
                fill="none"
                stroke="rgba(12, 31, 46, 0.95)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Planned route guidance centerline (dashed cyan) */}
              <path
                d={plannedPathData}
                fill="none"
                stroke="rgba(34, 211, 238, 0.48)"
                strokeWidth="3"
                strokeDasharray="8 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}

          {/* Traveled Active Route Path */}
          {traveledPathData ? (
            <g>
              {/* Wide cyan aura */}
              <path
                d={traveledPathData}
                fill="none"
                stroke="#06b6d4"
                strokeOpacity="0.28"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Crisp illuminated cyan route trace */}
              <path
                d={traveledPathData}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowId})`}
              />
              {/* Inner high-visibility core */}
              <path
                d={traveledPathData}
                fill="none"
                stroke="#e0f2fe"
                strokeOpacity="0.65"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : null}

          {/* Directional flow chevrons along traveled route */}
          {routeChevrons.map((c, idx) => (
            <g
              key={idx}
              transform={`translate(${c.x.toFixed(1)}, ${c.y.toFixed(1)}) rotate(${c.angle.toFixed(1)})`}
            >
              <path
                d="M -3.5 -3.5 L 2.5 0 L -3.5 3.5"
                fill="none"
                stroke="#03121a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Named Dhaka Corridor Waypoint Nodes & Callouts */}
          {showPlannedRoute
            ? projectedWaypoints.map((wp) => {
                const isPassed = wp.idx < activeWaypointIndex;
                const isNext = wp.idx === activeWaypointIndex && live;
                const isDestination = wp.idx === projectedWaypoints.length - 1;
                const labelOnLeft = wp.idx % 2 === 1;

                return (
                  <g
                    key={wp.id}
                    transform={`translate(${wp.x.toFixed(1)}, ${wp.y.toFixed(1)})`}
                  >
                    {isNext ? (
                      <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="1.5"
                        strokeOpacity="0.6"
                        className="tf-live-pulse"
                      />
                    ) : null}

                    <circle
                      cx="0"
                      cy="0"
                      r={isDestination ? "7.5" : "5.5"}
                      fill={
                        isPassed
                          ? "#06b6d4"
                          : isNext
                            ? "#22d3ee"
                            : isDestination
                              ? "#f59e0b"
                              : "#0c1d2b"
                      }
                      stroke={
                        isDestination
                          ? "#fef3c7"
                          : isPassed || isNext
                            ? "#e0f2fe"
                            : "#22d3ee"
                      }
                      strokeWidth="2"
                    />

                    {/* Waypoint Map Label Pill */}
                    <g
                      transform={`translate(${labelOnLeft ? -12 : 12}, -4)`}
                    >
                      <rect
                        x={labelOnLeft ? -136 : 0}
                        y="-11"
                        width="136"
                        height="22"
                        rx="6"
                        fill="rgba(7, 19, 28, 0.86)"
                        stroke={
                          isNext
                            ? "rgba(34, 211, 238, 0.75)"
                            : isDestination
                              ? "rgba(245, 158, 11, 0.65)"
                              : "rgba(27, 56, 79, 0.9)"
                        }
                        strokeWidth="1"
                      />
                      <text
                        x={labelOnLeft ? -68 : 68}
                        y="3.5"
                        textAnchor="middle"
                        fill={
                          isNext
                            ? "#22d3ee"
                            : isDestination
                              ? "#fbbf24"
                              : "#cbd5e1"
                        }
                        fontSize="9.5"
                        fontWeight="600"
                      >
                        {wp.name}
                      </text>
                    </g>
                  </g>
                );
              })
            : null}

          {/* Origin ring marker when a custom GPS route is drawn */}
          {startMarkerPos ? (
            <g
              transform={`translate(${startMarkerPos.x.toFixed(1)}, ${startMarkerPos.y.toFixed(1)})`}
            >
              <circle
                cx="0"
                cy="0"
                r="8"
                fill="#07131c"
                stroke="#22d3ee"
                strokeWidth="3"
              />
              <circle cx="0" cy="0" r="3" fill="#22d3ee" />
            </g>
          ) : null}

          {/* Live Directional Vehicle Navigation Puck */}
          {currentMarkerPos ? (
            <g
              style={{
                transform: `translate(${currentMarkerPos.x.toFixed(1)}px, ${currentMarkerPos.y.toFixed(1)}px)`,
                transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Outer radar pulse */}
              {live ? (
                <>
                  <circle
                    cx="0"
                    cy="0"
                    r="24"
                    fill="#22d3ee"
                    fillOpacity="0.2"
                    className="tf-live-pulse origin-center"
                  />
                  {/* Forward headlight beam cone */}
                  <g transform={`rotate(${calculatedHeading.toFixed(1)})`}>
                    <path
                      d="M 0 0 L -20 -46 A 48 48 0 0 1 20 -46 Z"
                      fill="#22d3ee"
                      fillOpacity="0.16"
                    />
                  </g>
                </>
              ) : null}

              {/* Crisp circular navigator shield */}
              <circle
                cx="0"
                cy="0"
                r="14"
                fill="#07131c"
                stroke="#22d3ee"
                strokeWidth="2.5"
                filter={`url(#${pulseGlowId})`}
              />

              {/* Rotating directional navigation arrow */}
              <g transform={`rotate(${calculatedHeading.toFixed(1)})`}>
                <path
                  d="M 0 -8.5 L 6.5 6.5 L 0 3.2 L -6.5 6.5 Z"
                  fill="#22d3ee"
                  stroke="#03121a"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          ) : null}
        </g>
      </svg>

      {/* Right-Edge Interactive Map Controls Dock */}
      <div className="absolute top-20 right-3.5 z-20 flex flex-col gap-1.5">
        {/* Compass & Heading Indicator */}
        <div
          title={`Heading ${Math.round(calculatedHeading)}° ${formatCardinalDirection(calculatedHeading)}`}
          className="glass flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center shadow-md"
        >
          <Compass
            className="h-4 w-4 text-[#22d3ee] transition-transform duration-300"
            style={{ transform: `rotate(${calculatedHeading}deg)` }}
          />
          <span className="mt-0.5 font-mono text-[10px] font-semibold text-foreground">
            {Math.round(calculatedHeading)}°
          </span>
          <span className="font-mono text-[9px] text-[#22d3ee]">
            {formatCardinalDirection(calculatedHeading)}
          </span>
        </div>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))}
          aria-label="Zoom in map"
          title="Zoom in"
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-foreground shadow-md transition-colors hover:border-[#22d3ee]/60 hover:text-[#22d3ee]"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.25).toFixed(2))))}
          aria-label="Zoom out map"
          title="Zoom out"
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-foreground shadow-md transition-colors hover:border-[#22d3ee]/60 hover:text-[#22d3ee]"
        >
          <Minus className="h-4 w-4" />
        </button>

        {/* Follow Vehicle vs Full Route Overview */}
        <button
          type="button"
          onClick={() => setFollowVehicle((f) => !f)}
          aria-label={followVehicle ? "Show full route overview" : "Lock camera on vehicle"}
          title={followVehicle ? "Unlock camera (Fit route)" : "Follow vehicle"}
          className={cn(
            "glass flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition-colors",
            followVehicle
              ? "border-[#22d3ee] bg-[#06b6d4]/20 text-[#22d3ee]"
              : "text-foreground hover:border-[#22d3ee]/60 hover:text-[#22d3ee]"
          )}
        >
          {followVehicle ? (
            <Crosshair className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* Map Layer Mode Switcher */}
        <button
          type="button"
          onClick={cycleMapStyle}
          aria-label="Switch map layer style"
          title={`Map style: ${mapStyle}`}
          className="glass flex h-9 w-9 items-center justify-center rounded-xl text-foreground shadow-md transition-colors hover:border-[#22d3ee]/60 hover:text-[#22d3ee]"
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Top-right Map Scale & Layer Badge */}
      <div className="glass pointer-events-none absolute top-3.5 right-3.5 z-10 hidden items-center gap-2.5 rounded-xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm sm:flex">
        <span className="inline-flex items-center gap-1 text-foreground">
          <Navigation className="h-3 w-3 text-[#22d3ee]" />
          Dhaka Metro Grid
        </span>
        <span className="text-border">|</span>
        <span className="font-mono text-[10px] uppercase text-[#22d3ee]">
          {mapStyle}
        </span>
        <span className="text-border">|</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px]">
          <span className="inline-block h-1.5 w-7 border-x border-b border-[#22d3ee]" />
          {scaleLabelMeters} m
        </span>
      </div>
    </div>
  );
}

export function getActiveWaypointTelemetry(latestPoint: LatLng | null) {
  if (!latestPoint) {
    return {
      currentWaypoint: ROUTE_WAYPOINTS[0],
      nextWaypoint: ROUTE_WAYPOINTS[1] ?? ROUTE_WAYPOINTS[0],
      nextWaypointIndex: 1,
      distanceToNextKm: haversineKm(
        ROUTE_WAYPOINTS[0],
        ROUTE_WAYPOINTS[1] ?? ROUTE_WAYPOINTS[0]
      ),
    };
  }

  let closestIdx = 0;
  let closestDist = Infinity;

  for (let i = 0; i < ROUTE_WAYPOINTS.length; i++) {
    const d = haversineKm(latestPoint, ROUTE_WAYPOINTS[i]);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }

  const nextIdx = Math.min(ROUTE_WAYPOINTS.length - 1, closestIdx + 1);
  const nextWaypoint = ROUTE_WAYPOINTS[nextIdx];
  const distanceToNextKm = haversineKm(latestPoint, nextWaypoint);

  return {
    currentWaypoint: ROUTE_WAYPOINTS[closestIdx],
    nextWaypoint,
    nextWaypointIndex: nextIdx,
    distanceToNextKm,
  };
}
