# TrackFlow Web User Manual

**Vehicle management prototype and production roadmap**  
**Repository snapshot** `686d6e2` · 25 November 2026

TrackFlow Web is the dispatch and administration console. It demonstrates the main fleet management workflows: vehicle and driver records, scheduling, trips, fuel and expenses, service, incidents, reporting, and administrative review. The demo runs from seeded data in a browser. A shared backend, real fleet telemetry and durable operational records are the main requirements for a live pilot.

**In this manual** · Sign-in and roles · Dashboard, vehicles and drivers · Dispatch, live map and geofences · Costs and maintenance · Reports, settings and demo walkthrough · Current architecture and production roadmap

### Start the web prototype

1. From the repository root, run `cd web`, then `yarn install --frozen-lockfile` and `yarn dev`. Use the local address printed in the terminal, normally `http://localhost:3000`.
2. On **Sign in to TrackFlow**, choose a tile under **Quick Demo Accounts (1-Click Launch)**. Start with Fleet Manager for the main walkthrough or Super Admin for Settings. The **Register** tab creates a local demo account and lets the user pick a role.
3. Use the sidebar to navigate. On a narrow screen, open the navigation menu. Use the top bar for notifications, theme, role switching and sign-out.

### Demo roles

- **Super Admin** (`demo@demo.com`) demonstrates all modules, user role assignment, the permission matrix and the audit view.
- **Fleet Manager** (`manager@demo.com`) manages the registry, compliance, driver schedules, dispatch, operating costs, service and reports.
- **Dispatcher** (`dispatch@demo.com`) handles requests, approvals, simulated tracking and geofence operations.
- **Mechanic** (`mechanic@demo.com`) focuses on service rules, work orders and incident follow-up.
- **Driver** (`driver@demo.com`) focuses on assigned trips, proof of delivery, fuel, expenses and incidents.

All five seeded accounts use `demo1234` for manual sign-in. Role switches show different controls while sharing the same local fleet dataset on this browser origin. The permission matrix describes demo permissions implemented in the client.

## Dashboard vehicles and drivers

### Executive Dashboard

- Read **Total Fleet**, **Active Trips**, **Distance Covered** and **Active Alerts** for the current local workspace. Use the status distribution and breakdown panels to explain availability, and the seven-day fuel spend and distance chart to discuss trends.
- Use **Live Fleet Roster** and **Track** to open the selected vehicle in Live GPS Tracking. Use the alert feed and notification bell for local fleet events. The Driver account also shows an assignment spotlight when it has a matching driver record.

### Vehicles and Assets

1. Open **Vehicles & Assets** and add a vehicle as Fleet Manager or Super Admin. Enter the vehicle identity, plate and supported details such as VIN or chassis number, make, model, year, fuel type, tank capacity, odometer, engine hours and depreciation. A photo helps distinguish the demo assets.
2. Open a vehicle card to inspect its profile. Use card actions to edit the vehicle and set its lifecycle state. Available vehicles can be dispatched. An active trip must be ended before deleting its vehicle. Use **Live Track** on a running vehicle.
3. Open the vehicle’s compliance tab and select **Add document**. Choose registration or tax token, fitness certificate, route permit, or insurance, then enter the identifying details, issuer, expiry and available metadata. Verify the expiry badge and test an upcoming expiry using a disposable record.
4. The expiry logic shows 30-, 15- and 7-day bands and expired status. Describe these as screen-level expiry indicators. Scheduled reminders to inboxes or phones require a backend.

### Drivers and Shifts

1. Open **Drivers & Shifts**. Create or edit a driver profile with contact and licence details and assigned vehicle details where applicable. Review licence status, trip statistics and recorded vehicle assignment history.
2. Open the driver’s schedule. Add weekday shifts and leave date ranges, and review the existing entries before planning a booking.
3. Review safety indicators for harsh braking, speeding, idling and on-time completion. Scores are derived from demo trip metrics. Check a booking with a driver on leave or already on an active trip to demonstrate the local availability check.

## Dispatch and tracking

### Request and dispatch a vehicle

1. In **Live GPS Tracking**, open **Bookings** and select **Request vehicle**. Enter requester, department, purpose, requested date and estimated distance. Choose a vehicle and driver or use the automatic options.
2. The request form evaluates active assignments, leave and scheduled weekdays for driver selection. Sign in as Fleet Manager, Dispatcher or Super Admin to approve or reject a pending request.
3. On an approved row, choose **Dispatch** to open the pre-trip walkaround. Review tyres, lights, brakes, fluids and body, add notes or photos as needed, and select **Confirm & Start Trip**.
4. Look for the started trip in the map and telemetry panel. In this web flow, the form opens but its pre-trip result is dropped, and the booking remains approved. The booking also does not bind the driver to the started trip. Present the request, approval and launch screens as a prototype sequence.

