# TrackFlow Web

Frontend-only vehicle fleet management and live GPS trip tracking demo built with **Next.js 16 (App Router + Turbopack)**, **React 19**, **TypeScript (strict)**, **Tailwind CSS v4**, **shadcn/ui**, **Zustand**, and **Framer Motion**.

No backend, no database, no API routes — all state is persisted locally in the browser using `localStorage`.

## Features

- **Demo Authentication & Route Guard**: Client-side Sign in / Register with SubtleCrypto SHA-256 password hashing and a one-click Demo Admin login.
- **Light & Dark Mode**: Dark-first navy/cyan/amber telemetry palette with a high-contrast light theme, flicker-free load, and theme toggles on login, navigation, and settings.
- **Dashboard**: First-render count-up KPIs (vehicles, completed trips, distance driven, live trip status), active trip banner, maintenance alerts, and recent trips.
- **Vehicles**: Full CRUD with search, custom vehicle illustrations, active-trip delete protection, and per-vehicle Fuel & Maintenance tabs.
- **Trips & Live GPS Navigator**:
  - Interactive real-time cartographic SVG `RouteMap` with Dhaka corridor roads, water bodies, waypoints, directional rotating vehicle chevron, zoom/follow HUD controls, and turn-by-turn maneuver guidance.
  - Built-in Dhaka route GPS simulator (1 point/sec, resumable, auto-completes at route end) plus real browser `navigator.geolocation.watchPosition` with Screen Wake Lock support.
  - Enforces single active trip, 3 m noise filtering, 160 km/h speed cap, and automatic vehicle odometer updates on trip completion.
- **Fuel Logs**: Track fill-ups, calculate `km/L` across consecutive full-tank logs (including intermediate partial fills), and plot efficiency sparklines.
- **Maintenance**: Schedule services by date and/or odometer with automatic Overdue / Due soon (14 days or 500 km) / Upcoming alerts and a follow-up prompt to schedule the next service on completion.
- **Drivers**: Driver CRUD, license expiry badges (expired / within 30 days / valid), optional driver assignment when starting trips, and per-driver trip totals.
- **Reports**: Date-range and vehicle filters, summary KPIs, shadcn/Recharts distance-per-day bar chart, and filtered CSV export.
- **Settings**: Export JSON backup, schema-validated JSON import (supports v1 & v2 backups), and one-click demo data reset.

## Getting Started

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Credentials

- **Email**: `demo@demo.com`
- **Password**: `demo1234`

## Scripts

```bash
yarn dev           # Start development server (Turbopack)
yarn lint          # Run ESLint
yarn tsc --noEmit  # Run strict TypeScript type check
yarn test          # Run Vitest unit tests
yarn build         # Create production build
```

## Folder Structure

```text
web/
├── app/
│   ├── (auth)/login/         # Split-screen login & registration
│   ├── (app)/
│   │   ├── dashboard/        # KPI overview, live banner, alerts, recent trips
│   │   ├── vehicles/         # Fleet cards, CRUD dialogs, per-vehicle tabs
│   │   ├── trips/            # Real-time GPS Navigator, RouteMap, trip history
│   │   ├── drivers/          # Driver roster, license expiry, trip totals
│   │   ├── fuel/             # Fuel logs, km/L calculation, trend sparkline
│   │   ├── maintenance/      # Service schedule, alerts, complete & reschedule
│   │   ├── reports/          # Filters, distance-per-day chart, CSV export
│   │   └── settings/         # Theme, JSON export/import, reset demo data
│   ├── error.tsx             # Route error boundary
│   ├── not-found.tsx         # 404 page
│   ├── globals.css           # Tailwind v4 cyan theme tokens (dark & light)
│   └── layout.tsx            # Fonts (Plus Jakarta Sans, Space Grotesk, JetBrains Mono)
├── components/               # AppShell, AuthGuard, RouteMap, BrandLogo, ui/
├── hooks/                    # useHydrated, useTripTracker
├── lib/                      # geo, format, hash, fuel, maintenance, drivers, csv
├── store/                    # useAuthStore ('tf-auth'), useFleetStore ('tf-fleet' v2)
└── types/                    # Domain TypeScript interfaces
```

## Known Limits

- Data is stored per browser in `localStorage` (`tf-auth`, `tf-fleet`, `tf-theme`) and is not synced across devices.
- Real browser Geolocation requires **HTTPS** or **localhost** and granted location permission; use **Simulate GPS** for demos on desktop or insecure origins.
- Demo authentication is for frontend demonstration only and should not be used for production security.
