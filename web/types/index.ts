export type VehicleType =
  | "Van"
  | "Sedan"
  | "Pickup"
  | "Truck"
  | "SUV"
  | "Motorcycle";

export type FuelType = "Petrol" | "Diesel" | "Hybrid" | "Electric" | "CNG";

export type VehicleLifecycleStatus =
  | "available"
  | "on_trip"
  | "under_maintenance"
  | "out_of_service"
  | "decommissioned";

export type UserRole =
  | "super_admin"
  | "fleet_manager"
  | "dispatcher"
  | "mechanic"
  | "driver";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType:
    | "vehicle"
    | "compliance"
    | "driver"
    | "booking"
    | "trip"
    | "geofence"
    | "fuel"
    | "expense"
    | "maintenance"
    | "work_order"
    | "incident"
    | "rbac"
    | "system";
  entityId?: string;
  summary: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  type: VehicleType;
  odometerKm: number;
  createdAt: string;
  // Extended asset profile
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: FuelType;
  engineCapacityCc?: number;
  tankCapacityLiters?: number;
  engineHours?: number;
  status?: VehicleLifecycleStatus;
  purchaseCost?: number;
  monthlyDepreciation?: number;
}

export type ComplianceDocType =
  | "registration"
  | "fitness"
  | "route_permit"
  | "insurance";

export interface ComplianceDocument {
  id: string;
  vehicleId: string;
  docType: ComplianceDocType;
  documentNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  cost?: number;
  attachmentDataUrl?: string;
  notes?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  t: number;
}

export type TripStatus = "active" | "paused" | "done";

export interface TripChecklist {
  phase: "pre" | "post";
  completedAt: string;
  tiresOk: boolean;
  lightsOk: boolean;
  brakesOk: boolean;
  fluidsOk: boolean;
  bodyOk: boolean;
  notes?: string;
  damagePhotos: string[];
}

export interface TripWaypoint {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  arrivedAt?: string;
  recipientName?: string;
  podSignatureDataUrl?: string;
  podPhotoDataUrl?: string;
}

export interface TripSafetyMetrics {
  harshBrakingCount: number;
  speedingIncidents: number;
  idleMinutes: number;
  onTime: boolean;
}

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
  bookingId?: string;
  preTripChecklist?: TripChecklist;
  postTripChecklist?: TripChecklist;
  waypoints?: TripWaypoint[];
  safetyMetrics?: TripSafetyMetrics;
}

export type BookingStatus = "pending" | "approved" | "rejected" | "dispatched";

export interface TripBooking {
  id: string;
  requesterName: string;
  department?: string;
  purpose: string;
  requestedDate: string;
  estimatedKm: number;
  vehicleId?: string;
  driverId?: string;
  status: BookingStatus;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export type GeofenceZoneType = "warehouse" | "client_site" | "restricted";

export interface GeofenceZone {
  id: string;
  name: string;
  type: GeofenceZoneType;
  polygon: LatLng[];
  active: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  afterHoursOnly?: boolean;
  allowedStartHour?: number;
  allowedEndHour?: number;
}

export interface GeofenceAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  vehicleId: string;
  tripId?: string;
  eventType: "entered" | "exited" | "after_hours";
  timestamp: string;
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
  station?: string;
  receiptPhotoDataUrl?: string;
}

export type ExpenseCategory =
  | "Tolls"
  | "Parking"
  | "Fines"
  | "Driver allowance"
  | "Other";

export interface OperatingExpense {
  id: string;
  vehicleId: string;
  tripId?: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  costCenter?: string;
  description: string;
  receiptPhotoDataUrl?: string;
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
  dueEngineHours?: number;
  intervalKm?: number;
  intervalDays?: number;
  intervalEngineHours?: number;
  completedDate?: string;
  cost?: number;
}

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "waiting_parts"
  | "completed";

export type WorkOrderPriority = "low" | "medium" | "high" | "critical";

export interface SparePartLine {
  id: string;
  name: string;
  qty: number;
  unitCost: number;
}

export interface WorkOrder {
  id: string;
  vehicleId: string;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  vendorName: string;
  mechanicPhone?: string;
  openedAt: string;
  completedAt?: string;
  downtimeHours: number;
  warrantyUntil?: string;
  parts: SparePartLine[];
  laborCost: number;
  notes?: string;
}

export type IncidentSeverity = "minor" | "moderate" | "major";
export type IncidentStatus = "open" | "investigating" | "resolved";

export interface IncidentReport {
  id: string;
  vehicleId: string;
  driverId?: string;
  occurredAt: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  locationLabel: string;
  lat?: number;
  lng?: number;
  description: string;
  thirdPartyName?: string;
  thirdPartyPlate?: string;
  thirdPartyInsurance?: string;
  estimatedCost?: number;
  photos: string[];
}

export interface VehicleAssignmentEntry {
  vehicleId: string;
  assignedAt: string;
  unassignedAt?: string;
}

export interface DriverShift {
  id: string;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface DriverLeave {
  id: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  reason: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  licenseClass?: string;
  licenseExpiry: string;
  assignedVehicleId?: string;
  assignedVehicleHistory?: VehicleAssignmentEntry[];
  shifts?: DriverShift[];
  leaveLogs?: DriverLeave[];
}

export interface FleetExportPayload {
  version: number;
  exportedAt: string;
  vehicles: Vehicle[];
  trips: Trip[];
  fuelLogs?: FuelLog[];
  maintenanceRecords?: MaintenanceRecord[];
  drivers?: Driver[];
  complianceDocs?: ComplianceDocument[];
  bookings?: TripBooking[];
  geofences?: GeofenceZone[];
  geofenceAlerts?: GeofenceAlert[];
  expenses?: OperatingExpense[];
  workOrders?: WorkOrder[];
  incidents?: IncidentReport[];
  auditLogs?: AuditLogEntry[];
}
