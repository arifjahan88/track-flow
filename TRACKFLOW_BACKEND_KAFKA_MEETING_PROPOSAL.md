# TrackFlow — Backend, Database, Apache Kafka & Worker Architecture Proposal

**Executive & Engineering Meeting Presentation Deck · System Blueprint, Codebase Audit, Technology Justification & Rollout Plan**  
**Prepared:** 27 November 2026 · **Target Platforms:** TrackFlow Web (Next.js 16) + TrackFlow Mobile (Expo React Native) + Future OBD-II / GPS Hardware Trackers

---

## 1. Executive Pitch (The 60-Second Case for the Meeting)

TrackFlow already has a feature-complete, high-craft **Web Operations Console** (9 routes, 6 Role-Wise Dashboards, strict route & record-level RBAC across 15 permissions, live POD signatures, printable PDF trip manifests, and a live local Web↔Mobile sync bridge) and **Mobile Driver & Employee App** (6-role Home Dashboard, role-scoped bottom tabs, 8 field modals with photo evidence, road-aligned live maps, POD signatures, and post-trip 5-star ratings). Both applications share a unified TypeScript domain model covering **15+ fleet entities** and a closed-loop **Employee Request → Admin Assign Driver → Driver Start (Pre-Check) → POD → Finish (Post-Check) → Rate** state machine.

To take TrackFlow from an interactive single-device prototype to a reliable, multi-tenant, real-time commercial fleet platform, **the backend architecture is our single most critical engineering decision**. Fleet management is **not** a standard CRUD web app — it is a **hybrid workload** combining:
1. **Strict ACID Business Transactions** (dispatch locking so two dispatchers never assign the same vehicle/driver, compliance governance, financial TCO, RBAC, immutable audit trails), AND
2. **High-Velocity Real-Time IoT / GPS Event Streams** (continuous vehicle location pings, geofence polygon intersections, fuel anomaly detection, driver safety scoring, live map broadcasting, and mobile offline reconnect bursts).

### Our Recommended Architecture Decision
> **Modular TypeScript API (NestJS / Fastify) + Unified PostgreSQL 16 Ecosystem (PostGIS + TimescaleDB) + Redis + S3 Object Storage + Apache Kafka (Redpanda / Managed Kafka) + 6 Specialized Worker Pools.**

**Why this stack wins:**
- **Zero Single-Database Bottlenecks:** Kafka absorbs massive GPS bursts and decouples heavy geospatial/analytics computation from API response times (< 150 ms p95).
- **Guaranteed Chronological Ordering per Vehicle:** Partitioning Kafka topics by `tenant_id:vehicle_id` guarantees GPS coordinates, geofence crossings, and odometer increments are processed in exact order — impossible with basic job queues under scale.
- **Write Once, Fan Out to Many:** One GPS batch simultaneously feeds live map updates, geofence alerts, TimescaleDB archival, odometer/trip stitching, and driver safety scoring independently.
- **Lean Pilot Cost, Zero Rewrite at Scale:** Running **Redpanda** (Kafka-wire-compatible single binary, no ZooKeeper/JVM) or **Managed Serverless Kafka** costs **~$30–$60/month** during pilot while scaling effortlessly to **50,000+ vehicles** with the exact same codebase.

---

## 2. Codebase Analysis: Complete System Flow & Page-by-Page Functional Map

Before designing the backend, we audited every route, screen, store action, and TypeScript model across `web/` and `mobile/`.

### 2.1 TrackFlow Web — Complete Page & Functional Ownership Map (`web/app/`)

