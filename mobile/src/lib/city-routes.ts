import type {
  CityRegionId,
  CityRoute,
  MapCoordinate,
  VectorGeofence,
} from "@/types";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const GEO_BOUNDS = {
  minLat: 37.715,
  maxLat: 37.825,
  minLng: -122.495,
  maxLng: -122.345,
} as const;

export const REGION_CENTERS: Record<
  CityRegionId,
  {
    label: string;
    shortLabel: string;
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }
> = {
  dhaka: {
    label: "Dhaka Metro (Gulshan · Hatirjheel · Tejgaon)",
    shortLabel: "Dhaka",
    latitude: 23.7815,
    longitude: 90.4125,
    latitudeDelta: 0.055,
    longitudeDelta: 0.055,
  },
  sf_bay: {
    label: "San Francisco Bay Logistics Hub",
    shortLabel: "SF Bay",
    latitude: 37.772,
    longitude: -122.418,
    latitudeDelta: 0.085,
    longitudeDelta: 0.085,
  },
};

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
    name: "Gulshan – Hatirjheel Express Loop",
    code: "RT-101",
    color: "#2563EB",
    distanceKm: 18.4,
    estimatedMinutes: 24,
    description:
      "Gulshan-2 Hub via Pragati Sarani and Hatirjheel Waterfront Viaduct to Tejgaon-Moghbazar Hub.",
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
    dhakaCoords: [
      { latitude: 23.7946, longitude: 90.4143 }, // Gulshan-2 Circle
      { latitude: 23.7978, longitude: 90.4225 }, // Baridhara Link Road
      { latitude: 23.7885, longitude: 90.4257 }, // Merul Badda Pragati Sarani
      { latitude: 23.7798, longitude: 90.4241 }, // Hatirjheel Rampura Bridge
      { latitude: 23.7731, longitude: 90.4168 }, // Hatirjheel Lake Viaduct
      { latitude: 23.7654, longitude: 90.4089 }, // Tejgaon Love Road Junction
      { latitude: 23.7618, longitude: 90.4012 }, // Nabisco Tajuddin Ave
      { latitude: 23.7715, longitude: 90.4021 }, // Niketon West Link
      { latitude: 23.7809, longitude: 90.4068 }, // Gulshan-1 Circle
      { latitude: 23.7884, longitude: 90.4109 }, // Gulshan Avenue Mid
      { latitude: 23.7946, longitude: 90.4143 }, // Back to Gulshan-2 Circle
    ],
    sfCoords: [
      { latitude: 37.7895, longitude: -122.4015 },
      { latitude: 37.7955, longitude: -122.3935 },
      { latitude: 37.7882, longitude: -122.3881 },
      { latitude: 37.7764, longitude: -122.3894 },
      { latitude: 37.7685, longitude: -122.3968 },
      { latitude: 37.7641, longitude: -122.4088 },
      { latitude: 37.7695, longitude: -122.4192 },
      { latitude: 37.7779, longitude: -122.4184 },
      { latitude: 37.7848, longitude: -122.4112 },
      { latitude: 37.7895, longitude: -122.4015 },
    ],
    prompts: [
      {
        progress: 0.0,
        maneuver: "depart",
        instruction: "Head east toward Pragati Sarani Link",
        streetName: "Gulshan Avenue North",
        district: "Gulshan-2",
        speedLimitKmh: 50,
      },
      {
        progress: 0.2,
        maneuver: "right",
        instruction: "Turn right onto Pragati Sarani Express",
        streetName: "Bir Uttam Rafiqul Islam Ave",
        district: "Badda",
        speedLimitKmh: 60,
      },
      {
        progress: 0.42,
        maneuver: "merge",
        instruction: "Merge onto Hatirjheel Lakefront Viaduct",
        streetName: "Hatirjheel Expressway",
        district: "Hatirjheel",
        speedLimitKmh: 55,
      },
      {
        progress: 0.66,
        maneuver: "right",
        instruction: "Turn right onto Shaheed Tajuddin Ahmed Ave",
        streetName: "Tejgaon Industrial Corridor",
        district: "Tejgaon",
        speedLimitKmh: 50,
      },
      {
        progress: 0.85,
        maneuver: "straight",
        instruction: "Continue north via Gulshan-1 Circle",
        streetName: "Gulshan Avenue",
        district: "Gulshan-1",
        speedLimitKmh: 50,
      },
    ],
  },
  {
    id: "route-2",
    name: "Banani – Tejgaon Industrial Corridor",
    code: "RT-204",
    color: "#2563EB",
    distanceKm: 24.6,
    estimatedMinutes: 31,
    description:
      "High-capacity freight artery connecting Banani Commercial Hub, Mohakhali Flyover, and Tejgaon Industrial Park.",
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
    dhakaCoords: [
      { latitude: 23.7938, longitude: 90.4042 }, // Banani Rd 11
      { latitude: 23.7852, longitude: 90.4001 }, // Mohakhali Flyover North
      { latitude: 23.7776, longitude: 90.3982 }, // Mohakhali Bus Terminal
      { latitude: 23.7689, longitude: 90.3998 }, // Tejgaon Satrasta Circle
      { latitude: 23.7582, longitude: 90.3924 }, // Karwan Bazar Panthapath
      { latitude: 23.7564, longitude: 90.4041 }, // Moghbazar Flyover
      { latitude: 23.7678, longitude: 90.4126 }, // Hatirjheel West Hub
      { latitude: 23.7785, longitude: 90.4122 }, // Niketon Gate 2
      { latitude: 23.7889, longitude: 90.4076 }, // Kemal Ataturk Ave
      { latitude: 23.7938, longitude: 90.4042 }, // Back to Banani
    ],
    sfCoords: [
      { latitude: 37.8012, longitude: -122.4254 },
      { latitude: 37.7918, longitude: -122.4321 },
      { latitude: 37.7795, longitude: -122.4352 },
      { latitude: 37.7682, longitude: -122.4295 },
      { latitude: 37.7654, longitude: -122.4152 },
      { latitude: 37.7751, longitude: -122.4085 },
      { latitude: 37.7884, longitude: -122.4128 },
      { latitude: 37.8012, longitude: -122.4254 },
    ],
    prompts: [
      {
        progress: 0.0,
        maneuver: "depart",
        instruction: "Depart Banani Hub onto Dhaka-Mymensingh Hwy",
        streetName: "New Airport Road",
        district: "Banani",
        speedLimitKmh: 60,
      },
      {
        progress: 0.25,
        maneuver: "straight",
        instruction: "Take Mohakhali Flyover ramp toward Tejgaon",
        streetName: "Shaheed Tajuddin Ave",
        district: "Mohakhali",
        speedLimitKmh: 65,
      },
      {
        progress: 0.52,
        maneuver: "left",
        instruction: "Turn left at Satrasta toward Moghbazar",
        streetName: "Outer Circular Road",
        district: "Tejgaon",
        speedLimitKmh: 45,
      },
      {
        progress: 0.78,
        maneuver: "left",
        instruction: "Continue north via Niketon Link Bridge",
        streetName: "Kemal Ataturk Avenue",
        district: "Gulshan-Banani",
        speedLimitKmh: 50,
      },
    ],
  },
  {
    id: "route-3",
    name: "Airport Cargo & Kuril Expressway",
    code: "RT-309",
    color: "#2563EB",
    distanceKm: 32.1,
    estimatedMinutes: 36,
    description:
      "Direct air-freight expressway linking Airport Cargo Terminal, Kuril Flyover, and Central Logistics Hub.",
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
    dhakaCoords: [
      { latitude: 23.8195, longitude: 90.4182 }, // Kuril Flyover Interchange
      { latitude: 23.8124, longitude: 90.4245 }, // Bashundhara Gate Pragati Sarani
      { latitude: 23.8018, longitude: 90.4258 }, // Natun Bazar Embassy Corridor
      { latitude: 23.7945, longitude: 90.4152 }, // Gulshan-2 Crossing
      { latitude: 23.7972, longitude: 90.4038 }, // Banani Overpass
      { latitude: 23.8088, longitude: 90.4072 }, // Chairman Bari Airport Hwy
      { latitude: 23.8165, longitude: 90.4124 }, // Kurmitola Cantonment Link
      { latitude: 23.8195, longitude: 90.4182 }, // Back to Kuril Flyover
    ],
    sfCoords: [
      { latitude: 37.7582, longitude: -122.3875 },
      { latitude: 37.7445, longitude: -122.3928 },
      { latitude: 37.7358, longitude: -122.4045 },
      { latitude: 37.7422, longitude: -122.4198 },
      { latitude: 37.7568, longitude: -122.4215 },
      { latitude: 37.7689, longitude: -122.4085 },
      { latitude: 37.7582, longitude: -122.3875 },
    ],
    prompts: [
      {
        progress: 0.0,
        maneuver: "depart",
        instruction: "Exit Kuril Flyover south onto Pragati Sarani",
        streetName: "Kuril Elevated Expressway",
        district: "Kuril",
        speedLimitKmh: 70,
      },
      {
        progress: 0.3,
        maneuver: "right",
        instruction: "Turn right at Natun Bazar toward Gulshan-2",
        streetName: "Madani Avenue",
        district: "Baridhara",
        speedLimitKmh: 55,
      },
      {
        progress: 0.62,
        maneuver: "right",
        instruction: "Merge north onto Airport Highway",
        streetName: "Airport Road Express",
        district: "Kurmitola",
        speedLimitKmh: 75,
      },
    ],
  },
  {
    id: "route-4",
    name: "Motijheel & South Logistics Perimeter",
    code: "RT-412",
    color: "#2563EB",
    distanceKm: 28.9,
    estimatedMinutes: 34,
    description:
      "Commercial perimeter loop serving Motijheel Commercial Hub, Paltan, Moghbazar, and Rampura.",
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
    dhakaCoords: [
      { latitude: 23.7512, longitude: 90.4078 }, // Moghbazar Crossing
      { latitude: 23.7418, longitude: 90.4142 }, // Malibagh Railgate
      { latitude: 23.7322, longitude: 90.4178 }, // Motijheel Commercial Hub
      { latitude: 23.7348, longitude: 90.4065 }, // Paltan VIP Road
      { latitude: 23.7435, longitude: 90.3988 }, // Shahbagh – Bangla Motor
      { latitude: 23.7589, longitude: 90.4195 }, // Rampura DIT Road
      { latitude: 23.7512, longitude: 90.4078 }, // Back to Moghbazar
    ],
    sfCoords: [
      { latitude: 37.7815, longitude: -122.4562 },
      { latitude: 37.7688, longitude: -122.4512 },
      { latitude: 37.7592, longitude: -122.4368 },
      { latitude: 37.7645, longitude: -122.4182 },
      { latitude: 37.7785, longitude: -122.4265 },
      { latitude: 37.7815, longitude: -122.4562 },
    ],
    prompts: [
      {
        progress: 0.0,
        maneuver: "depart",
        instruction: "Head south from Moghbazar toward Malibagh",
        streetName: "DIT Commercial Road",
        district: "Malibagh",
        speedLimitKmh: 50,
      },
      {
        progress: 0.35,
        maneuver: "right",
        instruction: "Enter Motijheel Commercial Freight Zone",
        streetName: "Toyenbee Circular Road",
        district: "Motijheel",
        speedLimitKmh: 45,
      },
      {
        progress: 0.7,
        maneuver: "right",
        instruction: "Continue north via VIP Road & Bangla Motor",
        streetName: "Kazi Nazrul Islam Ave",
        district: "Ramna",
        speedLimitKmh: 55,
      },
    ],
  },
];

