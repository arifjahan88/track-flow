# TrackFlow Mobile — Driver Cockpit & Fleet Command App

A complete, local-first **Vehicle & Fleet Management Mobile Application** built with **Expo SDK 58**, **React Native 0.88**, **Expo Router**, **TypeScript**, **React Native Reanimated v4**, **React Native Gesture Handler**, **Zustand v5**, **`@react-native-async-storage/async-storage`**, **`react-native-maps`**, and **`expo-location`**.

Designed as the mobile companion to `/web`, TrackFlow Mobile delivers an **Uber Driver / Pathao Drive-inspired Real Street Map Cockpit** for drivers alongside full multi-role support for **Dispatchers**, **Fleet Managers**, **Mechanics**, and **Super Admins**.

---

## Key Features

1. **Uber / Pathao Real Street Map Cockpit (`/(tabs)`)**
   - **Native Street Map (`react-native-maps`)** with dynamic **Night Cockpit Dark** and **Daylight High-Contrast Light** custom map styles (plus a Web SVG/Tile fallback in `real-fleet-map.web.tsx`).
   - **Real Street Coordinate Corridors** in **Dhaka Metro** (*Gulshan-2, Pragati Sarani, Hatirjheel Viaduct, Tejgaon Industrial Park, Mohakhali, Airport/Kuril, Motijheel*) and **San Francisco Bay Area**—switchable in 1 tap.
   - **Real Device GPS (`expo-location`) + 60fps Live Route Simulation (`1x / 2x / 4x`)** with rotating directional vehicle markers, covered vs. remaining dashed route polylines, delivery waypoint pins, and active geofence zones.
   - **Top Turn-by-Turn Navigation Banner** with maneuver direction, distance in meters, street/district name, and speed-limit warning badge.
   - **Circular SVG Speedometer & Compass HUD** + **Spring-Gesture Driver Cockpit Bottom Sheet** (`Gesture.Pan()` + `withSpring`) with On-Duty toggle, OBD-II live diagnostics strip (`Ignition`, `14.1V`, `Fuel %`, `Coolant 88°C`, `0 DTC`), and 1-tap field log shortcuts.

2. **End-to-End Driver Trip Lifecycle (`/(tabs)/trips` & `/modal/*`)**
   - **Pre-Trip & Post-Trip 5-Point Walkaround Inspection Sheet** (`/modal/checklist`) with photo attachments (`expo-image-picker`).
   - **Proof of Delivery (POD) Digital Finger Signature Pad** (`/modal/pod`) using interactive `react-native-svg` touch drawing + recipient name & photo capture.
   - **Trip Bookings & Dispatch Approval Workflow** with automatic driver shift & leave conflict detection.
   - **Historical Trip Replay Scrubber** to inspect completed trip coordinates and telemetry.

3. **Field Logs, Service Bay & Roadside SOS (`/(tabs)/logs`)**
   - **Fuel Fill-Up Logger** (`/modal/quick-fuel`) with automatic full-to-full `km/L` calculation and **tank over-capacity / efficiency drop anomaly detection**.
   - **Operating Expenses Logger** (`/modal/quick-expense`) for Tolls, Parking, Fines, and Driver Allowances.
   - **Mechanic Service Bay Work Orders & Preventive Maintenance Rules** with spare parts & labor cost calculation and status transitions (`open → in_progress → waiting_parts → completed`).
   - **Roadside SOS Incident Reporter** (`/modal/report-incident`) with auto-filled GPS coordinates and instant fleet alert broadcast.

4. **Fleet Hub, Compliance Vault & CPK/TCO Analytics (`/(tabs)/fleet`)**
   - **Vehicle Registry & Lifecycle Control** (`available`, `on_trip`, `under_maintenance`, `out_of_service`, `decommissioned`).
   - **Compliance Document Vault** with `Expired / 7d / 15d / 30d` countdown alerts.
   - **Driver Roster & Safety Leaderboard** (`0–100` score, grade badge, harsh braking, speeding, idle time, on-time rate).
   - **Cost-per-Kilometer (CPK) & Total Cost of Ownership (TCO)** analytics.

5. **Light & Dark Theme Engine + 5-Role RBAC (`/(tabs)/profile`)**
   - Instant toggle between **Night Cockpit Dark**, **Daylight Driving Light**, and **System Auto**, persisted in `AsyncStorage` (`tf-mobile-theme`).
   - **1-Tap Quick Demo Role Switcher** across all 5 roles persisted in `AsyncStorage` (`tf-mobile-auth` & `tf-mobile-fleet`).

---

## Pre-Seeded Demo Accounts (1-Tap Launch)

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Driver (Primary Mobile Persona)** | Marcus Vance | `driver@demo.com` | `demo1234` |
| **Dispatcher** | Sarah Chen | `dispatch@demo.com` | `demo1234` |
| **Fleet Manager** | Farhana Rahman | `manager@demo.com` | `demo1234` |
| **Mechanic** | Kamrul Islam | `mechanic@demo.com` | `demo1234` |
| **Super Admin** | Alex Morgan | `demo@demo.com` | `demo1234` |

---

## Getting Started

```bash
cd /Users/arif/Development/track-flow/mobile
yarn install
yarn start
```

- Press **`i`** to open in iOS Simulator, **`a`** for Android Emulator, **`w`** for Web, or scan the QR code with **Expo Go**.

### Verification Commands

```bash
./node_modules/.bin/tsc --noEmit   # Strict TypeScript type check
npx expo lint                      # Run Expo ESLint
```
