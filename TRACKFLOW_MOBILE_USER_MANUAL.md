# TrackFlow Mobile — Comprehensive User Manual & Field Operations Guide

**Driver Navigation Cockpit, Field Dispatch, Offline-Ready Telemetry & Production Backend Roadmap**  
**Document Version:** 2.0 · **Date:** 27 November 2026 · **Mobile Stack:** Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript · Zustand 5 · Reanimated 4

---

## 1. Executive Summary

**TrackFlow Mobile** is the companion field application for drivers, dispatchers, mechanics, and on-the-go fleet managers. Inspired by modern driver navigation cockpits (Uber / Pathao ergonomics), it combines a full-screen road-aligned live map, turn-by-turn corridor guidance, pre- and post-trip safety inspections, touch-canvas Proof of Delivery (POD) signatures, quick fuel & expense logging, mechanic service bay workflows, and one-tap roadside SOS reporting.

Built with **Inter** typography and TrackFlow's unified **slightly dark cyan** identity (`#0891B2` in dark mode, `#0E7490` in light mode) with clean flat action controls and haptic feedback, the app adapts its bottom navigation tabs dynamically based on the signed-in role.

This manual provides:
1. **Complete Screen-by-Screen & Modal-by-Modal Guide** reflecting the latest mobile build (including the redesigned login flow, smooth Catmull-Rom road-following polylines, and sticky-footer notifications modal).
2. **End-to-End Field Workflows** for Drivers, Dispatchers, Mechanics, and Fleet Managers.
3. **Production Engineering Blueprint** explaining how TrackFlow Mobile will evolve from local AsyncStorage to an **Offline-First SQLite Outbox + Background GPS + REST/WebSocket + Apache Kafka + Polyglot Database** backend shared seamlessly with TrackFlow Web.

---

## 2. Quick Start & Role Personas

### 2.1 Running TrackFlow Mobile
1. **Web Preview (Ideal for Meeting Demos):**
   ```bash
   cd mobile
   yarn install --frozen-lockfile
   yarn web
   ```
   Open the local URL printed by Expo Metro in a narrow/phone-sized browser window for a clean mobile walkthrough.
2. **Native iOS / Android Development:**
   ```bash
   cd mobile
   yarn start
   ```
   Launch on an iOS Simulator (`i`), Android Emulator (`a`), or physical device via Expo development build (`yarn android` / `yarn ios`). Native builds render real street tiles using `react-native-maps` and support live device GPS via `expo-location`.

### 2.2 Redesigned Login Screen (`/(auth)/login`)
The authentication screen follows a clean top-to-bottom hierarchy:
1. **Top Brand Header & Theme Toggle:** TrackFlow Mobile branding with instant Dark / Light mode toggle.
2. **Live Telemetry Hero Card:** Highlights Real GPS & Live Street Map capabilities with a pulsing live status indicator.
3. **Centered Credentials Card:** Segmented **Sign In / Create Account** switcher, email/password inputs (plus full name and role chip selector when registering), and the primary cyan **Sign In to Cockpit** button.
4. **Collapsible Bottom "1-Tap Quick Demo Accounts" Drawer:** Placed cleanly at the bottom and collapsed by default (`6 ROLES READY` badge + chevron). Tapping the header expands all six pre-seeded personas with haptic feedback:

| Persona | Role | Email | Role-Scoped Bottom Tabs & Home Dashboard |
| :--- | :--- | :--- | :--- |
| **Marcus Vance** | **Driver** *(Primary)* | `driver@demo.com` | **Home (Driver Duty Hub)**, **Drive Map**, **Trips**, **Field Logs**, **Profile** — strictly scoped to his assigned trips, assigned bookings, assigned vehicle(s), fuel/expenses/SOS (with photo upload), and personal alerts. |
| **Nadia Karim** | **Employee / User** | `user@demo.com` | **My Trips (Employee Portal)**, **Live Track** (read-only passenger view of her active ride), **Profile** — submit trip requests, watch live 4-step status, track driver live, and rate completed trips (1–5 stars). |
| **Sarah Chen** | **Dispatcher** | `dispatch@demo.com` | **Home (Dispatch Control)**, **Live Map**, **Dispatch**, **Fleet Hub**, **Profile** — 1-tap **Assign Driver** modal with shift/leave conflict checks. |
| **Farhana Rahman** | **Fleet Manager** | `manager@demo.com` | **Home (Fleet Manager Hub)**, **Live Map**, **Dispatch**, **Fleet Hub**, **Profile** — pending approvals, compliance & fuel risk signals, TCO/CPK. |
| **Kamrul Islam** | **Mechanic** | `mechanic@demo.com` | **Home (Service Bay Hub)**, **Service Bay**, **Fleet Hub**, **Profile** — inline Work Order status advancement, due services, bay release. |
| **Alex Morgan** | **Super Admin** | `demo@demo.com` | **Home (Super Admin Command)**, **Live Map**, **Dispatch**, **Fleet Hub**, **Profile** — full visibility, RBAC permissions, and audit log. |

