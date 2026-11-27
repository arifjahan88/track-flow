# TrackFlow Web — Comprehensive User Manual & Production Architecture Guide

**Enterprise Fleet Operations Console · Real-Time GPS Navigation, Dispatch, Cost Control & Backend Architecture**  
**Document Version:** 2.0 · **Date:** 27 November 2026 · **Frontend Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand 5

---

## 1. Executive Summary

**TrackFlow Web** is the central operations, dispatch, compliance, and financial analytics console for the TrackFlow vehicle management platform. Designed around a modern telemetry-grade interface (Plus Jakarta Sans, Space Grotesk, and JetBrains Mono typography with a dark slate and cyan `#0891B2` / `#06B6D4` flat-action design system), it unifies live vehicle tracking, driver scheduling, trip booking approvals, compliance monitoring, fuel anomaly detection, preventive maintenance, work orders, roadside incidents, Total Cost of Ownership (TCO) reporting, and Role-Based Access Control (RBAC).

Today, TrackFlow Web runs as a self-contained, browser-persisted interactive prototype (`localStorage` via Zustand) paired with a high-frame-rate live GPS corridor simulation engine. This manual serves two purposes:
1. **Operational User Guide:** A complete, page-by-page walkthrough of every route, workflow, control, and role permission built into the web application.
2. **Production Engineering Blueprint:** A comprehensive plan detailing how TrackFlow Web connects to the target shared backend (**Modular API + PostgreSQL/PostGIS/TimescaleDB + Redis + Apache Kafka + Specialized Workers**) for real-time enterprise fleet operations.

---

## 2. Quick Start & Demo Access

### 2.1 Running TrackFlow Web Locally
1. Navigate to the web workspace from the repository root:
   ```bash
   cd web
   yarn install --frozen-lockfile
   yarn dev
   ```
2. Open the local development URL printed in your terminal (default: `http://localhost:3000`).
3. The root route (`/`) automatically checks authentication state and routes unauthenticated users to `/login` or authenticated users to `/dashboard`.

### 2.2 Authentication & 1-Click Role Personas (6 Roles)
On `/login` (**Sign in to TrackFlow**), you can sign in manually, register a new local profile with a chosen role, or launch instantly using the **Quick Demo Accounts (1-Click Launch)** panel. All six pre-seeded accounts share the demo password `demo1234`:

| Persona Name | Role | Email | Role-Wise Dashboard & Scoped Operational Access |
| :--- | :--- | :--- | :--- |
| **Alex Morgan** | **Super Admin** | `demo@demo.com` | **Super Admin Command Center:** Full access across all 8 routes, pending trip assignments, RBAC role management, audit trail, JSON backup/restore. |
| **Farhana Rahman** | **Fleet Manager** | `manager@demo.com` | **Fleet Operations & Cost Control:** Pending trip assignments, Compliance Vault watchlist (`30d/15d/7d`), fuel anomalies, 7-day charts, TCO/CPK reports. |
| **Sarah Chen** | **Dispatcher** | `dispatch@demo.com` | **Dispatch Control Center:** Priority pending trip queue (inline **Assign Driver**), available vehicle & driver pool, live GPS radar, geofences. |
| **Kamrul Islam** | **Mechanic** | `mechanic@demo.com` | **Mechanic Service Bay:** Active work orders (inline status advancement), due preventive services, maintenance-locked vehicle release, open incidents. |
| **Marcus Vance** | **Driver** | `driver@demo.com` | **Driver Duty Dashboard:** Strict record-level RBAC — sees **only** his assigned trips ready to start (`Start Trip Pre-Check`), active trip (`Capture POD` & `Finish Trip Post-Check`), assigned vehicle fuel/expenses/SOS, and Safety Score + passenger star rating. |
| **Nadia Karim** | **Employee / User** | `user@demo.com` | **My Trip Portal:** Strict record-level RBAC — requests trips (`Pickup → Drop-off`), watches live 4-step progress (`Pending → Driver Assigned → In Progress → Completed`), tracks only her assigned ride live, and submits **5-star driver ratings** after completion. |

> **Live Web ↔ Mobile Demo Sync Bridge:** Click the **`SYNC OFF / SYNC LIVE`** pill in the Web Topbar (and tap **Enable Live Web Sync** in Mobile Profile) while both dev servers run locally to synchronize trip requests, driver assignments, trip starts/finishes, PODs, ratings, and alerts live across Web and Mobile via `/api/demo-sync`.

