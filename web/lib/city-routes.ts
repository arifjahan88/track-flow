import type { CityRoute, VectorGeofence } from "@/types";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const GEO_BOUNDS = {
  minLat: 37.715,
  maxLat: 37.825,
  minLng: -122.495,
  maxLng: -122.345,
} as const;

export function rawSvgToLatLng(
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

export const CITY_ROUTES: CityRoute[] = [
  {
    id: "route-1",
    name: "Downtown Express Loop",
    code: "RT-101",
    color: "#06B6D4",
    distanceKm: 18.4,
    estimatedMinutes: 24,
    description:
      "Central Logistics Hub via Civic Arterial to Harbor Front and back.",
    waypoints: [
      { x: 240, y: 310 },
      { x: 350, y: 270 },
      { x: 470, y: 240 },
      { x: 590, y: 270 },
      { x: 700, y: 340 },
      { x: 775, y: 425 },
      { x: 660, y: 470 },
      { x: 510, y: 445 },
      { x: 370, y: 410 },
      { x: 265, y: 360 },
      { x: 240, y: 310 },
    ],
  },
  {
    id: "route-2",
    name: "North Industrial Corridor",
    code: "RT-204",
    color: "#10B981",
    distanceKm: 24.6,
    estimatedMinutes: 31,
    description:
      "High-capacity freight artery connecting Central Hub and North Industrial Park.",
    waypoints: [
      { x: 215, y: 315 },
      { x: 275, y: 215 },
      { x: 370, y: 155 },
      { x: 495, y: 120 },
      { x: 635, y: 130 },
      { x: 750, y: 175 },
      { x: 705, y: 245 },
      { x: 560, y: 225 },
      { x: 425, y: 210 },
      { x: 310, y: 255 },
      { x: 215, y: 315 },
    ],
  },
  {
    id: "route-3",
    name: "Airport Cargo Express",
    code: "RT-309",
    color: "#8B5CF6",
    distanceKm: 32.1,
    estimatedMinutes: 36,
    description:
      "Direct air-freight expressway linking Airport Cargo Zone and Harbor Port Terminal.",
    waypoints: [
      { x: 790, y: 465 },
      { x: 845, y: 365 },
      { x: 855, y: 250 },
      { x: 760, y: 175 },
      { x: 620, y: 185 },
      { x: 490, y: 275 },
      { x: 425, y: 390 },
      { x: 485, y: 500 },
      { x: 620, y: 530 },
      { x: 740, y: 505 },
      { x: 790, y: 465 },
    ],
  },
  {
    id: "route-4",
    name: "Harbor Freight Perimeter",
    code: "RT-412",
    color: "#F59E0B",
    distanceKm: 28.9,
    estimatedMinutes: 34,
    description:
      "Outer logistics belt serving Port Terminal, Westside Warehouses, and Central Hub.",
    waypoints: [
      { x: 145, y: 445 },
      { x: 140, y: 315 },
      { x: 195, y: 205 },
      { x: 335, y: 145 },
      { x: 475, y: 175 },
      { x: 585, y: 315 },
      { x: 755, y: 440 },
      { x: 675, y: 545 },
      { x: 455, y: 550 },
      { x: 260, y: 510 },
      { x: 145, y: 445 },
    ],
  },
];

export function getRouteById(routeId?: string): CityRoute {
  return CITY_ROUTES.find((r) => r.id === routeId) ?? CITY_ROUTES[0];
}

const g1 = rawSvgToLatLng(245, 315);
const g2 = rawSvgToLatLng(630, 145);
const g3 = rawSvgToLatLng(530, 505);
const g4 = rawSvgToLatLng(785, 435);

export const INITIAL_VECTOR_GEOFENCES: VectorGeofence[] = [
  {
    id: "vgeo-1",
    name: "Central Logistics Hub",
    x: 245,
    y: 315,
    radius: 64,
    latitude: g1.latitude,
    longitude: g1.longitude,
    radiusMeters: 850,
    color: "#06B6D4",
    active: true,
  },
  {
    id: "vgeo-2",
    name: "North Industrial Park",
    x: 630,
    y: 145,
    radius: 68,
    latitude: g2.latitude,
    longitude: g2.longitude,
    radiusMeters: 920,
    color: "#10B981",
    active: true,
  },
  {
    id: "vgeo-3",
    name: "Airport Cargo Zone",
    x: 530,
    y: 505,
    radius: 62,
    latitude: g3.latitude,
    longitude: g3.longitude,
    radiusMeters: 800,
    color: "#F59E0B",
    active: true,
  },
  {
    id: "vgeo-4",
    name: "Harbor Port Terminal",
    x: 785,
    y: 435,
    radius: 66,
    latitude: g4.latitude,
    longitude: g4.longitude,
    radiusMeters: 900,
    color: "#8B5CF6",
    active: true,
  },
];

export const CITY_HIGHWAYS: string[] = [
  "M 40 315 L 960 315",
  "M 120 140 L 890 140",
  "M 90 485 L 920 485",
  "M 245 40 L 245 585",
  "M 520 30 L 520 595",
  "M 785 45 L 785 575",
  "M 80 560 Q 340 420 520 260 T 940 90",
  "M 110 85 Q 410 220 630 355 T 930 555",
];

export const CITY_BLOCKS: Array<{
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}> = [
  { x: 110, y: 175, w: 95, h: 95, rx: 10 },
  { x: 280, y: 175, w: 110, h: 90, rx: 10 },
  { x: 420, y: 175, w: 72, h: 92, rx: 10 },
  { x: 555, y: 175, w: 120, h: 95, rx: 10 },
  { x: 705, y: 175, w: 58, h: 95, rx: 10 },
  { x: 815, y: 175, w: 92, h: 102, rx: 10 },
  { x: 110, y: 345, w: 95, h: 105, rx: 10 },
  { x: 285, y: 345, w: 125, h: 95, rx: 10 },
  { x: 440, y: 345, w: 58, h: 100, rx: 10 },
  { x: 555, y: 345, w: 115, h: 95, rx: 10 },
  { x: 695, y: 345, w: 62, h: 98, rx: 10 },
  { x: 285, y: 55, w: 195, h: 55, rx: 10 },
  { x: 555, y: 55, w: 185, h: 55, rx: 10 },
  { x: 285, y: 515, w: 185, h: 58, rx: 10 },
  { x: 580, y: 515, w: 155, h: 58, rx: 10 },
];

export const MAP_LANDMARKS: Array<{ label: string; x: number; y: number }> = [
  { label: "BAYFRONT WATERWAY", x: 895, y: 405 },
  { label: "METRO INTERCHANGE I-80", x: 520, y: 306 },
  { label: "WESTSIDE FREIGHT YARD", x: 148, y: 455 },
  { label: "CIVIC CORRIDOR", x: 392, y: 235 },
];
