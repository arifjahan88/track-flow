import type {
  CityRegionId,
  CityRoute,
  MapCoordinate,
  VectorGeofence,
  VectorPoint,
} from "@/types";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

export const GEO_BOUNDS = {
  minLat: 37.715,
  maxLat: 37.825,
  minLng: -122.495,
  maxLng: -122.345,
} as const;

const DHAKA_BOUNDS = {
  minLat: 23.726,
  maxLat: 23.828,
  minLng: 90.388,
  maxLng: 90.432,
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

/**
 * Applies gentle Chaikin corner-smoothing (0.18 / 0.82) on turns while
 * keeping the start/end endpoints locked so road polylines curve naturally
 * through intersections without cutting across buildings or waterways.
 */
export function smoothRoadCoordinates(
  coords: MapCoordinate[],
  passes = 1
): MapCoordinate[] {
  if (coords.length < 3 || passes <= 0) return coords;

  let current = coords;
  for (let p = 0; p < passes; p++) {
    const next: MapCoordinate[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      if (i > 0) {
        next.push({
          latitude: Number((a.latitude * 0.82 + b.latitude * 0.18).toFixed(6)),
          longitude: Number(
            (a.longitude * 0.82 + b.longitude * 0.18).toFixed(6)
          ),
        });
      }
      if (i < current.length - 2) {
        next.push({
          latitude: Number((a.latitude * 0.18 + b.latitude * 0.82).toFixed(6)),
          longitude: Number(
            (a.longitude * 0.18 + b.longitude * 0.82).toFixed(6)
          ),
        });
      }
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function dhakaCoordsToVectorPoints(coords: MapCoordinate[]): VectorPoint[] {
  return coords.map((pt) => {
    const nx =
      (pt.longitude - DHAKA_BOUNDS.minLng) /
      (DHAKA_BOUNDS.maxLng - DHAKA_BOUNDS.minLng);
    const ny =
      (DHAKA_BOUNDS.maxLat - pt.latitude) /
      (DHAKA_BOUNDS.maxLat - DHAKA_BOUNDS.minLat);
    return {
      x: Number((60 + Math.max(0, Math.min(1, nx)) * (MAP_WIDTH - 120)).toFixed(1)),
      y: Number((45 + Math.max(0, Math.min(1, ny)) * (MAP_HEIGHT - 90)).toFixed(1)),
    };
  });
}

// Route 1: Gulshan-2 -> Madani Ave -> Pragati Sarani -> Rampura Bridge ->
// Hatirjheel South Waterfront Expy -> Tejgaon Love Rd -> Nabisco -> Gulshan-1 -> Gulshan-2
const ROUTE_1_DHAKA = smoothRoadCoordinates([
  { latitude: 23.7947, longitude: 90.4139 }, // Gulshan-2 Circle
  { latitude: 23.7966, longitude: 90.4178 }, // Gulshan Ave / Madani Ave West
  { latitude: 23.7976, longitude: 90.4222 }, // Baridhara Embassy Gate
  { latitude: 23.7981, longitude: 90.4252 }, // Natun Bazar / Pragati Sarani
  { latitude: 23.7934, longitude: 90.4256 }, // Shahjadpur Pragati Sarani
  { latitude: 23.7885, longitude: 90.4257 }, // Uttar Badda Pragati Sarani
  { latitude: 23.7832, longitude: 90.4254 }, // Merul Badda Link
  { latitude: 23.7782, longitude: 90.4249 }, // Rampura Bridge North
  { latitude: 23.7751, longitude: 90.4243 }, // Rampura Hatirjheel Ramp
  { latitude: 23.7728, longitude: 90.4216 }, // Hatirjheel East Loop
  { latitude: 23.7711, longitude: 90.4182 }, // Hatirjheel Amphitheater Curve
  { latitude: 23.7695, longitude: 90.4146 }, // Hatirjheel South Waterfront Expy
  { latitude: 23.7676, longitude: 90.4106 }, // Mahanagar Project Overpass
  { latitude: 23.7646, longitude: 90.4071 }, // Hatirjheel West Gate (FDC)
  { latitude: 23.7621, longitude: 90.4021 }, // Karwan Bazar / Love Rd Turn
  { latitude: 23.7647, longitude: 90.3999 }, // Shaheed Tajuddin Ahmed Ave
  { latitude: 23.7695, longitude: 90.3996 }, // Satrasta / Tejgaon Industrial
  { latitude: 23.7736, longitude: 90.4005 }, // Nabisco / TB Gate
  { latitude: 23.7754, longitude: 90.4048 }, // Tejgaon-Gulshan Link Rd
  { latitude: 23.7798, longitude: 90.4075 }, // Gulshan-1 Circle South
  { latitude: 23.7815, longitude: 90.4081 }, // Gulshan-1 Circle North
  { latitude: 23.7859, longitude: 90.4102 }, // Gulshan Ave Mid
  { latitude: 23.7905, longitude: 90.4123 }, // Gulshan Wonderland
  { latitude: 23.7947, longitude: 90.4139 }, // Back to Gulshan-2 Circle
]);

const ROUTE_1_SF = smoothRoadCoordinates([
  { latitude: 37.7897, longitude: -122.4014 }, // Market & Montgomery
  { latitude: 37.7932, longitude: -122.3968 }, // Market & Battery
  { latitude: 37.7955, longitude: -122.3936 }, // Embarcadero Ferry Bldg
  { latitude: 37.7911, longitude: -122.3897 }, // Embarcadero & Howard
  { latitude: 37.7858, longitude: -122.3881 }, // Embarcadero & Bryant
  { latitude: 37.7798, longitude: -122.3886 }, // King St & 2nd
  { latitude: 37.7764, longitude: -122.3944 }, // King St & 4th (Caltrain)
  { latitude: 37.7729, longitude: -122.3988 }, // 4th St & Townsend
  { latitude: 37.7686, longitude: -122.4021 }, // Townsend & 7th
  { latitude: 37.7654, longitude: -122.4066 }, // 16th St & Potrero
  { latitude: 37.7652, longitude: -122.4136 }, // 16th St & South Van Ness
  { latitude: 37.7688, longitude: -122.4193 }, // South Van Ness & 14th
  { latitude: 37.7749, longitude: -122.4194 }, // Van Ness & Market
  { latitude: 37.7785, longitude: -122.4152 }, // Market & 9th
  { latitude: 37.7824, longitude: -122.4103 }, // Market & 6th
  { latitude: 37.7862, longitude: -122.4057 }, // Market & 4th
  { latitude: 37.7897, longitude: -122.4014 }, // Back to Market & Montgomery
]);

// Route 2: Banani Rd 11 -> Kemal Ataturk -> New Airport Rd -> Mohakhali Flyover ->
// Tejgaon Satrasta -> Karwan Bazar -> Bangla Motor -> Moghbazar -> Hatirjheel West -> Niketon -> Banani
const ROUTE_2_DHAKA = smoothRoadCoordinates([
  { latitude: 23.7937, longitude: 90.4052 }, // Banani Rd 11 / Kemal Ataturk
  { latitude: 23.7941, longitude: 90.4013 }, // Banani / New Airport Rd
  { latitude: 23.7888, longitude: 90.4004 }, // Kakoli Junction
  { latitude: 23.7834, longitude: 90.3988 }, // Mohakhali Flyover North Ramp
  { latitude: 23.7783, longitude: 90.3981 }, // Mohakhali Bus Terminal
  { latitude: 23.7736, longitude: 90.3991 }, // Tejgaon Love Rd Entrance
  { latitude: 23.7695, longitude: 90.3996 }, // Tejgaon Satrasta Circle
  { latitude: 23.7646, longitude: 90.3999 }, // Begunbari Tajuddin Ave
  { latitude: 23.7595, longitude: 90.3976 }, // Karwan Bazar / Sonargaon
  { latitude: 23.7556, longitude: 90.3951 }, // Panthapath / Kazi Nazrul Ave
  { latitude: 23.7512, longitude: 90.3972 }, // Bangla Motor Crossing
  { latitude: 23.7501, longitude: 90.4026 }, // Eskaton / Moghbazar Link
  { latitude: 23.7536, longitude: 90.4061 }, // Moghbazar Flyover
  { latitude: 23.7604, longitude: 90.4079 }, // Hatirjheel South-West Entry
  { latitude: 23.7678, longitude: 90.4114 }, // Hatirjheel Police Plaza Bridge
  { latitude: 23.7748, longitude: 90.4109 }, // Niketon Gate 2
  { latitude: 23.7798, longitude: 90.4075 }, // Gulshan-1 Circle
  { latitude: 23.7852, longitude: 90.4084 }, // Gulshan Ave / Rd 45
  { latitude: 23.7903, longitude: 90.4083 }, // Kemal Ataturk Bridge
  { latitude: 23.7937, longitude: 90.4052 }, // Back to Banani
]);

const ROUTE_2_SF = smoothRoadCoordinates([
  { latitude: 37.8012, longitude: -122.4254 }, // Lombard & Van Ness
  { latitude: 37.8001, longitude: -122.4328 }, // Lombard & Fillmore
  { latitude: 37.7987, longitude: -122.4384 }, // Lombard & Divisadero
  { latitude: 37.7918, longitude: -122.4368 }, // Divisadero & Broadway
  { latitude: 37.7848, longitude: -122.4342 }, // Divisadero & Geary
  { latitude: 37.7782, longitude: -122.4321 }, // Divisadero & Fulton
  { latitude: 37.7728, longitude: -122.4294 }, // Haight & Fillmore
  { latitude: 37.7682, longitude: -122.4241 }, // Duboce & Guerrero
  { latitude: 37.7662, longitude: -122.4162 }, // 15th & Mission
  { latitude: 37.7712, longitude: -122.4115 }, // Howard & 11th
  { latitude: 37.7768, longitude: -122.4082 }, // Howard & 7th
  { latitude: 37.7834, longitude: -122.4126 }, // Eddy & Larkin
  { latitude: 37.7896, longitude: -122.4218 }, // Geary & Van Ness
  { latitude: 37.7958, longitude: -122.4235 }, // Broadway & Van Ness
  { latitude: 37.8012, longitude: -122.4254 }, // Back to Lombard & Van Ness
]);

// Route 3: Kuril Flyover -> Pragati Sarani -> Bashundhara Gate -> Natun Bazar ->
// Gulshan-2 -> Kemal Ataturk -> Banani Overpass -> Airport Highway -> Kurmitola -> Kuril
const ROUTE_3_DHAKA = smoothRoadCoordinates([
  { latitude: 23.8204, longitude: 90.4201 }, // Kuril Flyover Interchange
  { latitude: 23.8161, longitude: 90.4234 }, // Jamuna Future Park North
  { latitude: 23.8124, longitude: 90.4245 }, // Bashundhara Gate Pragati Sarani
  { latitude: 23.8068, longitude: 90.4252 }, // Nadda Bus Stand
  { latitude: 23.8012, longitude: 90.4256 }, // Natun Bazar Intersection
  { latitude: 23.7978, longitude: 90.4222 }, // Baridhara Madani Ave
  { latitude: 23.7959, longitude: 90.4176 }, // Gulshan-2 East Approach
  { latitude: 23.7947, longitude: 90.4139 }, // Gulshan-2 Circle
  { latitude: 23.7939, longitude: 90.4092 }, // Kemal Ataturk / Gulshan-2 Bridge
  { latitude: 23.7937, longitude: 90.4052 }, // Banani Rd 11
  { latitude: 23.7941, longitude: 90.4013 }, // Banani Overpass Airport Rd
  { latitude: 23.7998, longitude: 90.4034 }, // Staff Road Crossing
  { latitude: 23.8056, longitude: 90.4059 }, // MES Gate / Airport Hwy
  { latitude: 23.8114, longitude: 90.4086 }, // Kurmitola General Hospital
  { latitude: 23.8168, longitude: 90.4126 }, // Radisson / Kuril Ramp West
  { latitude: 23.8199, longitude: 90.4168 }, // Kuril Flyover Approach
  { latitude: 23.8204, longitude: 90.4201 }, // Back to Kuril Interchange
]);

const ROUTE_3_SF = smoothRoadCoordinates([
  { latitude: 37.7582, longitude: -122.3875 }, // Cesar Chavez & 3rd
  { latitude: 37.7512, longitude: -122.3882 }, // 3rd & Evans
  { latitude: 37.7445, longitude: -122.3928 }, // Cesar Chavez & Hwy 101
  { latitude: 37.7376, longitude: -122.3982 }, // Alemany & Bayshore
  { latitude: 37.7358, longitude: -122.4062 }, // Alemany & Silver
  { latitude: 37.7408, longitude: -122.4158 }, // Mission & Cortland
  { latitude: 37.7478, longitude: -122.4192 }, // Mission & Cesar Chavez
  { latitude: 37.7568, longitude: -122.4215 }, // Mission & 22nd
  { latitude: 37.7642, longitude: -122.4162 }, // 16th & Mission
  { latitude: 37.7668, longitude: -122.4068 }, // 16th & Potrero
  { latitude: 37.7642, longitude: -122.3965 }, // Mariposa & 3rd
  { latitude: 37.7582, longitude: -122.3875 }, // Back to Cesar Chavez & 3rd
]);

// Route 4: Moghbazar -> Malibagh -> Mouchak -> Shantinagar -> Kakrail -> Motijheel ->
// Paltan -> Shahbagh -> Bangla Motor -> Moghbazar
const ROUTE_4_DHAKA = smoothRoadCoordinates([
  { latitude: 23.7518, longitude: 90.4052 }, // Moghbazar Crossing
  { latitude: 23.7484, longitude: 90.4106 }, // Wireless Gate / Outer Circular Rd
  { latitude: 23.7456, longitude: 90.4148 }, // Malibagh Railgate
  { latitude: 23.7418, longitude: 90.4144 }, // Mouchak Market
  { latitude: 23.7382, longitude: 90.4149 }, // Shantinagar Crossing
  { latitude: 23.7349, longitude: 90.4169 }, // Rajarbagh / Fakirapool
  { latitude: 23.7302, longitude: 90.4188 }, // Arambagh / Notre Dame
  { latitude: 23.7276, longitude: 90.4166 }, // Motijheel Shapla Square
  { latitude: 23.7294, longitude: 90.4112 }, // Dainik Bangla / Baitul Mukarram
  { latitude: 23.7336, longitude: 90.4084 }, // Paltan VIP Road
  { latitude: 23.7376, longitude: 90.4046 }, // Kakrail Mosque / Matsya Bhaban
  { latitude: 23.7389, longitude: 90.3992 }, // Shahbagh Intersection
  { latitude: 23.7448, longitude: 90.3976 }, // Kazi Nazrul Islam Ave
  { latitude: 23.7501, longitude: 90.3972 }, // Bangla Motor
  { latitude: 23.7512, longitude: 90.4016 }, // Eskaton Garden Rd
  { latitude: 23.7518, longitude: 90.4052 }, // Back to Moghbazar
]);

const ROUTE_4_SF = smoothRoadCoordinates([
  { latitude: 37.7815, longitude: -122.4562 }, // Geary & Arguello
  { latitude: 37.7752, longitude: -122.4542 }, // Fulton & Arguello
  { latitude: 37.7688, longitude: -122.4512 }, // Lincoln & 9th
  { latitude: 37.7634, longitude: -122.4442 }, // Judah & Cole
  { latitude: 37.7592, longitude: -122.4368 }, // Market & Castro
  { latitude: 37.7645, longitude: -122.4265 }, // Market & Church
  { latitude: 37.7695, longitude: -122.4182 }, // Market & Valencia
  { latitude: 37.7755, longitude: -122.4194 }, // Van Ness & Market
  { latitude: 37.7825, longitude: -122.4216 }, // Geary & Van Ness
  { latitude: 37.7818, longitude: -122.4385 }, // Geary & Divisadero
  { latitude: 37.7815, longitude: -122.4562 }, // Back to Geary & Arguello
]);

export const CITY_ROUTES: CityRoute[] = [
  {
    id: "route-1",
    name: "Gulshan – Hatirjheel Express Loop",
    code: "RT-101",
    color: "#0891B2",
    distanceKm: 18.4,
    estimatedMinutes: 24,
    description:
      "Gulshan-2 Hub via Pragati Sarani and Hatirjheel Waterfront Viaduct to Tejgaon-Moghbazar Hub.",
    waypoints: dhakaCoordsToVectorPoints(ROUTE_1_DHAKA),
    dhakaCoords: ROUTE_1_DHAKA,
    sfCoords: ROUTE_1_SF,
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
    color: "#0891B2",
    distanceKm: 24.6,
    estimatedMinutes: 31,
    description:
      "High-capacity freight artery connecting Banani Commercial Hub, Mohakhali Flyover, and Tejgaon Industrial Park.",
    waypoints: dhakaCoordsToVectorPoints(ROUTE_2_DHAKA),
    dhakaCoords: ROUTE_2_DHAKA,
    sfCoords: ROUTE_2_SF,
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
    color: "#0891B2",
    distanceKm: 32.1,
    estimatedMinutes: 36,
    description:
      "Direct air-freight expressway linking Airport Cargo Terminal, Kuril Flyover, and Central Logistics Hub.",
    waypoints: dhakaCoordsToVectorPoints(ROUTE_3_DHAKA),
    dhakaCoords: ROUTE_3_DHAKA,
    sfCoords: ROUTE_3_SF,
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
    color: "#0891B2",
    distanceKm: 28.9,
    estimatedMinutes: 34,
    description:
      "Commercial perimeter loop serving Motijheel Commercial Hub, Paltan, Moghbazar, and Rampura.",
    waypoints: dhakaCoordsToVectorPoints(ROUTE_4_DHAKA),
    dhakaCoords: ROUTE_4_DHAKA,
    sfCoords: ROUTE_4_SF,
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
    color: "#0891B2",
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
    color: "#0891B2",
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
    color: "#0891B2",
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
    color: "#0891B2",
    active: true,
  },
];