---

## 3. Complete Web Page-by-Page Architecture & Workflow Map

TrackFlow Web uses the **Next.js App Router** (`web/app/`) with an authenticated shell (`AppShell` containing collapsible `Sidebar`, `Topbar`, live alert bell, theme toggle, and role switcher). Below is the complete inventory of every web page, its purpose, components, and operational capabilities:

| Route | Navigation Label | Primary Purpose & Core Functionality | Key Sub-Tabs / Modals |
| :--- | :--- | :--- | :--- |
| `/login` | Sign In / Register | Split-screen authentication with animated telemetry route hero, manual email/password sign-in, self-registration with role selection, and 1-Click Quick Demo account launchers. | `Sign in` tab · `Register` tab · Theme Toggle |
| `/dashboard` | Executive Dashboard | Fleet-wide command summary: Driver assignment spotlight (for Driver role), 4 real-time KPI cards, segmented Fleet Status Distribution bar, 7-day Fuel Spend & Distance Area Chart + Status Donut, Live Fleet Roster with 1-click **Track** links, and Recent Alerts feed. | `FleetCharts` · `LiveFleetRoster` · Quick Dispatch CTA |
| `/trips` | Live GPS Tracking | Real-time navigation & dispatch workspace: interactive Live Vector Map with smooth pan/zoom/camera lock, multi-corridor live vehicles, geofence entry banners, live OBD-II diagnostics strip, Telemetry Inspector (speed gauge, heading, fuel, odometer, start/end trip controls), plus bottom operations tabs. | `Trip History` (with interactive `RoutePlayback` scrubber modal) · `Bookings` (request, approve/reject, conflict check, dispatch) · `Geofences` (vector & polygon zone manager) · `TripChecklistDialog` · `WaypointPodDialog` |
| `/vehicles` | Vehicles & Assets | Complete asset registry: search & lifecycle status filter (`available`, `on_trip`, `under_maintenance`, `out_of_service`, `decommissioned`), Compliance Vault expiry alert banner (`30d / 15d / 7d / Expired`), vehicle cards with inline lifecycle switcher, and deep asset profile inspection. | `VehicleForm` (Add/Edit modal) · `VehicleDetailsDialog` (Specs, Compliance Vault document manager, Fuel & Service summary) · Delete safety guard |
| `/drivers` | Drivers & Shifts | Human resource & safety hub: driver roster cards with license validity badges, real-time availability badge, 0–100 **Safety Score** (harsh braking, speeding, idle minutes, on-time %), lifetime trip/km/max-speed stats, and full schedule management. | Add/Edit Driver modal · `DriverScheduleDialog` (Weekday shift builder, Leave date ranges, Vehicle assignment history) |
| `/fuel` | Fuel & Expenses | Financial & efficiency control: vehicle filter, `km/L` ↔ `MPG` unit toggle, automated **Fuel Anomaly Alert Banner** (flags >25% efficiency drop or fill volume exceeding tank capacity), 4 cost/efficiency KPI cards with trend sparkline, and dual operational ledgers. | `Fuel Logs` tab (add/edit/delete fill-ups, tank filter, receipt preview) · `Expenses` tab (Tolls, Parking, Fines, Driver allowance, Other; cost center & receipt preview) |
| `/maintenance` | Maintenance | Fleet uptime & safety lifecycle: 4 health KPI cards (Overdue Services, Due Soon within 14d/500km/25h, Active Work Orders, Open Incidents) driving three specialized operational modules. | `Services` tab (Preventive rules by calendar/km/engine hours) · `Work Orders` tab (Repair workflow, vendor, parts lines, labor, warranty, downtime) · `Incidents` tab (Accident severity, third-party insurance, damage photos, status progression) |
| `/reports` | Reports & TCO | Executive analytics & data export: multi-dimensional filtering (search, vehicle, driver, date-range picker with presets), daily distance BarChart, paginated Trip Reports table with 1-click **Export Trips CSV**, financial TCO/CPK matrix, and fleet utilization heat analytics. | `Trip Reports` tab · `CPK & TCO` tab (`TcoAnalyticsTab`) · `Utilization` tab (`UtilizationTab` with peak-hour demand) |
| `/settings` | Settings & RBAC | System governance & workspace administration: RBAC permission matrix and live user role assignment (Super Admin), searchable operational Audit Log, dark/light theme preferences, and complete JSON workspace backup, import validation, and demo reset. | `RBAC & Roles` tab · `Audit Log` tab · `General & Data` tab |