### Operate the live map

- Select a vehicle in the map or roster. Pan, zoom, reset or lock the camera. Use the simulation playback controls and 1×, 2× or 4× speed. Read heading, speed, position, progress, odometer and fuel. The map, OBD-II strip, positions and driving readings on this route are simulated.
- **Start Live Trip on …** launches a corridor directly. **End Active Trip** opens the post-trip checklist. Confirm the checklist to finish the trip, then select a completed row in **Trip History** to inspect its details and route playback. Filter history as needed.
- For an eligible active waypoint, open the proof-of-delivery form, record recipient and signature, attach a photo if appropriate and save to mark the stop arrived. Use a seeded delivery stop if the selected trip has no waypoint.

### Configure geofences

Open **Geofences** to inspect the seeded city zones and toggle monitoring. Use the polygon form to enter a named zone, its type and coordinates. Observe seeded corridor crossings with the simulation running. The UI has seeded vector zones and a separate polygon list, so use the seeded zones for the most predictable map demonstration.

## Costs service and incidents

### Fuel and operating expenses

1. In **Fuel & Expenses → Fuel Logs**, add a log with vehicle, date, litres, price or total, odometer, station and fill type. Attach a sample receipt if useful. Review the row and its anomaly indicators, or edit an incorrect entry.
2. Compare comparable full-tank fill-ups to explain km/L. A reading needs a usable earlier full fill and odometer interval. Tank-capacity and efficiency anomalies are indicators for review.
3. In **Expenses**, select **Add expense**. Choose a vehicle and category, enter amount and date, and add trip, cost centre, vendor or notes where available. Categories include tolls, parking, fines and allowances. Verify the item in the expense list and cost rollup.

### Maintenance and work orders

1. Open **Maintenance → Service Rules** and choose **Schedule service rule**. Select a vehicle and service type, then set due criteria using calendar date, odometer or engine hours. Review due state as usage or dates change.
2. After service, use **Mark completed** and enter the completion date and cost. Compare the new status and the vehicle’s service history.
3. In **Work Orders**, create a repair with vehicle, priority, description, vendor, parts quantities and unit costs, labour, warranty and downtime where relevant. Review the part and labour total and advance the order through applicable statuses such as open, in progress, waiting on parts and completed.
4. In **Incidents**, report a selected vehicle, date, severity, location and description. Add applicable driver, third-party details, estimated cost and damage photos. Follow the case through open, investigating and resolved. Discuss the record as a local case.

## Reports administration and meeting walkthrough

### Reports and TCO

- Use **Reports & TCO** to review trip activity and utilization by vehicle and period, with peak-hour demand and CSV export where offered. Apply the same filters before comparing an on-screen value with an export.
- Use **CPK & TCO** to compare fuel, maintenance, operating expenses, document costs and depreciation. CPK divides TCO by completed-trip kilometres when distance is positive. The demo helper rolls up supplied records and applies a depreciation horizon. Confirm reporting periods, cost categorization and possible maintenance duplication before using these figures for accounting.

### Settings and RBAC

- Use **Settings & RBAC** to inspect the default role matrix. As Super Admin, assign a demo user role. Use the role switcher to show how controls change. Use **Audit Log** to review available actions. The audit is local, bounded, and included in the editable backup.
- In **General & Data**, export a fleet JSON backup before resetting or importing. Import a TrackFlow backup and confirm expected record counts. The fleet snapshot covers operational data and audit entries. Accounts and real database recovery are separate concerns. **Reset demo data** replaces local fleet changes with seeded data.

### Suggested six minute demo

1. **Minute 1.** Open the dashboard as Fleet Manager and track a seeded running vehicle.
2. **Minute 2.** Show a vehicle’s lifecycle and compliance status, then open a driver schedule.
3. **Minutes 3–4.** Approve or dispatch a request, inspect telemetry, and show a completed route or POD. Use an available vehicle for a fresh start, or a seeded active trip for a reliable finish.
4. **Minutes 5–6.** Open a repair order and TCO, then switch to Super Admin for audit and backup. Explain the shared-backend milestone using the production roadmap.

### If a demo screen behaves unexpectedly

If TrackFlow opens signed out, choose a demo tile again. If a start fails, check vehicle lifecycle and the driver’s current assignment. If the map is stationary, return to **Live GPS Tracking**, confirm simulation playback is enabled and select a vehicle on a trip. If seed content looks stale, export the current fleet then reset in the demo profile. Keep the same URL, including its host and port, to reopen the same browser workspace.