*(Manual password for all 6 demo accounts: `demo1234`. Enable **Live Web Sync** in Profile to sync trip requests, assignments, and live trips in real time with TrackFlow Web at `http://localhost:3000/api/demo-sync`.)*

---

## 3. Complete Screen-by-Screen & Modal-by-Modal Architecture

TrackFlow Mobile uses **Expo Router** (`mobile/src/app/`) with 5 bottom navigation tabs and 7 dedicated full-screen / sheet modals:

### 3.1 Primary Tab Screens (`mobile/src/app/(tabs)/`)

| File / Route | Tab Title (Role-Adaptive) | Core Features & Strict RBAC Scope |
| :--- | :--- | :--- |
| `dashboard.tsx` | **Home** / **My Trips** *(Employee)* | Default landing screen (`unstable_settings.initialRouteName = "dashboard"`): **Role-Wise Dashboard** tailored to all 6 personas — Employee `+ Request a Trip` + 5-star rating; Driver `Assigned Trips Ready to Start` (1-tap Pre-Check) & `Finish Trip`; Admin/Dispatcher `Pending Requests` (1-tap `Assign Driver`); Mechanic inline Work Order advancement & vehicle release. |
| `index.tsx` | **Drive Map** / **Live Track** / **Live Map** | Full-screen road-aligned map (`RealFleetMap`) with Dhaka & SF regions, Simulation vs Real GPS toggle, and `DriverCockpitSheet`. Strictly scoped via `rbac-scope.ts`: Drivers see only their assigned vehicles + waiting assigned-trip banner; Employees see a clean read-only Passenger Live Ride card (or empty state before departure). |
| `trips.tsx` | **Trips** / **Dispatch** *(Dispatcher)* | Three segmented sub-views (**Active Manifest**, **Bookings**, **History**) strictly scoped per role: Drivers see only their assigned bookings & own trips; Admins assign pending requests via `/modal/assign-booking`. |
| `logs.tsx` | **Field Logs** / **Service Bay** *(Mechanic)* | Segmented sub-views dynamically filtered by role: Drivers see **Fuel**, **Expenses**, and **SOS** filtered to their assigned vehicles (Service Bay hidden); Mechanics see **Service** & **SOS**. |
| `fleet.tsx` | **Fleet Hub** *(Hidden for Driver & Employee)* | **Vehicles**, **Compliance** (`30d/15d/7d`), **Drivers**, and **CPK / TCO** analytics for Admins, Managers, Dispatchers, and Mechanics. |
| `profile.tsx` | **Profile** | Appearance (`Dark / Light / System`), City Region, Driver Safety & Shifts, **6-Role Switcher**, RBAC permission viewer, **Enable Live Web Sync** bridge toggle, Admin-only Audit Log & Reset, and Sign Out. |

### 3.2 Operational Modals (`mobile/src/app/modal/`)