---

## 4. Detailed Module & Operational Workflows

### 4.1 Executive Dashboard (`/dashboard`)
The landing console provides instant situational awareness across the entire fleet:
- **Driver Assignment Spotlight:** When signed in as a `Driver`, a highlighted cyan banner surfaces the assigned vehicle's plate, live fuel percentage, current odometer, lifecycle status, and a direct **Open Live Cockpit** button (`/trips?vehicle=<id>`).
- **4 Core KPI Cards:**
  1. **Total Fleet:** Total registered units and standby availability count.
  2. **Active Trips:** Live pulsing indicator showing vehicles currently in `on_trip` status and active corridors.
  3. **Distance Covered:** Cumulative kilometers logged across all tracked trip manifests.
  4. **Active Alerts:** Unread alert count alongside critical threshold count.
- **Fleet Status Distribution:** A dynamic segmented progress bar displaying percentage splits across *In Trip* (cyan), *Active/Standby* (emerald), *Maintenance* (amber), and *Inactive/Decommissioned* (slate).
- **Analytics & Roster:** Displays 7-day fuel spend & distance charts (`FleetCharts`), a live status breakdown donut, the **Live Fleet Roster** (with 1-click **Track** navigation into `/trips`), and an interactive **Recent Alerts Feed** with per-alert mark-as-read actions.

### 4.2 Live GPS Tracking, Dispatch & Geofences (`/trips`)
This is the core operational command center modeled after real-time navigation and fleet telematics platforms:

#### A. Live Vector Map & Telemetry Inspector
- **60fps Simulation Engine with Throttled Persistence:** An animation loop interpolates every active vehicle smoothly along its assigned city corridor (`interpolateRoutePosition`), smoothly blends heading angles (`lerpAngle`), varies realistic road speed, and commits batched telemetry updates (`applySimulationTick`) to the fleet store every **1.2 seconds** (updating odometer, fuel consumption, coordinates, and active trip trails).
- **Map Controls:** Pan, zoom, reset view, toggle camera follow-lock on the selected vehicle, pause/resume global simulation, and adjust playback speed (`1×`, `2×`, `4×`).
- **Live OBD-II Diagnostics Strip:** Displays ignition status, trip distance, simulated RPM, coolant temperature, battery voltage, and engine load telemetry beneath the map canvas.
- **Telemetry Inspector Panel:** Shows the selected vehicle's analog/digital **Speed Gauge**, compass heading, GPS coordinates, corridor completion progress, fuel level, assigned driver, and instant action buttons:
  - **Start Live Trip** (launches an available vehicle onto its corridor).
  - **End Active Trip** (triggers the mandatory **Post-Trip Inspection Checklist** before closing the trip).

#### B. Closed-Loop Trip Request → Admin Assign Driver → Driver Start → POD → Finish → Rate (`Trip Requests` Tab)
1. **User Requests Trip (`RequestTripDialog`):** Any authorized user (or **Employee / User** `user@demo.com`) enters Pickup Location, Drop-off Destination, Purpose, Date/Time, Passengers, and Estimated km. The booking enters `pending` status without premature driver assignment and notifies Admins immediately.
2. **Admin Assigns Driver & Vehicle (`AssignDriverDialog`):** Super Admin, Fleet Manager, or Dispatcher reviews the pending request, inspects live driver availability badges (*Available* / *Queued* / *On Leave* + Safety Score) and ready vehicles, and confirms assignment → booking transitions to `assigned` and alerts the Driver & Requester.
3. **Driver Starts Trip (Pre-Trip Checklist):** The assigned Driver clicks **Start Trip (Pre-Check)** from their Driver Dashboard or `/trips` → completes the 5-point safety walkaround + photos → atomically creates the linked `Trip` (`bookingId`, `driverId`, `preTripChecklist`, destination waypoint), switches vehicle to `on_trip`, and updates booking to `in_progress`.
4. **Proof of Delivery (POD) & Printable PDF Manifest:** During the trip, clicking **Capture POD** in the Telemetry Inspector opens `WaypointPodDialog` (recipient name, touch/mouse signature canvas, photo). Clicking **Finish Trip (Post-Check)** saves the post-walkaround, completes both `Trip` (`done`) and `TripBooking` (`completed`), and returns the vehicle to `available`. Opening any completed trip in **Trip History** supports interactive **Route Playback** and 1-click **Print / PDF Manifest** export.
5. **Post-Trip 5-Star Rating:** The Employee rates the completed ride (1–5 stars) on their portal, updating the Driver's average passenger rating badge.