| # | Web Route | Page Name | What Work It Performs (Frontend Today) | Backend Services & Tables Required |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `/login` | **Authentication & Onboarding** | Split-screen sign-in, account registration with role selection, 1-click demo persona launchers, theme toggle. | Auth Service (JWT + Refresh Tokens, HttpOnly cookies, SSO/MFA), `tenants`, `users`, `sessions`. |
| 2 | `/dashboard` | **Executive Dashboard** | Fleet KPIs (Total Fleet, Active Trips, Distance Covered, Unread/Critical Alerts), segmented status distribution bar, 7-day fuel spend & distance charts, Live Fleet Roster with 1-click **Track**, Driver Assignment Spotlight, Recent Alerts feed. | Read-optimized Dashboard API + Redis live fleet summary + TimescaleDB continuous aggregates + WebSocket alert stream. |
| 3 | `/trips` | **Live GPS Tracking & Dispatch Command** | Interactive Live Vector Map, pan/zoom/camera lock, multi-corridor simulation (`1×/2×/4×`), live OBD-II diagnostics strip, Telemetry Inspector (speed gauge, heading, fuel, start/end trip), **Bookings** tab (request, availability conflict check, approve/reject, dispatch with Pre-Trip Checklist), **Trip History** tab (interactive Route Playback scrubber), **Geofences** tab (zone toggles & custom polygon creator), and **POD Signature** capture. | Telemetry Ingestion API, WebSocket/SSE Gateway (Redis Pub/Sub), Transactional Dispatch API (`SELECT FOR UPDATE` lock), PostGIS Geofence API, TimescaleDB Route Playback API, Kafka (`telemetry.gps.raw`, `trips.lifecycle`, `geofence.events`). |
| 4 | `/vehicles` | **Vehicle & Asset Registry** | Add/edit/delete vehicles (VIN, plate, make, model, year, fuel type, tank capacity, odometer, engine hours, purchase cost, depreciation), lifecycle state transitions, **Compliance Vault** (Registration, Fitness, Route Permit, Insurance) with automated **30 / 15 / 7-day & Expired** alert banner. | Asset Service (`vehicles`, `compliance_documents`), S3 pre-signed URLs for document scans, Scheduled Compliance Worker (Kafka `compliance.reminders`). |
| 5 | `/drivers` | **Driver & Staff Management** | Driver roster, license class & expiry status, real-time availability check, automated **0–100 Safety Score** (harsh braking, speeding, idle minutes, on-time %), lifetime trip stats, **Shifts & History Dialog** (weekday shifts, leave date ranges, vehicle assignment history). | Driver HR Service (`drivers`, `driver_shifts`, `driver_leaves`, `vehicle_assignments`), Trip Safety Scoring Worker. |
| 6 | `/fuel` | **Fuel & Operating Expenses** | Fuel fill-up ledger (litres, price/L, odometer, station, full-tank, receipt preview), `km/L ↔ MPG` toggle, **Fuel Anomaly Detection Banner** (>25% efficiency drop or fill volume > tank capacity), trend sparkline, **Expenses** tab (Tolls, Parking, Fines, Allowances, cost centers, receipts). | Cost Control Service (`fuel_logs`, `operating_expenses`), S3 receipt upload/scan, Anomaly Detection Worker (Kafka `fuel.logged` → `fleet.alerts`). |
| 7 | `/maintenance` | **Maintenance, Work Orders & Incidents** | 4 health KPIs (Overdue, Due Soon 14d/500km/25h, Active Work Orders, Open Incidents), **Services** tab (preventive rules by date/km/engine hours), **Work Orders** tab (priority, vendor, itemized spare parts, labor, warranty, downtime, status pipeline), **Incidents** tab (severity, third-party insurance, damage photos, resolution workflow). | Maintenance Service (`maintenance_records`, `work_orders`, `work_order_parts`, `incident_reports`), Scheduled Maintenance Scanner Worker, SOS Alert Escalation Worker. |
| 8 | `/reports` | **Analytics, Reports & TCO** | **Trip Reports** tab (search, vehicle, driver, preset date-range filter, daily distance BarChart, paginated table, CSV export), **CPK & TCO** tab (fuel + maintenance + work orders + expenses + compliance + depreciation ÷ km), **Utilization** tab (30-day per-vehicle activity & peak-hour demand). | Analytics Read Service querying TimescaleDB continuous aggregates + Materialized TCO Views + Async Export Worker (Kafka `exports.requested` → S3 CSV/PDF). |
| 9 | `/settings` | **Settings, RBAC & Audit** | **RBAC & Roles** tab (14-permission matrix across 5 roles + Super Admin role assignment), **Audit Log** tab (searchable history across 13 entity types), **General & Data** tab (dark/light mode, JSON backup/import/reset). | IAM/RBAC Middleware (server-side enforcement on every API & WS channel), Immutable Append-Only `audit_logs` table populated via Kafka `audit.events`. |

### 2.2 TrackFlow Mobile — Complete Screen & Modal Map (`mobile/src/app/`)

| Screen / Modal | Role-Adaptive Label | Primary Field Responsibility | Production Sync Mechanism |
| :--- | :--- | :--- | :--- |
| `/(auth)/login` | Sign In / Register | Centered credentials card + collapsible bottom **1-Tap Quick Demo** drawer + Dark/Light toggle. | OAuth2/JWT stored in OS Keychain / Keystore (`expo-secure-store`). |
| `/(tabs)/index` | **Drive Map** / **Live Map** | Full-screen street-aligned cyan map (`smoothRoadCoordinates`, dual-layer road casing), Dhaka & SF regions, Simulation vs Real GPS toggle, Speed/Compass HUD, expandable Driver Cockpit Sheet, Turn-by-Turn banner, OBD-II strip, Duty toggle. | Background GPS batch uploader → `POST /v1/telemetry/batch` → Kafka; live peer fleet via WebSocket. |
| `/(tabs)/trips` | **Trips** / **Dispatch** | Active Manifest (`+ Stop`, Pause/Resume, `POD Sign`, `End Trip`), Bookings (`+ Request Trip`, Approve/Reject, Launch Dispatch), History route scrubber. | Offline-first SQLite mutation queue + Push notifications on booking approval. |
| `/(tabs)/logs` | **Field Logs** / **Service Bay** | Fuel logs + anomaly tags, Expenses, Mechanic Work Order status advancement & Preventive Service completion, SOS incident list. | Offline SQLite outbox with idempotency keys + direct S3 photo uploads. |
| `/(tabs)/fleet` | **Fleet Hub** | Quick vehicle registration, compliance expiry bands, driver metrics, CPK/TCO summary. | Paginated REST API with TanStack Query caching. |
| `/(tabs)/profile` | **Profile** | Theme, region, safety scorecard, shift & leave request (`Log Leave`), role switcher, RBAC viewer, audit stream. | User profile API + device push token registration (FCM / APNs). |
| `/modal/notifications` | Notifications Center | Filterable alerts (`All`, `Unread`, `Critical`, `Updates`), **View on Live Map** jump, sticky bottom **Mark All as Read**. | Real-time Push (FCM/APNs) + WebSocket sync + `PATCH /v1/alerts/read-all`. |
| 6 Action Modals | `checklist`, `pod`, `quick-fuel`, `quick-expense`, `report-incident`, `vehicle-details` | High-speed thumb-friendly forms for pre/post walkarounds, finger-drawn POD signatures, fill-ups, tolls, roadside SOS, and asset inspection. | Atomic REST mutations + Pre-signed S3 evidence uploads + Kafka events. |