| Modal Route | Triggered From | Purpose & Data Captured |
| :--- | :--- | :--- |
| `/modal/assign-booking` | Home / Dispatch Pending Request | **Admin Driver & Vehicle Assignment**: conflict-checked driver availability badges (`Available` / `Queued` / `On Leave` + Safety Score), ready vehicle selector, and dispatch notes. |
| `/modal/notifications` | Top Header Bell Icon | Strictly role-scoped alert center (**All**, **Unread**, **Critical**, **Updates**), **View on Live Map** jump, and sticky bottom **Mark All as Read** footer. |
| `/modal/checklist` | Home / Cockpit / Trips | Mandatory 5-point **Pre-Trip** (`startAssignedBooking` linked by `bookingId`) or **Post-Trip** (`endActiveTripForVehicle` auto-completing linked booking) walkaround + photo attachments. |
| `/modal/pod` | Active Trip Waypoint | **Proof of Delivery (POD)** capture: recipient name, finger-drawn **Signature Canvas**, and optional delivery photo. |
| `/modal/quick-fuel` | Field Logs / Home / Cockpit | RBAC-scoped fill-up logger (Drivers pick only assigned vehicles) with live tank-capacity warning and **+ Attach Receipt Photo** (`expo-image-picker`). |
| `/modal/quick-expense` | Field Logs / Home / Cockpit | RBAC-scoped expense logger (*Tolls*, *Parking*, *Fines*, *Allowance*, *Other*) with **+ Attach Receipt Photo**. |
| `/modal/report-incident` | Field Logs → SOS / Home / Cockpit | RBAC-scoped **Roadside SOS Reporter** with severity, location/GPS lock, third-party info, and **+ Attach Damage Photo**. |
| `/modal/vehicle-details` | Fleet Hub → Vehicles | Deep asset inspector showing specs, lifecycle controls, compliance docs, and **Track on Live Map**. |

---

## 4. Live Map & Smooth Telemetry Engineering Highlights

Recent engineering upgrades (`f096666`) transformed the mobile map into a production-grade navigation surface:
- **Street-Aligned Corridor Geometry (`mobile/src/lib/city-routes.ts`):** All seeded routes for **Dhaka Metro** (Motijheel, Gulshan, Banani, Uttara, Mirpur, Airport corridors) and **SF Bay Hub** use dense, real street-aligned lat/lng waypoints.
- **Catmull-Rom Path Smoothing (`smoothRoadCoordinates`):** Automatically interpolates curved road segments between street vertices so vehicle trajectories glide naturally around intersections and bends without jagged corners.
- **Dual-Layer Road Polyline Rendering (`real-fleet-map.tsx` & `.web.tsx`):** Draws a crisp outer dark road casing underneath a vibrant cyan (`#0891B2` / `#06B6D4`) active route path, separating covered distance from remaining distance with high visual contrast in both light and dark modes.
- **60fps Bridge Efficiency (`use-live-simulation.ts`):** Simulation frames are throttled cleanly (`48ms` JS-to-Native state update cadence) while camera follow animations throttle smoothly (`550ms` interval) with `fitToCoordinates` route framing and flat heading-rotated vehicle markers.

---

## 5. End-to-End Mobile Field Workflows

### 5.1 Driver Daily Shift Workflow
1. **Start Shift (`Drive Map`):** Open the cockpit sheet, toggle **On Duty**, verify assigned vehicle fuel and odometer, and switch between **Street Simulation** (for demos) or **Real Device GPS** (for live testing).
2. **Pre-Trip Inspection & Launch:** Tap **Start Trip (Pre-Check)** → complete the 5-point safety walkaround + attach inspection photos → confirm to begin recording trip telemetry.
3. **Navigation & Stops (`Drive Map` + `Trips`):** Follow turn-by-turn corridor prompts and speed limits. Open **Trips → Active Manifest** to add ad-hoc stops (`+ Stop`) and capture recipient sign-off via **POD Sign** (touch signature + delivery photo).
4. **In-Route Fuel, Expenses & SOS (`Field Logs`):** Log a fuel fill-up or toll receipt in under 15 seconds. If a breakdown or collision occurs, tap **SOS** to broadcast an immediate incident alert with last-known coordinates.
5. **Post-Trip Close & History:** Tap **End Trip (Post-Check)**, confirm walkaround condition, and review the recorded route in **Trips → History** using the timeline scrubber.

### 5.2 Dispatcher & Mechanic Mobile Workflows
- **Dispatcher (`Dispatch` tab):** Create new trip requests, approve or reject pending requests, launch pre-trip dispatches, and monitor all active units across Dhaka Metro or SF Bay Hub on **Live Map**.
- **Mechanic (`Service Bay` tab):** Review open work orders prioritized by urgency (`critical` → `low`), inspect spare parts and warranty details, tap **Advance Status** to progress repairs through the workshop pipeline, and tap **Mark Service Completed** on due preventive records.
- **Fleet Manager (`Fleet Hub` tab):** Register new vehicles on the spot, check 30/15/7-day compliance expiries, review driver safety scores, and compare per-vehicle CPK/TCO metrics.

---

## 6. Current Prototype Limitations & Target Production Architecture