## 5. Strict Role-Based Access Control (RBAC) — Route & Record Level

Defined in `web/lib/rbac.ts` and enforced at both route level (`AppShell`) and record level (`web/lib/rbac-scope.ts`) across **6 roles** and **15 permissions**:

| Role | Route Scope | Strict Record-Level Data Visibility |
| :--- | :--- | :--- |
| **Employee / User** | `/dashboard`, `/trips`, `/settings` | Sees **only** own trip requests, live map tracking **only** for own assigned/active ride (read-only passenger view), own trip history, and personal trip alerts. Direct access to other routes shows an **Access Restricted** guard. |
| **Driver** | `/dashboard`, `/trips`, `/fuel`, `/maintenance` (SOS only), `/settings` | Sees **only** trips driven by them, bookings assigned to them (never Admin pending queue), own assigned vehicle(s), own fuel/expense/incident logs, and own alerts. |
| **Mechanic** | `/dashboard`, `/maintenance`, `/vehicles`, `/trips`, `/reports`, `/settings` | Focuses on preventive services, work orders, maintenance holds, and incident alerts. |
| **Dispatcher** | `/dashboard`, `/trips`, `/drivers`, `/vehicles`, `/reports`, `/settings` | Full dispatch queue, driver assignment, live GPS radar, and geofence controls. |
| **Fleet Manager** | All operational routes + Audit Log | Full fleet management, compliance vault, fuel anomalies, TCO/CPK, and audit review. |
| **Super Admin** | All 8 routes + RBAC Admin | Full control including live user role assignment and backup/restore. |

#### D. Geofences (`Geofences` Tab)
- Monitor pre-seeded city operational zones with real-time boundary crossing detection (`isPointInsideVectorGeofence`).
- When a moving vehicle crosses into an active zone, TrackFlow triggers a floating **Geofence Entry Banner**, a toast notification, and logs an alert in the notification bell.
- Create custom polygon geofences (`warehouse`, `client_site`, `restricted`) with configurable entry/exit alerts and after-hours curfew rules (`allowedStartHour` – `allowedEndHour`).

### 4.3 Vehicle & Asset Registry (`/vehicles`)
- **Asset Registration & Editing:** Record vehicle name, license plate, type (`Van`, `Sedan`, `Pickup`, `Truck`, `SUV`, `Motorcycle`), VIN/chassis number, make, model, year, fuel type (`Petrol`, `Diesel`, `Hybrid`, `Electric`, `CNG`), engine capacity (cc), tank capacity (L), odometer (km), engine hours, lifecycle status, purchase cost, and monthly depreciation.
- **Lifecycle Controls:** Transition vehicles between `Available`, `On Trip`, `Under Maintenance`, `Out of Service`, and `Decommissioned`. Safety guards prevent deleting a vehicle that is currently on an active trip.
- **Compliance Vault (30 / 15 / 7-Day Alerting):** Every vehicle profile includes a Compliance tab storing *Registration / Tax Token*, *Fitness Certificate*, *Route Permit*, and *Insurance* records (document number, issuer, issue/expiry dates, renewal cost, and scanned attachment). Expiring or expired documents surface automatically in the top **Compliance Vault Alerts** banner for 1-click inspection.

### 4.4 Driver & Staff Management (`/drivers`)
- **Driver Directory:** Manage contact phone numbers, license numbers, license classes (`Class A`, `Class B`, `Class C1`, `Class C`), license expiry monitoring (`Valid`, `Expires <30d`, `Expired`), and vehicle assignments.
- **Driver Safety Score (0–100):** Automatically derived from completed trip telemetry (`computeDriverSafetyScore`), breaking down *Harsh Braking*, *Speeding Incidents*, *Idle Minutes*, and *On-Time Rate (%)* into a clear grade.
- **Shifts, Leave & Assignment History (`DriverScheduleDialog`):** Configure recurring weekday shift hours, log date-range leave requests, and audit the chronological history of which vehicles a driver operated.