### 2.3 End-to-End Business Workflow (How Web & Mobile Work Together)

```text
[1. REQUEST & PLAN]          [2. DISPATCH & INSPECT]       [3. LIVE OPERATIONS]          [4. CLOSE & ANALYZE]
Web (/trips -> Bookings)     Mobile (/modal/checklist)     Mobile (Drive Map + GPS)      Mobile (POD + Post-Check)
  │                            │                             │                             │
  ├─ Staff requests vehicle    ├─ Driver gets Push alert     ├─ Batched GPS every 5-10s    ├─ Recipient signs POD
  ├─ Check shift/leave/trip    ├─ Completes 5-pt walkaround  ├─ Kafka streams telemetry    ├─ Uploads S3 photo proof
  ├─ Dispatcher approves       ├─ Uploads damage photos (S3) ├─ PostGIS checks geofences   ├─ Post-trip closes trip
  └─ ACID Lock reserves unit   └─ Trip starts -> status:     ├─ Web /trips updates <1.5s   ├─ Odometer & Safety Score
                                  ON_TRIP across all devices └─ Fuel/SOS logged live       └─ /reports updates TCO/CPK
```

---

## 3. Target System Architecture Overview

```text
                        ┌──────────────────────┐       ┌──────────────────────────┐
                        │  TrackFlow Web       │       │  TrackFlow Mobile        │
                        │  (Next.js 16 App)    │       │  (Expo iOS / Android)    │
                        │  REST + WebSockets   │       │  SQLite Outbox + BG GPS  │
                        └──────────┬───────────┘       └────────────┬─────────────┘
                                   │ HTTPS / WSS                    │ HTTPS / WSS (+ Future TCP/UDP OBD-II)
                                   ▼                                ▼
                    ┌────────────────────────────────────────────────────────────────┐
                    │            Edge Load Balancer + API & Realtime Gateway         │
                    │  • JWT Auth & Tenant Context   • Rate Limiting (Redis)         │
                    │  • REST/OpenAPI v1 (NestJS)    • WebSocket/SSE Fan-Out Hub     │
                    └───────┬──────────────────┬────────────────────────┬────────────┘
                            │                  │                        │
                 Transactional CRUD      Hot Live Cache           Direct Media Upload
                            │                  │                        │
                            ▼                  ▼                        ▼
              ┌──────────────────────┐  ┌─────────────┐       ┌───────────────────┐
              │ PostgreSQL 16 Core   │  │ Redis 7     │       │ Private S3 / R2   │
              │ • ACID Fleet Tables  │  │ • Live Pos  │       │ • POD Signatures  │
              │ • PostGIS Polygons   │  │ • GeoHash   │       │ • Damage Photos   │
              │ • TimescaleDB Hypert │  │ • WS PubSub │       │ • Fuel Receipts   │
              │ • Outbox Event Table │  │ • Idempot.  │       │ • CSV/PDF Exports │
              └──────────┬───────────┘  └──────▲──────┘       └─────────▲─────────┘
                         │                     │                        │
            Debezium CDC / Outbox Relay        │ (Hot State Update      │ (Scan & Link)
            + Telemetry Ingestion Push         │  & Live Broadcast)     │
                         ▼                     │                        │
        ╔════════════════════════════════════════════════════════════════════════════╗
        ║                 APACHE KAFKA (or Redpanda Kafka-API Cluster)               ║
        ║           Durable, Ordered, Replayable Event Streaming Backbone            ║
        ║                 Partition Key: `${tenant_id}:${vehicle_id}`                ║
        ╠════════════════════════════════════════════════════════════════════════════╣
        ║ telemetry.gps.raw │ trips.lifecycle │ geofence.events │ fleet.alerts │ ... ║
        ╚═══════╤══════════════════╤══════════════════╤══════════════════╤═══════════╝
                │                  │                  │                  │
     ┌──────────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────┐  ┌────▼─────────────┐
     │ Worker Group 1  │  │ Worker Group 2  │  │ Worker Group 3  │  │ Worker Group 4-6 │
     │ Telemetry Writer│  │ Geofence & Safe │  │ Trip Stitcher & │  │ • Fuel Anomaly & │
     │ • Deduplicate   │  │ • PostGIS Check │  │   Safety Scorer │  │   Compliance Cron│
     │ • Batch INSERT  │  │ • Speed/Harsh   │  │ • Distance/Odo  │  │ • Notification   │
     │   TimescaleDB   │  │   Braking/Idle  │  │ • Driver Score  │  │   (FCM/SMS/Email)│
     │ • Update Redis  │  │ • Emit Alerts   │  │ • TCO Rollups   │  │ • Media/CSV Jobs │
     └─────────────────┘  └─────────────────┘  └─────────────────┘  └──────────────────┘
```