export function getRouteById(routeId?: string): CityRoute {
  return CITY_ROUTES.find((r) => r.id === routeId) ?? CITY_ROUTES[0];
}

export function getRouteCoordsForRegion(
  route: CityRoute,
  region: CityRegionId
): MapCoordinate[] {
  return region === "dhaka" ? route.dhakaCoords : route.sfCoords;
}

const g1 = rawSvgToLatLng(245, 315);
const g2 = rawSvgToLatLng(630, 145);
const g3 = rawSvgToLatLng(530, 505);
const g4 = rawSvgToLatLng(785, 435);

export const INITIAL_VECTOR_GEOFENCES: VectorGeofence[] = [
  {
    id: "vgeo-1",
    name: "Central Logistics Hub (Gulshan-2)",
    x: 245,
    y: 315,
    radius: 64,
    latitude: g1.latitude,
    longitude: g1.longitude,
    dhakaLatitude: 23.7946,
    dhakaLongitude: 90.4143,
    radiusMeters: 650,
    color: "#2563EB",
    active: true,
  },
  {
    id: "vgeo-2",
    name: "Tejgaon Industrial Park",
    x: 630,
    y: 145,
    radius: 68,
    latitude: g2.latitude,
    longitude: g2.longitude,
    dhakaLatitude: 23.7654,
    dhakaLongitude: 90.4052,
    radiusMeters: 720,
    color: "#2563EB",
    active: true,
  },
  {
    id: "vgeo-3",
    name: "Airport & Kuril Cargo Zone",
    x: 530,
    y: 505,
    radius: 62,
    latitude: g3.latitude,
    longitude: g3.longitude,
    dhakaLatitude: 23.8165,
    dhakaLongitude: 90.4178,
    radiusMeters: 750,
    color: "#2563EB",
    active: true,
  },
  {
    id: "vgeo-4",
    name: "Hatirjheel East Freight Terminal",
    x: 785,
    y: 435,
    radius: 66,
    latitude: g4.latitude,
    longitude: g4.longitude,
    dhakaLatitude: 23.7785,
    dhakaLongitude: 90.4235,
    radiusMeters: 620,
    color: "#2563EB",
    active: true,
  },
];