### 4.5 Fuel & Operating Expenses (`/fuel`)
- **Fuel Fill-Up Ledger:** Log date, vehicle, litres, price/L or total cost, odometer reading, station name, full-tank indicator, and receipt image attachment (with full-size modal preview).
- **Automated Theft & Leak Anomaly Detection (`detectFuelAnomalies`):**
  - Flags any fill-up whose volume exceeds the vehicle's registered `tankCapacityLiters`.
  - Flags sudden fuel efficiency drops exceeding **25%** compared to the vehicle's historical baseline between consecutive full-tank fill-ups.
  - Supports instant switching between **km/L** and **MPG**, plus a 1-click **Filter anomalies** button.
- **Operating Expenses Ledger:** Track non-fuel costs (*Tolls*, *Parking*, *Fines*, *Driver allowance*, *Other*) linked to vehicles, optional trips, cost centers, descriptions, and uploaded receipts.

### 4.6 Maintenance, Work Orders & Incidents (`/maintenance`)
- **Preventive Service Rules (`Services` Tab):** Schedule recurring or one-off maintenance (*Oil change*, *Tire service*, *Brake inspection*, *Battery check*, *General service*, *Inspection*) triggered by **calendar date**, **odometer km**, or **engine hours**. Automatically categorizes tasks as `Overdue`, `Due Soon` (within 14 days / 500 km / 25 engine hours), or `Scheduled`, and logs completion cost/date.
- **Corrective Work Orders (`Work Orders` Tab):** Create repair tickets with priority (`low`, `medium`, `high`, `critical`), vendor/workshop name, mechanic phone, itemized spare parts (`qty × unitCost`), labor cost, warranty expiry date, and vehicle downtime hours. Progress orders through `Open` → `In Progress` → `Waiting Parts` → `Completed`.
- **Roadside & Accident Incidents (`Incidents` Tab):** Record severity (`minor`, `moderate`, `major`), location label & GPS coordinates, incident narrative, third-party driver/plate/insurance details, estimated repair cost, and damage photos. Track cases through `Open` → `Investigating` → `Resolved`.

### 4.7 Analytics, Reports & TCO (`/reports`)
- **Trip Reports Tab:** Filter completed trips by keyword search, vehicle, driver, and calendar date range (with quick presets). Displays 4 KPI summaries (*Total Distance*, *Trip Count*, *Average Speed*, *Top Speed*), a **Daily Distance Bar Chart**, a paginated trip table, and **Export Trips CSV** download.
- **CPK & TCO Tab:** Calculates **Total Cost of Ownership** per vehicle by combining Fuel Spend + Preventive Maintenance + Work Orders (Parts & Labor) + Operating Expenses + Compliance Document Costs + Depreciation, then derives **Cost per Kilometer (CPK)** against completed trip distance.
- **Utilization Tab:** Computes 30-day per-vehicle utilization rates (active days, total trips, distance, hours) alongside a **Peak-Hour Demand** distribution chart to identify fleet bottlenecks.

### 4.8 Settings, RBAC & Audit Trail (`/settings`)
- **RBAC & Roles Tab:** Displays the full 14-permission matrix across all 5 roles. *Super Admins* can dynamically reassign any user's role.
- **Audit Log Tab:** Inspect timestamped records of operational actions (`actor`, `role`, `action`, `entityType`, `entityId`, `summary`) across all 13 entity categories.
- **General & Data Tab:** Switch between Dark Navy Telemetry mode and Crisp Daylight mode; export a full versioned JSON workspace snapshot (`trackflow-backup-YYYY-MM-DD.json`); import and schema-validate a backup; or reset to the default demo seed.

---

## 5. Role-Based Access Control (RBAC) Matrix

Defined in `web/lib/rbac.ts` (14 granular permissions across 5 roles):