---

## 4. Database Architecture: Why Unified Polyglot Persistence Is Best

A common mistake in fleet projects is dumping GPS breadcrumbs into standard MySQL/MongoDB tables or splitting everything across 4 unrelated databases that teams cannot maintain. Our design uses **PostgreSQL 16 as a unified data powerhouse** (with two battle-tested extensions) plus **Redis** and **S3**:

| Data Store | Role in TrackFlow | Why It Is the Best Choice |
| :--- | :--- | :--- |
| **PostgreSQL 16 (Core Relational)** | System of Record for tenants, users, RBAC, vehicles, compliance, drivers, shifts, bookings, trips, inspections, POD, fuel, expenses, maintenance, work orders, incidents, audit logs, and outbox events. | Rock-solid ACID transactions with row-level locks (`SELECT ... FOR UPDATE`) guarantee **zero double-dispatch race conditions**. Supports strict multi-tenant Row-Level Security (RLS), `NUMERIC(12,2)` precision for money/TCO, and foreign-key integrity. |
| **PostGIS (PostgreSQL Extension)** | Geospatial engine for `geofence_zones` polygons, route corridors, nearest-vehicle dispatch, and spatial queries. | Native `ST_Covers`, `ST_DWithin`, and GiST spatial indexes evaluate thousands of geofence polygons in **< 2 ms** directly inside Postgres without operating a separate spatial database. |
| **TimescaleDB (PostgreSQL Extension)** | Time-series engine for `gps_telemetry_points` and `obd_readings` hypertables. | Automatically partitions telemetry by time chunks, compresses historical GPS data by **90%+** (saving massive cloud storage cost), runs **Continuous Aggregates** so `/reports` loads in milliseconds, and enforces automatic data retention (e.g., raw pings 1 year, daily rollups 5 years). |
| **Redis 7** | Real-time hot state (`vehicle:last_pos`), geospatial index (`GEOADD`), WebSocket Pub/Sub fan-out across API replicas, API rate limiting, and idempotency keys. | Keeps live map reads at **< 1 ms** without hitting PostgreSQL on every dashboard refresh. Reconstructable from PostgreSQL if evicted. |
| **Object Storage (AWS S3 / Cloudflare R2 / MinIO)** | Private storage for POD signatures, pre/post damage photos, fuel/expense receipts, compliance PDFs, and async report exports. | Removes bloated base64 images from database rows. Uses short-lived **Pre-Signed URLs** so mobile uploads directly to object storage without choking API servers. |

### 4.1 Core Database Schema Blueprint (Mapped Directly to `types/index.ts`)

| Domain | Core Tables | Key Columns & Constraints |
| :--- | :--- | :--- |
| **Identity & Multi-Tenancy** | `tenants`, `users`, `tenant_memberships`, `refresh_tokens` | `tenant_id` on every business table; unique `(tenant_id, email)`; `role` enum (`super_admin`, `fleet_manager`, `dispatcher`, `mechanic`, `driver`); bcrypt/Argon2 password hash or SSO subject ID. |
| **Assets & Compliance** | `vehicles`, `compliance_documents` | Unique `(tenant_id, plate)` & `(tenant_id, vin)`; `status` enum; `odometer_km NUMERIC(12,2)`; `tank_capacity_liters`; `purchase_cost`, `monthly_depreciation`; `compliance_documents` indexed on `(tenant_id, expiry_date)` for 30/15/7d scans. |
| **Drivers & Scheduling** | `drivers`, `driver_shifts`, `driver_leaves`, `vehicle_assignments` | `license_number`, `license_expiry`; exclusion/overlap checks on `driver_leaves (from_date, to_date)`; historical assignment ledger `(vehicle_id, driver_id, assigned_at, unassigned_at)`. |
| **Dispatch & Trips** | `trip_bookings`, `trips`, `trip_checklists`, `trip_waypoints` | Partial unique index ensuring **at most one active trip per vehicle** (`WHERE status IN ('active','paused')`); `trips` links `booking_id`, `vehicle_id`, `driver_id`; `trip_waypoints` stores `pod_signature_s3_key`, `pod_photo_s3_key`, `arrived_at`. |
| **Telemetry & Geofences** | `gps_telemetry_points` *(TimescaleDB Hypertable)*, `obd_readings` *(Hypertable)*, `geofence_zones` *(PostGIS `GEOMETRY(Polygon, 4326)`)*, `geofence_alerts` | Hypertable partitioned by `recorded_at` + `vehicle_id`; composite deduplication key `(tenant_id, device_id, event_id)`; GiST index on `geofence_zones.geom`; `after_hours_only`, `allowed_start_hour`, `allowed_end_hour`. |
| **Costs & Maintenance** | `fuel_logs`, `operating_expenses`, `maintenance_records`, `work_orders`, `work_order_parts`, `incident_reports` | Decimal currency `(amount NUMERIC(12,2), currency CHAR(3))`; `fuel_logs` tracks `anomaly_flags JSONB`; `work_orders` links itemized `work_order_parts` and `downtime_hours`; `incident_reports` stores `severity`, third-party fields, and S3 photo keys. |
| **Events, Alerts & Governance** | `fleet_alerts`, `notification_deliveries`, `audit_logs`, `outbox_events`, `idempotency_keys` | `audit_logs` is append-only (no UPDATE/DELETE grants); `outbox_events` guarantees transactional Kafka publishing; `idempotency_keys` prevents duplicate mobile retries. |