## How the web prototype works today

- **Frontend.** `web/app` holds Next.js App Router routes and layouts. React and TypeScript render the workflow screens. Tailwind and shadcn/Base UI provide primitives, Recharts visualizes local metrics, and Framer Motion animates the interface. The auth guard and navigation work at the client layer.
- **State and data model.** `web/store` contains Zustand auth and fleet stores persisted as `tf-auth` and `tf-fleet` in browser localStorage. Theme uses `tf-theme`. `web/types/index.ts` defines users, vehicles, drivers, compliance, shifts, bookings, trips, waypoints, geofences, fuel, costs, service, work orders, incidents and audit events. `web/lib` supplies seeds, validation helpers, geo calculations and analytics.
- **Business logic.** A form calls a local store action, which updates its related records and re-renders the UI. Authentication, role policy and password comparison are browser-side demo logic. File attachment data can increase browser storage usage. JSON import and local store migrations are prototype conveniences.
- **Tracking and workers.** The active map uses animation frames and periodic local state commits. The repository contains a browser geolocation hook that the live route does not use. Geofence calculations, compliance state and rollups run locally. There is no deployed API, SQL database, background worker, Redis, Kafka, object storage, remote notifications or tracker integration in this repository.
- **Fleet system assessment.** The prototype covers core daily operating roles and records. A live fleet still needs shared identity and authorization, transactional dispatch, verified telemetry, device management, durable evidence, notifications, dependable reporting and recovery. Route optimization, fuel-card or ERP integration, parts inventory and multi-depot operation remain expansion decisions based on pilot need.

**Repository references** · `web/package.json` · `web/app/(app)` · `web/components` · `web/store/fleet-store.ts` · `web/store/auth-store.ts` · `web/lib/rbac.ts` · `web/lib/analytics.ts` · `web/hooks/use-trip-tracker.ts`

## Production architecture and system of record

### Shared backend and data

Start with a modular TypeScript API and a separately deployed worker from the same codebase. Keep Next.js for the operations console and Expo for field workflows. Publish a versioned REST/OpenAPI contract with cursor pagination, tenant-scoped filters, input limits and clear errors. Use generated client types and query caching. Keep Zustand for view state such as map selection and theme. Give each operation a stable request ID so support can trace it across clients, API and worker.