| Permission Key | Capability | Super Admin | Fleet Manager | Dispatcher | Mechanic | Driver |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `vehicles:write` | Add/edit/delete vehicles & lifecycle | Yes | Yes | — | — | — |
| `compliance:write` | Manage Compliance Vault documents | Yes | Yes | — | — | — |
| `drivers:write` | Manage drivers, shifts & leave | Yes | Yes | — | — | — |
| `dispatch:approve` | Approve or reject trip bookings | Yes | Yes | Yes | — | — |
| `trips:operate` | Start/end trips, checklists & POD | Yes | Yes | Yes | — | Yes |
| `geofences:write` | Create/toggle/delete geofences | Yes | Yes | Yes | — | — |
| `fuel:write` | Log & edit fuel fill-ups | Yes | Yes | — | — | Yes |
| `expenses:write` | Log operating expenses | Yes | Yes | Yes | — | Yes |
| `maintenance:write` | Schedule & complete service rules | Yes | Yes | — | Yes | — |
| `work_orders:write` | Create & advance repair work orders | Yes | Yes | — | Yes | — |
| `incidents:write` | Report & update roadside incidents | Yes | Yes | Yes | Yes | Yes |
| `reports:view` | View TCO, CPK & utilization reports | Yes | Yes | Yes | Yes | — |
| `audit:view` | Inspect operational audit log | Yes | Yes | — | — | — |
| `admin:rbac` | Assign user roles & RBAC policies | Yes | — | — | — | — |

---

## 6. End-to-End Operational Flows (Prototype Today vs. Production Tomorrow)

### Flow 1: Booking → Approval → Pre-Trip Inspection → Live Tracking → POD → Post-Trip Close
1. **Request (`/trips → Bookings`):** Staff submits a booking; system checks driver shift/leave conflicts.
2. **Approve (`/trips → Bookings`):** Dispatcher or Fleet Manager approves the booking.
3. **Inspect & Dispatch (`TripChecklistDialog`):** Driver/Dispatcher completes the 5-point safety walkaround + damage photos and launches the trip.
4. **Live Command (`/trips` Map + OBD-II):** Vehicle streams real-time coordinates, speed, heading, and fuel consumption; geofence crossings fire instant banners and alerts.
5. **Delivery Sign-Off (`WaypointPodDialog`):** Recipient signs on canvas and photo evidence marks the stop delivered.
6. **Close & Replay:** Post-trip checklist finalizes the trip, updates vehicle odometer/availability, feeds `/reports` (TCO & Utilization), and enables route playback.

### Flow 2: Fuel Logging → Anomaly Detection → TCO Impact
1. Driver or Fleet Manager logs fill-up on `/fuel` (or Mobile Quick Fuel).
2. System compares fill volume against `tankCapacityLiters` and calculates `km/L` against the previous full-tank odometer.
3. Any >25% efficiency drop or tank overflow raises an immediate anomaly flag for review and feeds into `/reports → CPK & TCO`.

### Flow 3: Preventive Rule / Incident → Work Order → Vehicle Recovery
1. Overdue service rule or driver-submitted SOS Incident triggers a **Work Order** on `/maintenance`.
2. Vehicle lifecycle moves to `under_maintenance` (blocking dispatch).
3. Mechanic logs spare parts, labor, warranty, and downtime, advancing status to `completed` and returning the vehicle to `available`.

---

## 7. Current Prototype Architecture vs. Target Production Backend

### 7.1 Current Frontend Architecture (Built Today)
- **Framework:** Next.js `16.4.6` App Router (`web/app`), React `19.3`, TypeScript `5`, Tailwind CSS `4.3`, shadcn/Base UI, Recharts `3.8`, Framer Motion `14`.
- **State Layer:** Zustand `5.1` (`web/store/fleet-store.ts` with 48+ domain actions, `web/store/auth-store.ts`).
- **Limitations to Solve for Production:** Client-only `localStorage` means Web and Mobile do not share live records; GPS telemetry is simulated in the browser; photos/signatures are base64 data URLs; RBAC is enforced only in the UI; no push/SMS/email escalation exists.

### 7.2 Target Production Backend, Database, Kafka & Worker Architecture
To transition TrackFlow Web and Mobile into a unified, multi-tenant enterprise SaaS platform, the recommended architecture uses **Event-Driven Polyglot Persistence backed by Apache Kafka and Specialized Workers**:

```text
[TrackFlow Web (Next.js)] <── REST / WebSockets ──> [API & Realtime Gateway]
[TrackFlow Mobile / IoT ] ── GPS Batches / REST ──>          │
                                                             ├──> [PostgreSQL 16 + PostGIS] (ACID System of Record + Outbox)
                                                             ├──> [Redis Cluster]           (Live Vehicle State + WS Pub/Sub)
                                                             ├──> [S3 / R2 Object Store]    (Pre-Signed Media & Exports)
                                                             │
                                                             ▼
                                                  [Apache Kafka / Redpanda]
                                         (Partitioned by tenant_id:vehicle_id)
                                                             │
        ┌───────────────────┬──────────────────┬─────────────┴─────────────┬──────────────────────┐
        ▼                   ▼                  ▼                           ▼                      ▼
 [Telemetry Writer]  [Geofence & Safety]  [Trip Stitcher &]       [Anomaly & Compliance]   [Notification & Media]
 (TimescaleDB Batch) (PostGIS Polygons)   (Odometer/Score)        (Fuel Theft & Cron)      (Push/SMS/S3 Scan/CSV)
```

- **PostgreSQL 16 + PostGIS:** Single source of truth for multi-tenant entities, ACID transactional dispatch locking (preventing race conditions when two dispatchers book the same vehicle), spatial geofence polygons (`ST_Covers`), and immutable audit logs.
- **TimescaleDB (PostgreSQL Extension):** High-compression time-series hypertables storing billions of GPS telemetry and OBD-II points with sub-second route playback and continuous aggregates for `/reports`.
- **Redis:** Sub-millisecond hot cache for live fleet map snapshots (`GEOADD`), rate limiting, idempotency keys, and WebSocket Pub/Sub fan-out to all connected web dispatchers.
- **Apache Kafka (or Kafka-compatible Redpanda for lean pilot cost):** Durable, ordered event backbone partitioned by `tenant_id:vehicle_id`. Absorbs mobile reconnect storms without stressing PostgreSQL, guarantees chronological GPS ordering per vehicle, allows multiple independent workers to consume the same stream, and supports full event replay.
- **Specialized Worker Pools:** Independently scalable background consumers for telemetry ingestion, geofence/speeding evaluation, trip distance & safety scoring, fuel anomaly & compliance expiry scanning, multi-channel alert escalation (WebSocket, Push, SMS, Email), and async S3 media scanning / CSV export generation.

> For the complete architectural defense, Kafka vs. RabbitMQ/BullMQ comparison, exact database schema, topic specifications, capacity sizing, and 12-week rollout plan prepared for stakeholder review, see the companion document: **`TRACKFLOW_BACKEND_KAFKA_MEETING_PROPOSAL.md`** (and `.docx`).

---

## 8. Suggested 8-Minute Stakeholder Demo Script (Web)
1. **Minute 1 (`/login` → `/dashboard`):** Launch **Fleet Manager** with 1-click. Highlight the cyan telemetry aesthetic, live KPI counters, fleet distribution bar, and 7-day charts.
2. **Minute 2 (`/vehicles`):** Open the **Compliance Vault Alerts** banner, inspect a vehicle profile, show 30/15/7-day expiry badges, and demonstrate lifecycle status controls.
3. **Minute 3 (`/drivers`):** Open a driver card to highlight the 0–100 **Safety Score**, then open **Shifts & history** to show weekday shift schedules and leave conflict tracking.
4. **Minutes 4–5 (`/trips`):** Showcase the **Live Vector Map** (zoom, lock camera, 2×/4× speed, live OBD-II strip, geofence entry toast). Approve a booking in **Bookings**, walk through the **Pre-Trip Checklist**, and open a completed trip in **Trip History** to scrub its **Route Playback**.
5. **Minute 6 (`/fuel` & `/maintenance`):** Show the automated **Fuel Anomaly Alert** (>25% drop / tank overflow), inspect an active **Work Order** with parts + labor totals, and review an **Incident** case.
6. **Minute 7 (`/reports`):** Filter multi-day trips, show the daily distance bar chart, export CSV, and walk through **CPK & TCO** and **Utilization Peak Hours**.
7. **Minute 8 (`/settings`):** Switch to **Super Admin**, show the 14-permission **RBAC Matrix**, **Audit Log**, and JSON export, then pivot directly into the **Backend + Kafka Architecture Presentation**.
