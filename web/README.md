# TrackFlow — Vehicle Management System

A complete, local-first **Vehicle & Fleet Management System** built with **Next.js 16 (App Router + Turbopack)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui (`@base-ui/react`)**, **Zustand v5**, **Recharts**, and **Framer Motion**.

All operational data is pre-seeded and persisted in browser `localStorage`, so you can explore every workflow immediately without setting up a backend or database.

---

## Core Modules

1. **Executive Dashboard** (`/dashboard`)
   - Operations overview with KPI cards (**Total Fleet**, **Active Trips**, **Distance Covered**, **Active Alerts**).
   - **Fleet Status Distribution** segmented bar, 7-day **Fuel Spend vs. Distance Covered** area chart, and **Fleet Status Breakdown** donut chart.
   - **Live Fleet Roster** with one-click **`Track`** camera lock and a real-time **Recent Alerts Feed**.
   - Role-aware **Driver Assignment** spotlight banner when signed in as a Driver.

2. **Vehicle & Asset Registry** (`/vehicles`)
   - Full vehicle profiles: license plate, VIN/chassis number, make, model, year, fuel type, engine capacity, tank capacity, odometer, engine hours, and depreciation.
   - **Status Lifecycle**: `Available`, `On Trip`, `Under Maintenance`, `Out of Service`, `Decommissioned`, with a direct **`Live Track`** button on running vehicles.
   - **Compliance & Document Vault**: Track registration/tax tokens, fitness certificates, route permits, and insurance policies with automated expiration alerts (30 / 15 / 7 days prior).

3. **Driver & Staff Management** (`/drivers`)
   - Driver profiles with contact info, license class & expiry alerts, and assigned vehicle history.
   - **Performance & Safety Scoring**: Tracks harsh braking, speeding incidents, idle time, and on-time completion rates.
   - **Shift & Leave Scheduling**: Prevents double-booking against active trip dispatches.

4. **Live GPS Tracking & Geofencing** (`/trips`)
   - **Interactive Dark Vector City Map**: Drag-to-pan, scroll & button zoom (`75%–220%`), Reset View, Follow Camera Lock, Play/Pause, and speed multiplier (`1x / 2x / 4x`).
   - **Multi-Vehicle Live Tracking**: Rotating directional vehicle markers, pulsing sonar rings, glowing covered trails, animated dashed remaining paths, and floating plate/speed badges.
   - **Geofencing & Zone Alerts**: Toggleable zones (*Central Logistics Hub*, *North Industrial Park*, *Airport Cargo Zone*, *Harbor Port Terminal*) with live entry banners and notifications.
   - **Live Telemetry Inspector**: Semicircular speed gauge, compass heading (`deg + cardinal`), live coordinates, odometer, fuel bar, route progress, and Start/End Active Trip controls.
   - **Trip Dispatch & History**: Booking & approval workflow, Pre-Trip / Post-Trip inspection checklists, Proof of Delivery (POD) signatures & photos, OBD-II diagnostics strip, and historical **Route Playback**.

5. **Fuel & Operating Expenses** (`/fuel`)
   - Fuel fill-up logs with receipt photo upload, automatic `km/L` calculation, and **efficiency / tank-capacity anomaly detection**.
   - Operating expenses (tolls, parking, fines, driver allowances) linked to vehicles, trips, and cost centers.

6. **Preventive & Corrective Maintenance** (`/maintenance`)
   - Scheduled service rules triggered by odometer intervals, engine hours, or calendar dates.
   - Repair **Work Orders** with vendor details, spare parts, labor cost, warranty tracking, and downtime hours.
   - **Incident & Accident Reporting** with severity, location, third-party details, and photo uploads.