---

## 5. Why Apache Kafka + Specialized Workers Is the BEST Choice (Convincing the Team)

This is the centerpiece decision for the architecture meeting. Teams often debate: *"Can't we just write GPS pings straight to Postgres, or use BullMQ/RabbitMQ?"* Below is the objective engineering comparison and the 5 decisive reasons why **Apache Kafka + Worker Consumer Groups** wins hands-down for TrackFlow.

### 5.1 Head-to-Head Comparison Matrix

| Evaluation Criteria | Direct HTTP → PostgreSQL | Redis + BullMQ (Job Queue) | RabbitMQ (Message Broker) | **Apache Kafka / Redpanda (Recommended)** |
| :--- | :---: | :---: | :---: | :---: |
| **Sustained GPS Ingestion (10k+ vehicles)** | Fails (DB connection & IOPS exhaustion) | Struggles (RAM-bound; expensive persistence) | Moderate (queue depth slows down RAM/disk) | **Effortless (100k–1M+ msg/sec sequential disk I/O)** |
| **Strict Per-Vehicle Chronological Ordering** | Fragile under concurrent requests | Not guaranteed across worker concurrency | Broken when multiple workers consume a queue | **Guaranteed natively via Partition Key (`tenant_id:vehicle_id`)** |
| **Mobile Reconnect Storm Protection** | Crashes API & DB locks | Memory spikes / OOM risk | Broker backpressure stalls producers | **Acts as durable shock absorber; workers drain steadily** |
| **Multi-Consumer Fan-Out (1 Ping → 5 Services)** | Tightly coupled slow API | Must duplicate jobs manually | Requires complex exchange/queue bindings | **Native Consumer Groups — zero coupling, zero duplication** |
| **Event Replay / Time-Travel Debugging** | Impossible | Impossible (jobs deleted on ACK) | Impossible (messages deleted on ACK) | **Native retention (7–30 days); reset offset & replay anytime** |
| **Zero Data Loss Durability** | Single point of DB contention | Risk on Redis crash/eviction | Good with quorum queues, slower | **Replicated append-only commit log on disk** |
| **Long-Term Analytics / ML / ERP Readiness** | Requires heavy DB polling | Not designed for streams | Not designed for streams | **Plug in BI, ClickHouse, Fraud ML, or ERP consumers with zero API changes** |

### 5.2 Five Killer Arguments to Present in the Meeting

1. **Guaranteed Per-Vehicle Ordering (Critical for Geofences & Odometers):**
   If Vehicle `veh-1` sends GPS points at `10:00:05`, `10:00:10`, and `10:00:15`, and point #3 is processed before point #2, your geofence engine fires false entry/exit alerts and your route polyline zig-zags backward. By partitioning Kafka topics with key `${tenant_id}:${vehicle_id}`, **all events for a single vehicle always land on the exact same partition and are processed strictly in order**, while different vehicles scale horizontally across dozens of partitions in parallel.
2. **Survives Mobile Reconnect Storms Without Breaking a Sweat:**
   In real Bangladesh/global fleet operations, delivery vans drive through dead zones and suddenly reconnect simultaneously at a depot or highway exit—dumping 500–1,000 buffered GPS points per vehicle at once. Writing those bursts directly to PostgreSQL triggers connection-pool exhaustion and slows down dispatchers' web dashboards. With Kafka sitting between the ingestion endpoint and the workers, the API accepts the batch in **< 20 ms**, appends to Kafka, and returns `202 Accepted`. Workers smoothly batch-insert into TimescaleDB (`1,000 rows per INSERT`) at a steady pace Postgres loves.
3. **One GPS Event Powers 5 Independent Capabilities (True Decoupling):**
   When `telemetry.gps.raw` receives a vehicle frame, **five independent worker groups** consume it simultaneously at their own speed:
   - Live Map Broadcaster updates Redis + pushes to WebSockets in **< 300 ms**.
   - TimescaleDB Writer batches 1,000 points/sec for historical playback.
   - PostGIS Geofence Worker evaluates polygon crossings and curfew violations.
   - Trip Stitcher accumulates distance, max speed, and harsh-braking/idle metrics.
   - Future Billing / ERP / AI Predictive Maintenance consumers can subscribe later **without modifying a single line of ingestion code**.
