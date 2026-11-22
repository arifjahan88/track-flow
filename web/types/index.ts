export type VehicleType =
  | "Van"
  | "Sedan"
  | "Pickup"
  | "Truck"
  | "SUV"
  | "Motorcycle";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  type: VehicleType;
  odometerKm: number;
  createdAt: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  t: number;
}

export type TripStatus = "active" | "paused" | "done";

export interface Trip {
  id: string;
  vehicleId: string;
  driverId?: string;
  purpose: string;
  status: TripStatus;
  startedAt: string;
  endedAt?: string;
  distanceKm: number;
  maxSpeedKmh: number;
  points: TrackPoint[];
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  odometerKm: number;
  fullTank: boolean;
}

export type MaintenanceType =
  | "Oil change"
  | "Tire service"
  | "Brake inspection"
  | "Battery check"
  | "General service"
  | "Inspection";

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  title: string;
  type: MaintenanceType;
  scheduledDate?: string;
  dueOdometerKm?: number;
  completedDate?: string;
  cost?: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseExpiry: string;
  assignedVehicleId?: string;
}

export interface FleetExportPayload {
  version: number;
  exportedAt: string;
  vehicles: Vehicle[];
  trips: Trip[];
  fuelLogs?: FuelLog[];
  maintenanceRecords?: MaintenanceRecord[];
  drivers?: Driver[];
}