### 6.1 How Mobile Runs Today
- **Local Persistence:** Auth (`tf-mobile-auth`), Fleet (`tf-mobile-fleet`), and Theme (`tf-mobile-theme`) persist locally via AsyncStorage (or `localStorage` on web).
- **Local Media & Simulation:** Captured photos and signatures are stored as local URIs/data URLs; `use-live-simulation.ts` runs locally on-device; foreground `expo-location` is wired, while background GPS tracking, push notifications, and offline sync queues await backend deployment.

### 6.2 How Mobile Connects to the Production Backend & Kafka Pipeline
In production, TrackFlow Mobile transitions to an **Offline-First Edge Client** connected to the exact same backend that powers TrackFlow Web:

1. **Local SQLite Write-Ahead Queue (Offline-First):** Every field action (Pre-Trip Check, POD Signature, Fuel Log, SOS Incident, GPS Coordinate Batch) writes first to an on-device **SQLite Outbox** with a client-generated `idempotency_key` (UUIDv7) and `status: pending | uploading | synced | failed`. Even in zero-signal basements or highways, drivers never lose data.
2. **Background GPS Batching (`expo-location` + `expo-task-manager`):** Collects GPS points every 5–10 seconds (or adaptive distance filter) and uploads compressed batches every 15–30 seconds to the **Telemetry Ingestion API** (`POST /v1/telemetry/batch`), which validates and immediately publishes to **Apache Kafka (`telemetry.gps.raw`)** partitioned by `tenant_id:vehicle_id`.
3. **Reconnect Storm Protection via Kafka:** When dozens of delivery vans regain 4G/5G coverage simultaneously and flush 30 minutes of queued GPS batches, Kafka absorbs the burst smoothly without overloading PostgreSQL — ensuring zero dropped points and exact chronological ordering.
4. **Resumable Direct-to-S3 Media Uploads:** Inspection photos, fuel receipts, and POD signatures request short-lived **Pre-Signed S3 Upload URLs** from the API, upload directly to private object storage (with background retry), and emit a Kafka event (`media.uploaded`) for worker validation and attachment linking.
5. **Real-Time Two-Way Sync (Web ↔ Mobile):**
   - Dispatcher approves a booking on **TrackFlow Web** → PostgreSQL ACID transaction + Outbox → Kafka (`dispatch.events`) → **Notification Worker** sends an instant **FCM/APNs Push Notification** + WebSocket event to the Driver's phone.
   - Driver completes POD or triggers **SOS** on **TrackFlow Mobile** → API commits to PostgreSQL + Kafka (`fleet.alerts`) → Dispatcher's **TrackFlow Web** live map flashes the critical SOS toast and alert bell within **< 2 seconds**.

> For the complete backend, database (PostgreSQL + PostGIS + TimescaleDB + Redis), Apache Kafka topic topology, worker design, and stakeholder persuasion deck, see **`TRACKFLOW_BACKEND_KAFKA_MEETING_PROPOSAL.md`** (and `.docx`).

---

## 7. Suggested 6-Minute Stakeholder Demo Script (Mobile)
1. **Minute 1 (`/(auth)/login` → `Drive Map`):** Show the clean credential screen, expand the bottom **1-Tap Quick Demo Accounts** drawer, tap **Marcus Vance (Driver)**, and showcase the Dhaka Metro street-aligned cyan route, smooth curve tracking, and Duty toggle.
2. **Minutes 2–3 (`Drive Map` → `checklist` → `Trips` → `pod`):** Run a **Pre-Trip Inspection**, view live telemetry & turn-by-turn guidance, add a stop, capture a finger-drawn **POD Signature**, and complete the **Post-Trip Check**.
3. **Minute 4 (`Field Logs` → `notifications`):** Log a quick fuel fill-up, broadcast a sample **Roadside SOS Incident**, open the **Notifications** bell, demonstrate filtering + **View on Live Map** + the sticky bottom **Mark All as Read** footer.
4. **Minute 5 (`Profile` Role Switch → `Service Bay`):** Switch instantly to **Mechanic**, open **Service Bay**, and advance a Work Order status.
5. **Minute 6 (`Fleet Hub`):** Switch to **Fleet Manager**, inspect Vehicle Compliance expiries and CPK/TCO cards, and transition into the **Shared Backend + Kafka Architecture Proposal** showing how Web and Mobile unify in production.