4. **Replayability Saves Weeks of Debugging & Enables Retroactive Analytics:**
   In RabbitMQ or BullMQ, once a worker ACKs a message, it is gone forever. In Kafka, events remain safely retained on disk for 7–30 days. If a bug in our Safety Score formula or Fuel Anomaly rule is discovered, or a customer asks to retroactively evaluate a new geofence over last week's trips, we fix the worker, reset its Consumer Group offset, and replay the stream cleanly.
5. **Transactional Outbox Pattern Eliminates Dual-Write Bugs Forever:**
   When a Dispatcher clicks **Approve & Dispatch** on TrackFlow Web, we never do *"save to DB, then call Kafka"* (which leaves orphan state if the network drops between calls). Instead, PostgreSQL writes the `trip` update AND an `outbox_events` row in **one atomic SQL transaction**. A lightweight Outbox Relay / Debezium CDC streams committed rows into Kafka — guaranteeing 100% consistency between database truth and downstream mobile push notifications, alerts, and audit logs.

### 5.3 How to Defuse the Only Common Objection: *"Isn't Kafka Heavy to Operate Early On?"*
**Winning Answer for Leadership:**
> *"We use the **Kafka Protocol & Architecture from Day 1**, without the old ZooKeeper/JVM operational headache. For our Pilot and Growth phases, we deploy **Redpanda** (a single-binary, C++ drop-in Kafka replacement using < 1 GB RAM) or **Confluent Cloud / AWS MSK Serverless** (pure pay-per-GB, ~$30–$50/month for a 100-vehicle pilot). Our application uses standard Kafka client libraries. Whether we have 50 vehicles today or 50,000 vehicles in 3 years, we never rewrite our backend!"*

---

## 6. Kafka Topic Topology & Specialized Worker Fleet Blueprint

### 6.1 Production Kafka Topics

| Topic Name | Partition Key | Partitions (Start → Scale) | Retention | Producer | Primary Consumers |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `telemetry.gps.raw` | `tenantId:vehicleId` | `12 → 64` | 7 days | Telemetry Ingest API | Telemetry Writer, Geofence Worker, Trip Stitcher, Live Map Broadcaster |
| `telemetry.obd.raw` | `tenantId:vehicleId` | `6 → 32` | 7 days | Mobile / OBD-II Gateway | Telemetry Writer, Predictive Maintenance Worker |
| `trips.lifecycle` | `tenantId:tripId` | `6 → 16` | 30 days | Core API (Outbox) | Trip Stitcher, Safety Scorer, Notification Worker, Audit Writer |
| `dispatch.events` | `tenantId:bookingId` | `6 → 16` | 30 days | Core API (Outbox) | Notification Worker (Push to Driver), Audit Writer |
| `geofence.events` | `tenantId:vehicleId` | `6 → 16` | 30 days | Geofence Worker | Notification Worker, Audit Writer, Analytics Aggregator |
| `fuel.events` | `tenantId:vehicleId` | `6 → 12` | 30 days | Core API (Outbox) | Fuel Anomaly Worker, TCO Rollup Worker, Audit Writer |
| `maintenance.events` | `tenantId:vehicleId` | `6 → 12` | 30 days | Core API + Cron Scheduler | Notification Worker, Vehicle Lifecycle Updater, Audit Writer |
| `incidents.sos` | `tenantId:vehicleId` | `6 → 12` | 90 days | Core API (Outbox) | High-Priority SOS Escalation Worker (Push + SMS + WebSocket) |
| `media.uploaded` | `tenantId:mediaId` | `6 → 12` | 7 days | S3 Event / API | Media Validation & Virus Scan Worker |
| `exports.requested` | `tenantId:jobId` | `3 → 12` | 7 days | Reports API | Async CSV/PDF Export Worker |
| `audit.events` | `tenantId` | `6 → 16` | 90 days | Core API + All Workers | Immutable Audit Log Writer |
| `<topic>.dlq` *(Dead-Letter)* | Original Key | Match Source | 30 days | Any Failed Worker | Ops Monitoring Dashboard & Manual Replay Tool |

### 6.2 The 6 Specialized Worker Services (Consumer Groups)

1. **Worker 1 — `telemetry-persister-and-live-worker`** *(Group: `cg-telemetry-live`)*
   - **Consumes:** `telemetry.gps.raw`, `telemetry.obd.raw`.
   - **Work:** Deduplicates by `(deviceId, eventId)` via Redis; updates vehicle's live position in Redis (`HSET` + `GEOADD`); publishes throttled delta frames to Redis Pub/Sub so WebSocket Gateways push live map updates to TrackFlow Web & Mobile in **< 1.5 seconds**; micro-batches (500–1,000 rows or every 1s) bulk `COPY` inserts into TimescaleDB.
2. **Worker 2 — `geofence-and-safety-worker`** *(Group: `cg-geofence-safety`)*
   - **Consumes:** `telemetry.gps.raw`.
   - **Work:** Applies GPS accuracy filter (`accuracyMeters <= 35m`) and hysteresis buffer (prevents false flickering on zone borders); checks PostGIS polygons (`ST_Covers`) + `after_hours_only` curfews; detects speeding, harsh deceleration, and prolonged idling; emits `geofence.events` and `fleet.alerts`.