Use managed PostgreSQL for tenants, memberships, vehicles, drivers, devices, bookings, trips, inspections, stops, proof records, fuel, expenses, work orders, compliance, notifications and audit history. Use tenant-scoped foreign keys and uniqueness rules. Represent money as decimal amounts with ISO currency, store timestamps in UTC with depot time zones for operations, and standardize kilometres, litres and engine hours. Partition high-volume telemetry by time as volume grows. Use PostGIS for validated polygons, spatial indexes and geofence boundary rules. [PostGIS polygon coverage](https://postgis.net/docs/ST_Covers.html)

A dispatch command should authorize the actor, check availability and compliance, reserve the vehicle and driver, and atomically create the trip, persist the pre-check, set the booking to dispatched, and enqueue an outbox event. Enforce overlap rules at the database or inside an appropriate lock, then test two dispatchers racing for the same resource. Use idempotency keys for retries and version checks for edits. Store events with actor, tenant, timestamp, entity ID and state change. Keep an append-only audit trail with restricted access and a defined retention policy.

Use a private object store for licences, receipts, inspection photos and signatures. The API issues short-lived upload URLs for unique keys and records size, checksum and scan state. Workers validate and scan files before making them available. Recheck tenant access for every download. [Amazon S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

### Identity and separation

Use managed identity with staff SSO and MFA where appropriate. Use secure web sessions and mobile token storage backed by the OS. The API verifies tenant membership, permission and record scope on every request. Limit a driver to their assigned records, scope mechanics to their service operations, and test that one tenant cannot access another tenant’s records or media. Make simulator environments and production identities independently provisioned.

## Events telemetry and background workers

### Pilot event flow

An authenticated device or supported tracker sends timestamped position batches with device ID, sequence, accuracy and a stable event ID. The ingestion API validates and deduplicates each batch, durably stores accepted points and records server receive time. Preserve late readings for history and keep the last-known position from moving backwards. A worker computes zone transitions, speed summaries and alert candidates. Publish an authorized map snapshot and stream incremental changes to web via SSE or WebSocket. After reconnect, refresh the snapshot or resume from a cursor. Mark old positions stale and show whether a reading came from a phone, tracker or simulation.

Write an outbox row in the same PostgreSQL transaction as business updates. Have a worker lease jobs from a durable queue or outbox. Use bounded retries, backoff and jitter, idempotent handlers, a dead-letter review process and replay controls. Track the age of the oldest job and correlate failures with entity and request IDs. Send notifications only after the source record is committed. Save delivery results and avoid repeat alerts from GPS jitter, retries and duplicate provider callbacks.

### Worker responsibilities

- **Scheduled checks.** Find upcoming compliance expiries and date-, distance- or engine-hour-based service. Deduplicate reminders by entity, rule and threshold.
- **Telemetry processing.** Evaluate entry, exit or dwell with accuracy and hysteresis rules. Aggregate events for replay, safety and utilization. Record rule version and evidence for review.
- **Notifications and exports.** Deliver in-app, push, email or SMS by preference and severity. Record acknowledgement and escalation for contracted incident handling. Generate larger exports asynchronously with controlled download access.
- **Media and data hygiene.** Scan attachments, remove eligible expired data by policy and reconcile incomplete uploads. Track pending work rather than exposing unverified evidence.

### Decide when to add Redis and Kafka

Use Redis when measured hot reads, rate limits or live fan-out justify it. Cache tenant-scoped last-known positions with TTL and rebuild from PostgreSQL. Expect eviction or temporary unavailability and keep durable alert delivery in the queue. [Redis eviction policies](https://redis.io/docs/latest/reference/eviction/)

Add managed Kafka when sustained telemetry throughput, independently replayable consumers or longer event replay exceed the simpler queue’s measured capacity. Relay durable events into versioned topics with stable event IDs and tenant-plus-vehicle partition keys. Expect ordering within a partition and handle duplicate deliveries in consumers. Monitor lag, retention, failure topics and replay impact. Keep transactional bookings and audit records in PostgreSQL. [Apache Kafka documentation](https://kafka.apache.org/documentation/)

## Pilot delivery rollout and operating targets

### Build in this order

1. **Shared operations.** Preserve the browser prototype for demos. Build staging with identity, PostgreSQL, registry, shifts, compliance and transactional dispatch. Run a two-browser acceptance test: create and approve on web, start and inspect on mobile, then verify that booking, assigned driver, both inspections and the trip agree after refresh.
2. **Reliable field capture.** Build a local SQLite queue with stable mutation IDs, pending/sent/failed states and resumable evidence uploads. Test weak signal, force quit, reconnect and duplicate submissions. Define conflict policy for stale edits, assignments and timestamps. Validate native builds on physical iOS and Android devices, including consent, background permission, battery, app restarts, low connectivity and revocation. [Expo location and platform requirements](https://docs.expo.dev/versions/latest/sdk/location/)
3. **Small monitored fleet pilot.** Add device enrolment and revocation, production geofences, retention rules, alert escalation, maintenance reminders and verified exports. Validate odo and hardware readings against a reference source. Reconcile costs with the source records. Agree what drivers and operators see during degraded service.
4. **Scale after measurement.** Load-test at twice the expected peak, including reconnect storms. For planning, 1,000 vehicles sending a point every 10 seconds yield about 100 points per second before bursts. Evaluate database partitions, rate controls, caching and streaming against real pilot traffic. Add depot dispatch, route optimization, fuel cards, ERP or parts inventory according to pilot demand.

### Set launch gates and rehearse recovery

- **Reliability.** Proposed pilot targets for discussion are 99.9% API availability per month, under 500 ms p95 for normal business API calls, and under five seconds p95 from accepted point to map update under normal reception. Measure ingestion freshness separately from device connectivity.
- **Delivery and support.** Use CI for lint, types, unit tests, API contracts, permission isolation and end-to-end dispatch. Deploy gradually with feature flags, compatible database migrations and rehearsed rollback. Define owners and runbooks for ingestion gaps, offline backlog, queue lag and media failures. Correlate metrics, traces and structured logs without exposing precise locations or signatures in logs. [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/)
- **Migration and recovery.** Review any prototype exports in staging, map legacy IDs, validate relationships and reject demo identities. Import only approved operational data and reconcile counts and samples. Test point-in-time restore and object recovery. Proposed objectives are a 15-minute recovery point and four-hour recovery time, subject to restore drills and pilot agreement. [PostgreSQL point-in-time recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)

**Meeting decision** · Agree the first pilot fleet and owners, the telemetry source and device coverage, and the shared dispatch acceptance test. Fund Redis or Kafka when the pilot workload shows a specific need.
