import type { TrackPoint, VectorGeofence, VectorPoint } from "@/types";
import { GEO_BOUNDS, MAP_HEIGHT, MAP_WIDTH } from "@/lib/city-routes";

export function svgToLatLng(
  x: number,
  y: number
): { latitude: number; longitude: number } {
  const longitude =
    GEO_BOUNDS.minLng +
    (x / MAP_WIDTH) * (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng);
  const latitude =
    GEO_BOUNDS.maxLat -
    (y / MAP_HEIGHT) * (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat);
  return {
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
  };
}

export function latLngToSvg(latitude: number, longitude: number): VectorPoint {
  const xRatio =
    (longitude - GEO_BOUNDS.minLng) / (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng);
  const yRatio =
    (GEO_BOUNDS.maxLat - latitude) / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat);
  return {
    x: Math.max(20, Math.min(MAP_WIDTH - 20, xRatio * MAP_WIDTH)),
    y: Math.max(20, Math.min(MAP_HEIGHT - 20, yRatio * MAP_HEIGHT)),
  };
}

export interface InterpolatedRouteState {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  headingDeg: number;
  coveredPoints: VectorPoint[];
  remainingPoints: VectorPoint[];
}

export function interpolateRoutePosition(
  waypoints: VectorPoint[],
  rawProgress: number
): InterpolatedRouteState {
  if (waypoints.length === 0) {
    const coords = svgToLatLng(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    return {
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
      latitude: coords.latitude,
      longitude: coords.longitude,
      headingDeg: 0,
      coveredPoints: [],
      remainingPoints: [],
    };
  }

  if (waypoints.length === 1) {
    const pt = waypoints[0];
    const coords = svgToLatLng(pt.x, pt.y);
    return {
      x: pt.x,
      y: pt.y,
      latitude: coords.latitude,
      longitude: coords.longitude,
      headingDeg: 0,
      coveredPoints: [pt],
      remainingPoints: [pt],
    };
  }

  const progress = ((rawProgress % 1) + 1) % 1;
  const segLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    totalLength += len;
  }

  const targetDist = progress * totalLength;
  let accumulated = 0;
  let segIndex = 0;

  for (let i = 0; i < segLengths.length; i++) {
    if (
      accumulated + segLengths[i] >= targetDist ||
      i === segLengths.length - 1
    ) {
      segIndex = i;
      break;
    }
    accumulated += segLengths[i];
  }

  const segLen = segLengths[segIndex] || 1;
  const localT = Math.max(0, Math.min(1, (targetDist - accumulated) / segLen));
  const p0 = waypoints[segIndex];
  const p1 = waypoints[segIndex + 1];

  const x = p0.x + (p1.x - p0.x) * localT;
  const y = p0.y + (p1.y - p0.y) * localT;

  // Navigation bearing: 0 deg = North (-Y), 90 deg = East (+X)
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const radians = Math.atan2(dx, -dy);
  const headingDeg = ((radians * 180) / Math.PI + 360) % 360;

  const currentPt: VectorPoint = { x, y };
  const coveredPoints: VectorPoint[] = [
    ...waypoints.slice(0, segIndex + 1),
    currentPt,
  ];
  const remainingPoints: VectorPoint[] = [
    currentPt,
    ...waypoints.slice(segIndex + 1),
  ];

  const coords = svgToLatLng(x, y);

  return {
    x,
    y,
    latitude: coords.latitude,
    longitude: coords.longitude,
    headingDeg: Number(headingDeg.toFixed(1)),
    coveredPoints,
    remainingPoints,
  };
}

export function pointsToSvgPath(points: VectorPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map(
      (pt, idx) =>
        `${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    )
    .join(" ");
}

export function headingToCardinal(deg: number | null | undefined): string {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return "N";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return directions[index];
}

export function lerpAngle(from: number, to: number, factor: number): number {
  const diff = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + diff * factor + 360) % 360;
}

export function isPointInsideVectorGeofence(
  x: number,
  y: number,
  geofence: VectorGeofence
): boolean {
  if (!geofence.active) return false;
  const dist = Math.hypot(x - geofence.x, y - geofence.y);
  return dist <= geofence.radius;
}

export function sampleRouteTrackPoints(
  waypoints: VectorPoint[],
  endProgress: number,
  sampleCount: number,
  startTimestamp: number
): TrackPoint[] {
  const points: TrackPoint[] = [];
  const steps = Math.max(2, sampleCount);
  const span = Math.max(0.05, Math.min(1, endProgress));

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * span;
    const pos = interpolateRoutePosition(waypoints, t);
    points.push({
      lat: pos.latitude,
      lng: pos.longitude,
      t: startTimestamp + i * 90_000,
    });
  }

  return points;
}