3. **Worker 3 — `trip-lifecycle-and-scoring-worker`** *(Group: `cg-trip-lifecycle`)*
   - **Consumes:** `telemetry.gps.raw`, `trips.lifecycle`.
   - **Work:** Incrementally computes trip distance, max speed, vehicle odometer, and engine hours; on trip completion (`status = done`), recalculates the driver's 0–100 **Safety Score**, updates `trip_safety_metrics`, and refreshes materialized utilization views.
4. **Worker 4 — `anomaly-and-compliance-worker`** *(Group: `cg-anomaly-compliance`)*
   - **Consumes:** `fuel.events` + Scheduled Cron Triggers (every hour / daily at 06:00 depot local time).
   - **Work:** Evaluates every new fuel log against `tank_capacity_liters` and trailing full-tank `km/L` baseline (>25% drop triggers a theft/leak alert). Scheduled scanner checks all `compliance_documents` for **30d / 15d / 7d / Expired** thresholds and `maintenance_records` for **calendar / odometer / engine-hour** due thresholds (deduplicated per entity + rule + threshold so users never get spammed).
5. **Worker 5 — `notification-escalation-worker`** *(Group: `cg-notifications`)*
   - **Consumes:** `incidents.sos`, `geofence.events`, `dispatch.events`, `maintenance.events`, `fuel.events`.
   - **Work:** Persists `fleet_alerts` rows, pushes live toasts over WebSockets, dispatches mobile push notifications (FCM / APNs), and escalates `critical` SOS incidents via SMS/Email with delivery receipt tracking (`notification_deliveries`) and acknowledgement timers.
6. **Worker 6 — `media-and-export-worker`** *(Group: `cg-media-exports`)*
   - **Consumes:** `media.uploaded`, `exports.requested`.
   - **Work:** Scans uploaded S3 receipts, inspection photos, and POD signatures (MIME verification, file-size bounds, antivirus scan, thumbnail generation) before marking `status = verified`; generates large multi-month CSV/PDF Trip & TCO exports asynchronously, uploads to S3, and notifies the requester with a time-limited download link.

### 6.3 Worker Reliability Patterns (Built Into Every Consumer)
- **Idempotent Handlers:** Every worker checks `processed_events (consumer_group, event_id)` or uses `ON CONFLICT DO NOTHING` so at-least-once delivery never creates duplicate alerts, double odometer jumps, or double charges.
- **Retry with Exponential Backoff + Dead-Letter Queue (DLQ):** Transient failures retry 3 times (`1s → 5s → 30s` with jitter); poison pills route automatically to `<topic>.dlq` with stack trace + correlation `request_id` so one bad packet never blocks a partition.
- **Observability:** OpenTelemetry traces propagate `request_id` / `trace_id` from Mobile/Web → API → Kafka headers → Worker → PostgreSQL, monitored via Prometheus/Grafana (`consumer_group_lag`, `p95_ingestion_latency`, `dlq_count`).

---

## 7. Capacity Sizing, Throughput Math & Estimated Cloud Cost

Show these concrete numbers in the meeting to prove the design is **both cost-effective today and rock-solid at enterprise scale**:

| Scale Tier | Active Fleet Size | GPS Rate (1 ping / 10s while active) | Daily GPS Points | Monthly Raw → TimescaleDB Compressed Storage | Estimated Monthly Infra Cost (Managed Cloud) |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Phase 1: Pilot** | **100 vehicles** | ~10 events/sec *(burst: 200/s)* | ~430,000 / day | ~1.5 GB → **~150 MB / mo** | **~$120 – $220 / mo** *(1 Managed PG+PostGIS+Timescale, Small Redis, Redpanda/Serverless Kafka, S3, 2 containers)* |
| **Phase 2: Growth** | **1,000 vehicles** | ~100 events/sec *(burst: 2,000/s)* | ~4.3M / day | ~15 GB → **~1.5 GB / mo** | **~$450 – $800 / mo** *(HA Postgres, Redis cluster, Managed Kafka/Redpanda, autoscaled API + Worker pods)* |
| **Phase 3: Enterprise** | **10,000 vehicles** | ~1,000 events/sec *(burst: 20,000/s)* | ~43M / day | ~150 GB → **~15 GB / mo** | **~$2,200 – $3,800 / mo** *(Read replicas, partitioned Kafka 64p, dedicated worker autoscaling, multi-AZ HA)* |

> **Key Takeaway for Finance & Leadership:** TimescaleDB compression reduces GPS storage costs by **~90%**, and Redpanda / Serverless Kafka keeps pilot infrastructure under **~$220/month** while eliminating any future architectural rewrite cost.

---

## 8. Meeting Q&A Cheat Sheet (Handling Stakeholder Objections)

