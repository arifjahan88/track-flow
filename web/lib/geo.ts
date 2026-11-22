import type { LatLng } from "@/types";

const EARTH_RADIUS_KM = 6371;
const MIN_POINT_DISTANCE_KM = 0.003; // 3 meters

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return EARTH_RADIUS_KM * c;
}

export function isUsefulPoint(
  last: LatLng | undefined,
  next: LatLng
): boolean {
  if (!last) return true;
  return haversineKm(last, next) >= MIN_POINT_DISTANCE_KM;
}

export interface RouteWaypoint extends LatLng {
  id: string;
  name: string;
  corridor: string;
  district: string;
  maneuver: "depart" | "right" | "left" | "straight" | "merge" | "arrive";
  instruction: string;
  speedLimitKmh: number;
}

export const ROUTE_WAYPOINTS: readonly RouteWaypoint[] = [
  {
    id: "wp-gulshan-2",
    lat: 23.7925,
    lng: 90.4078,
    name: "Gulshan-2 Circle",
    corridor: "Gulshan Avenue North",
    district: "Gulshan",
    maneuver: "depart",
    instruction: "Head east toward Pragati Sarani Link",
    speedLimitKmh: 50,
  },
  {
    id: "wp-badda-link",
    lat: 23.796,
    lng: 90.415,
    name: "Baridhara-Badda Link",
    corridor: "Bir Uttam Rafiqul Islam Ave",
    district: "Badda",
    maneuver: "right",
    instruction: "Turn right onto Pragati Sarani South",
    speedLimitKmh: 60,
  },
  {
    id: "wp-rampura-bridge",
    lat: 23.789,
    lng: 90.423,
    name: "Merul Badda Junction",
    corridor: "Pragati Sarani Express",
    district: "Merul Badda",
    maneuver: "straight",
    instruction: "Continue south toward Hatirjheel East Gate",
    speedLimitKmh: 60,
  },
  {
    id: "wp-hatirjheel-east",
    lat: 23.78,
    lng: 90.425,
    name: "Hatirjheel East Viaduct",
    corridor: "Hatirjheel Lakefront Expy",
    district: "Rampura",
    maneuver: "right",
    instruction: "Merge onto Hatirjheel Waterfront Viaduct",
    speedLimitKmh: 50,
  },
  {
    id: "wp-hatirjheel-mid",
    lat: 23.772,
    lng: 90.418,
    name: "Hatirjheel Amphitheater Bridge",
    corridor: "Hatirjheel South Causeway",
    district: "Tejgaon",
    maneuver: "merge",
    instruction: "Keep left across Hatirjheel Causeway",
    speedLimitKmh: 50,
  },
  {
    id: "wp-tejgaon-link",
    lat: 23.766,
    lng: 90.412,
    name: "Tejgaon-Moghbazar Hub",
    corridor: "Shaheed Tajuddin Ahmed Ave",
    district: "Tejgaon Industrial",
    maneuver: "left",
    instruction: "Bear left toward South Distribution Terminal",
    speedLimitKmh: 45,
  },
  {
    id: "wp-moghbazar-terminal",
    lat: 23.76,
    lng: 90.416,
    name: "Moghbazar Logistics Hub",
    corridor: "Outer Circular Road",
    district: "Moghbazar",
    maneuver: "arrive",
    instruction: "Arrive at Moghbazar Logistics Hub",
    speedLimitKmh: 40,
  },
];

const POINTS_PER_SEGMENT = 60;

function buildSimRoute(waypoints: readonly LatLng[]): LatLng[] {
  const result: LatLng[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    for (let step = 0; step < POINTS_PER_SEGMENT; step++) {
      const ratio = step / POINTS_PER_SEGMENT;
      result.push({
        lat: Number((start.lat + (end.lat - start.lat) * ratio).toFixed(6)),
        lng: Number((start.lng + (end.lng - start.lng) * ratio).toFixed(6)),
      });
    }
  }
  const finalPoint = waypoints[waypoints.length - 1];
  if (finalPoint) {
    result.push({ ...finalPoint });
  }
  return result;
}

export const SIM_ROUTE: readonly LatLng[] = buildSimRoute(ROUTE_WAYPOINTS);

export function computeBearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function formatCardinalDirection(degrees: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const normalized = ((degrees % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}

export const PLANNED_ROUTE_TOTAL_KM: number = ROUTE_WAYPOINTS.reduce(
  (sum, wp, idx) =>
    idx === 0 ? 0 : sum + haversineKm(ROUTE_WAYPOINTS[idx - 1], wp),
  0
);
