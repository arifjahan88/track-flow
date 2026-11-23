import type {
  CityRegionId,
  CityRoute,
  MapCoordinate,
  TrackPoint,
  TurnInstruction,
  VectorGeofence,
  VectorPoint,
} from "@/types";
import {
  GEO_BOUNDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  getRouteCoordsForRegion,
} from "@/lib/city-routes";
import { computeBearingDegrees, haversineKm } from "@/lib/geo";

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

export interface InterpolatedRouteState {
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  headingDeg: number;
  coveredPoints: VectorPoint[];
  remainingPoints: VectorPoint[];
  coveredCoords: MapCoordinate[];
  remainingCoords: MapCoordinate[];
  turnInstruction: TurnInstruction;
}

export function computeTurnInstruction(
  route: CityRoute,
  progress: number
): TurnInstruction {
  const prompts = route.prompts;
  if (!prompts || prompts.length === 0) {
    return {
      maneuver: "straight",
      instruction: `Continue along ${route.name}`,
      streetName: route.name,
      district: route.code,
      distanceMeters: 450,
      speedLimitKmh: 60,
    };
  }

  let activeIdx = 0;
  for (let i = 0; i < prompts.length; i++) {
    if (progress >= prompts[i].progress) {
      activeIdx = i;
    }
  }
  const nextIdx = (activeIdx + 1) % prompts.length;
  const nextPrompt = prompts[nextIdx];
  const nextProgress =
    nextPrompt.progress > progress
      ? nextPrompt.progress
      : nextPrompt.progress + 1;
  const remainingFraction = Math.max(0.01, nextProgress - progress);
  const distanceMeters = Math.max(
    40,
    Math.round(remainingFraction * route.distanceKm * 180)
  );

  return {
    maneuver: nextPrompt.maneuver,
    instruction: nextPrompt.instruction,
    streetName: nextPrompt.streetName,
    district: nextPrompt.district,
    distanceMeters,
    speedLimitKmh: nextPrompt.speedLimitKmh,
  };
}

export function interpolateRoutePosition(
  waypoints: VectorPoint[],
  rawProgress: number,
  route?: CityRoute,
  region: CityRegionId = "dhaka"
): InterpolatedRouteState {
  const progress = ((rawProgress % 1) + 1) % 1;

  // 1. Interpolate SVG vector points
  let x = MAP_WIDTH / 2;
  let y = MAP_HEIGHT / 2;
  let coveredPoints: VectorPoint[] = [];
  let remainingPoints: VectorPoint[] = [];

  if (waypoints.length >= 2) {
    const segLengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const len = Math.hypot(
        waypoints[i + 1].x - waypoints[i].x,
        waypoints[i + 1].y - waypoints[i].y
      );
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
    const localT = Math.max(
      0,
      Math.min(1, (targetDist - accumulated) / segLen)
    );
    const p0 = waypoints[segIndex];
    const p1 = waypoints[segIndex + 1];
    x = p0.x + (p1.x - p0.x) * localT;
    y = p0.y + (p1.y - p0.y) * localT;
    const currentPt = { x, y };
    coveredPoints = [...waypoints.slice(0, segIndex + 1), currentPt];
    remainingPoints = [currentPt, ...waypoints.slice(segIndex + 1)];
  }

  // 2. Interpolate Real Street GPS Coordinates for the active city region
  const geoCoords = route ? getRouteCoordsForRegion(route, region) : [];
  let latitude = 23.7815;
  let longitude = 90.4125;
  let headingDeg = 0;
  let coveredCoords: MapCoordinate[] = [];
  let remainingCoords: MapCoordinate[] = [];

  if (geoCoords.length >= 2) {
    const segKm: number[] = [];
    let totalKm = 0;
    for (let i = 0; i < geoCoords.length - 1; i++) {
      const d = haversineKm(
        { lat: geoCoords[i].latitude, lng: geoCoords[i].longitude },
        { lat: geoCoords[i + 1].latitude, lng: geoCoords[i + 1].longitude }
      );
      segKm.push(d);
      totalKm += d;
    }

    const targetKm = progress * totalKm;
    let accKm = 0;
    let gIndex = 0;
    for (let i = 0; i < segKm.length; i++) {
      if (accKm + segKm[i] >= targetKm || i === segKm.length - 1) {
        gIndex = i;
        break;
      }
      accKm += segKm[i];
    }

    const sLen = segKm[gIndex] || 0.001;
    const t = Math.max(0, Math.min(1, (targetKm - accKm) / sLen));
    const c0 = geoCoords[gIndex];
    const c1 = geoCoords[gIndex + 1];

    latitude = Number((c0.latitude + (c1.latitude - c0.latitude) * t).toFixed(6));
    longitude = Number(
      (c0.longitude + (c1.longitude - c0.longitude) * t).toFixed(6)
    );
    headingDeg = Number(
      computeBearingDegrees(
        { lat: c0.latitude, lng: c0.longitude },
        { lat: c1.latitude, lng: c1.longitude }
      ).toFixed(1)
    );

    const currCoord: MapCoordinate = { latitude, longitude };
    coveredCoords = [...geoCoords.slice(0, gIndex + 1), currCoord];
    remainingCoords = [currCoord, ...geoCoords.slice(gIndex + 1)];
  } else {
    const fallback = svgToLatLng(x, y);
    latitude = fallback.latitude;
    longitude = fallback.longitude;
  }

  const turnInstruction: TurnInstruction = route
    ? computeTurnInstruction(route, progress)
    : {
        maneuver: "straight",
        instruction: "Continue on corridor",
        streetName: "Expressway",
        district: "Metro",
        distanceMeters: 400,
        speedLimitKmh: 60,
      };

  return {
    x,
    y,
    latitude,
    longitude,
    headingDeg,
    coveredPoints,
    remainingPoints,
    coveredCoords,
    remainingCoords,
    turnInstruction,
  };
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
  route: CityRoute,
  endProgress: number,
  sampleCount: number,
  startTimestamp: number,
  region: CityRegionId = "dhaka"
): TrackPoint[] {
  const points: TrackPoint[] = [];
  const steps = Math.max(2, sampleCount);
  const span = Math.max(0.05, Math.min(1, endProgress));

  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * span;
    const pos = interpolateRoutePosition(route.waypoints, t, route, region);
    points.push({
      lat: pos.latitude,
      lng: pos.longitude,
      t: startTimestamp + i * 90_000,
    });
  }

  return points;
}