| Likely Question in the Meeting | Crisp, Convincing Answer |
| :--- | :--- |
| **"Why not build a simple monolithic REST API + Postgres first without Kafka?"** | For basic CRUD (vehicles, drivers), REST + Postgres is great — and we **are** using a Modular Monolith API + Postgres for CRUD! We add Kafka specifically for **real-time telemetry, geofencing, alerts, and background workflows** so GPS spikes and reconnect storms never lock up Postgres or slow down dispatch screens. |
| **"Is Apache Kafka too complex for our engineering team?"** | No. By using **Managed Kafka (Confluent Cloud / AWS MSK Serverless)** or **Redpanda**, there is zero ZooKeeper and zero broker babysitting. Developers only write simple typed `produce()` and `consume()` functions in TypeScript. |
| **"Why TypeScript (NestJS/Fastify) instead of Java/Go for the backend?"** | Both our Web (`Next.js`) and Mobile (`Expo`) apps are 100% TypeScript with complete shared domain types (`types/index.ts`). Using TypeScript for the core API + Workers cuts backend development time by **40%+** through shared Zod/OpenAPI contracts. If we later add raw TCP/UDP hardware GPS trackers (Teltonika/Queclink), Kafka makes it trivial to drop in a tiny Go TCP listener that publishes directly to `telemetry.gps.raw`! |
| **"What happens if a driver loses 4G signal on a highway?"** | Mobile writes trips, inspections, PODs, fuel logs, and GPS batches into a local **SQLite Outbox** with UUIDv7 idempotency keys. On reconnect, it flushes batches to the API → Kafka absorbs the burst → Workers deduplicate and stitch the exact route chronologically with zero data loss. |
| **"How do we prevent two dispatchers from assigning the same vehicle?"** | The `POST /v1/dispatch` endpoint executes an atomic PostgreSQL transaction using `SELECT ... FOR UPDATE` on the vehicle + driver rows and enforces a partial unique database index (`UNIQUE (vehicle_id) WHERE status IN ('active', 'paused')`). Even under simultaneous clicks, only one succeeds and the second receives a clean `409 Conflict`. |

---

## 9. Phased 12-Week Production Rollout Roadmap

| Phase | Timeline | Key Deliverables | Acceptance Gate (Definition of Done) |
| :--- | :---: | :--- | :--- |
| **Phase 1: Core System of Record & Auth** | Weeks 1–3 | Monorepo API (NestJS + OpenAPI), Multi-tenant PostgreSQL 16 + PostGIS + TimescaleDB migrations, JWT + Server-side 14-permission RBAC, S3 Pre-Signed Media Uploads, Vehicles/Compliance/Drivers/Shifts APIs. | Web & Mobile both authenticate against live API; cross-tenant isolation tests pass 100%; Compliance Vault uploads to private S3. |
| **Phase 2: Transactional Dispatch & Outbox** | Weeks 4–6 | Bookings, availability conflict checks, atomic dispatch locking, Pre/Post Checklists, POD Signatures, Fuel/Expenses/Maintenance/Work Orders/Incidents APIs, PostgreSQL Outbox → Kafka (`Redpanda/MSK`) bridge. | **Two-Device Acceptance Test:** Approve booking on Web → Push arrives on Mobile → Driver completes Pre-Check, POD & Post-Check → Web reflects completed trip, odometer & TCO immediately. |
| **Phase 3: Live GPS Pipeline & Workers** | Weeks 7–9 | High-throughput `POST /v1/telemetry/batch`, Kafka `telemetry.gps.raw`, **Workers 1–5** (TimescaleDB batch writer, Redis live cache, WebSocket Hub, PostGIS Geofence/Curfew Worker, Fuel Anomaly & Compliance Cron, Push/SMS SOS Escalation). | Real GPS pings from physical Android/iOS devices appear on Web Live Map in **< 2 seconds p95**; geofence crossing & SOS trigger live banners + push notifications; Mobile SQLite offline queue passes airplane-mode reconnect drill. |
| **Phase 4: Analytics, Load Testing & Pilot Go-Live** | Weeks 10–12 | TimescaleDB Continuous Aggregates powering `/reports` (Trip Reports, CPK/TCO, Utilization), Worker 6 (Async CSV/PDF exports + S3 scan), OpenTelemetry monitoring, 2× peak load test (including reconnect storm), PITR backup/restore drill. | **Pilot SLA Verified:** 99.9% API uptime, `< 300 ms` p95 CRUD latency, `< 2 s` p95 map update latency, 15-min RPO / 4-hr RTO restore tested, pilot fleet onboarded. |

---

## 10. Meeting Decision Checklist (Sign-Off Items)

To move straight into Sprint 1 after this meeting, we seek approval on **five clear decisions**:
1. **Approve Target Stack:** Modular TypeScript API + PostgreSQL 16 (PostGIS + TimescaleDB) + Redis + S3 + **Apache Kafka (Redpanda / Managed Serverless Kafka)** + 6 Worker Consumer Groups.
2. **Confirm Cloud Provider & Region:** AWS (`ap-southeast-1` Singapore for low latency to Dhaka) or GCP/Azure equivalent.
3. **Confirm Pilot Scope:** Initial pilot fleet size (recommended: **25–50 vehicles**), primary telemetry source (Mobile Background GPS first, OBD-II hardware phase 2), and pilot depot owner.
4. **Approve Security & Compliance Baseline:** Server-side multi-tenant RBAC, private S3 pre-signed evidence storage, and append-only audit retention policy.
5. **Greenlight Phase 1 (Weeks 1–3):** Kick off backend repository scaffolding, database schema migrations, and CI/CD staging environment.