7. **Analytics, Reporting & Administration** (`/reports`, `/settings`)
   - **Cost-per-Kilometer (CPK) & Total Cost of Ownership (TCO)** combining fuel, maintenance, insurance, and depreciation.
   - **Utilization Reports** with date-range filtering, peak-hour charts, and CSV export.
   - **Role-Based Access Control (RBAC)** across 5 roles backed by a full **Audit Log**, plus JSON Backup/Restore and one-click Demo Data Reset.

---

## Multi-Account Demo Credentials

All 5 pre-seeded accounts are available via **1-click Quick Demo Accounts** on `/login` or via the **Quick Demo Role Switcher** in the top-right header:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Super Admin** | Alex Morgan | `demo@demo.com` | `demo1234` |
| **Fleet Manager** | Farhana Rahman | `manager@demo.com` | `demo1234` |
| **Dispatcher** | Sarah Chen | `dispatch@demo.com` | `demo1234` |
| **Mechanic** | Kamrul Islam | `mechanic@demo.com` | `demo1234` |
| **Driver** | Marcus Vance | `driver@demo.com` | `demo1234` |

You can also register new accounts with any role from the **Register** tab on `/login`.

---

## Getting Started

### Prerequisites
- **Node.js** 20+
- **Yarn** (or npm/pnpm)

### Install & Run Locally

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

```bash
yarn dev                          # Start development server (Turbopack)
yarn build                        # Create optimized production build
yarn start                        # Run production server
./node_modules/.bin/tsc --noEmit  # Run strict TypeScript type check
./node_modules/.bin/eslint .      # Run ESLint
./node_modules/.bin/vitest run    # Run Vitest unit tests
```

---

## Project Structure

```text
web/
├── app/
│   ├── (auth)/login/          # Split-screen login, 1-click demo accounts & registration
│   ├── (app)/
│   │   ├── dashboard/         # Executive Dashboard (KPIs, charts, live roster, alerts)
│   │   ├── vehicles/          # Vehicle & Asset Registry + Compliance Vault
│   │   ├── trips/             # Live Vector Map, Telemetry Inspector, History, Bookings, Geofences
│   │   ├── drivers/           # Driver Profiles, Safety Scores, Shifts & Leave
│   │   ├── fuel/              # Fuel Logs, Efficiency Anomalies & Operating Expenses
│   │   ├── maintenance/       # Service Rules, Work Orders & Incident Reports
│   │   ├── reports/           # CPK / TCO Analytics, Utilization & CSV Export
│   │   └── settings/          # RBAC Permissions, Audit Log, Backup/Restore & Reset
│   ├── globals.css            # Tailwind v4 theme tokens & telemetry animations
│   └── layout.tsx             # Root layout & Google Fonts
├── components/
│   ├── layout/                # Collapsible Sidebar & Sticky Topbar (Alerts, Theme, Role Switcher)
│   ├── dashboard/             # FleetCharts & LiveFleetRoster
│   ├── trips/                 # LiveVectorMap, SpeedGauge, TelemetryInspector, Bookings, Geofences
│   ├── vehicles/              # VehicleCard (with Live Track) & VehicleDetailsDialog
│   ├── drivers/               # DriverScheduleDialog
│   ├── fuel/                  # FuelLogsTab & OperatingExpensesTab
│   ├── maintenance/           # ServiceRulesTab, WorkOrdersTab & IncidentsTab
│   ├── reports/               # TcoAnalyticsTab & UtilizationTab
│   ├── settings/              # RbacTab & AuditLogTab
│   └── ui/                    # Reusable shadcn/ui primitives
├── lib/                       # City routes, geo simulation, seed data, RBAC, analytics, formatters
├── store/                     # Zustand stores: auth-store ('tf-auth'), fleet-store ('tf-fleet')
└── types/                     # Strict domain TypeScript interfaces
```

---

## Notes & Limitations

- All data is persisted locally in your browser's `localStorage` (`tf-auth`, `tf-fleet`, `tf-theme`) and is not synced across devices.
- To restore the initial pre-seeded fleet dataset at any time, go to **Settings → Reset Demo Data**.
