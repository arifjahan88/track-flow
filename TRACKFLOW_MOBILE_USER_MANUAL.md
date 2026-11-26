# TrackFlow Mobile User Manual

**Driver and field operations prototype and production roadmap**  
**Repository snapshot** `686d6e2` · 25 November 2026

TrackFlow Mobile is the field app for drivers, dispatchers and mechanics. It demonstrates the driving cockpit, trip inspections, delivery signatures, fuel and expense logging, incidents and fleet visibility. Use the browser build for the meeting. The Expo project also has native map and foreground location paths, which require device validation before a field pilot.

**In this manual** · Launch and roles · Driving cockpit and trips · Field logs and repairs · Fleet Hub, Profile and notifications · Meeting walkthrough · Current architecture and production roadmap

### Start the mobile prototype

1. From the repository root, run `cd mobile`, then `yarn install --frozen-lockfile` and `yarn web`. Open the address printed by Metro. A phone-sized browser window works well for the walkthrough.
2. In the demo account area, choose **Marcus Vance** for the Driver persona or use **Sign In**. **Create Account** registers a local demo user. The role switcher lets you show another persona within the same local fleet workspace.
3. The native development entry point is `yarn start`. Use the terminal’s iOS or Android launch options with a compatible simulator, emulator or build. Rehearse the browser flow for the meeting and validate native maps, permissions and media on target devices before a pilot.

### Demo roles

- **Driver** (`driver@demo.com`) uses **Drive Map**, **Trips**, **Field Logs** and **Profile**.
- **Dispatcher** (`dispatch@demo.com`) uses **Dispatch** to show booking approvals and **Live Map** for fleet visibility.
- **Mechanic** (`mechanic@demo.com`) uses **Service Bay** for service and work order updates.
- **Fleet Manager** (`manager@demo.com`) uses **Fleet Hub** for vehicles, compliance, drivers and cost analytics.
- **Super Admin** (`demo@demo.com`) demonstrates the available management screens and local role views.

All five seeded accounts use `demo1234` for manual sign-in. The web console and the mobile browser build each seed their own records.

## Driving cockpit and trip lifecycle

### Use Drive Map or Live Map

1. Open the map. In the map controls, choose **Dhaka Metro** or **SF Bay Hub**, then choose **Street Simulation** for the meeting. Select a vehicle marker and inspect the covered route, remaining route, waypoint pins and zone markers.
2. Expand the cockpit sheet and use **On Duty** to demonstrate the locally stored duty state. Read the speed and compass display, guided corridor maneuvers and sample OBD-II readings. Change playback speed or pause the simulation. The banner describes maneuvers on seeded corridors.
3. **Real Device GPS** requests foreground location. When available, the watch updates local position and may record points against an active local trip. If the browser or device denies location, switch back to simulation. Browser and native maps use different renderers.
4. The cockpit shows a local geofence entry banner on relevant simulated crossings. Open the notification bell to inspect the corresponding local alert where generated.

### Run an inspection and complete a trip

1. Select an available vehicle, expand the cockpit and tap **Start Trip · … (Pre-Check)**. Check tyres, lights, brakes, fluids, and exterior or mirrors. Add notes and optional sample images using the photo library picker, then confirm. The mobile start path saves the pre-trip checklist with the local trip.
2. Return to the cockpit to view route progress. Use **Pause** or **Resume** and check the active record in **Trips → Active Manifest**. A seeded active trip is useful if a demo vehicle is busy.
3. Select the active trip that owns the stop. Use **+ Stop** if needed, enter the stop label and address, then choose **POD Sign** on the waypoint. Added stops use demo coordinates. Enter the recipient, sign on the touch pad, optionally pick a delivery image and tap **Save POD & Mark Stop Arrived**. Confirm the stop is marked delivered.
4. Choose **End Trip** or **End Trip (Post-Check)**. Complete the walkaround and confirm. In **Trips → History**, select a trip and use its route scrubber to review recorded progress.

### Demonstrate dispatch

In **Trips** or **Dispatch**, open **Bookings** and choose **+ Request Trip**. Enter requester, purpose and estimated distance. The mobile form fills in a tomorrow date, selected vehicle and first driver from local data. A role with approval access can approve or reject. Use **Launch Pre-Trip Inspection & Dispatch** to begin the vehicle flow. The launch does not carry the booking ID or booked driver into the trip, so a booking can stay approved. Use **Drivers & Shifts** in the web demo for the fuller scheduling and conflict-check example.

## Field logs repairs and incidents

### Log fuel or an expense

1. In **Field Logs → Fuel** or the cockpit shortcut, tap **+ Log Fuel Fill-Up**. Check the vehicle, then enter litres, price per litre, odometer and station. Mark full-tank fill where applicable and save. Inspect the log, fuel efficiency indicators and over-capacity flag.
2. In **Expenses**, choose **+ Log Toll / Parking / Allowance**, select the vehicle and category, enter amount and available reference details, and tap **Save Operating Expense**. Confirm the new entry in the list.
3. Use the web console to demonstrate receipt attachments. The mobile quick fuel form captures the fill-up fields without a receipt picker.

### Service Bay

1. Open **Service Bay → Service** as Mechanic. Review existing work orders, priorities, parts and labour, warranty and downtime data where present.
2. Use **Advance Status** on an applicable order. Read the next state shown on its button and confirm the result on its card. The workflow shows open, in progress, waiting on parts and completed states.
3. Scroll to preventive service records, check due status, and use **Mark Service Completed** for an eligible record. Use the web app to demonstrate creating full service rules and work orders.

### Roadside incident and notifications

1. In **Field Logs → SOS** or the cockpit, open the roadside incident form. Select a vehicle and severity, enter location, description and any third-party name or estimated cost, then tap **Broadcast SOS Incident Report**.
2. Review the open incident and the local fleet alert. The form uses vehicle last-known or fallback coordinates and stores no incident photos. SOS creates a demo record and local alert. Emergency calls, roadside dispatch and push delivery require separate integrations.
3. Use **Mark Incident Resolved** where available. Open the notification bell to filter **All**, **Unread**, **Critical** or **Updates**. Use **View on Live Map**, **Mark Read** or **Mark All as Read**.

## Fleet Hub profile and meeting walkthrough

### Fleet Hub

- In **Vehicles** as Fleet Manager, tap **Register New Fleet Vehicle**, enter the available registration details and tap **Save Vehicle to Registry**. Open **Profile & Lifecycle** for vehicle data and state, or **Track on Live Map** to focus the camera.
- In **Compliance**, review the vehicle documents and expiry bands. In **Drivers**, review assignments, licence warnings and safety metrics. Use the web console for full compliance document and driver administration.
- In **CPK / TCO**, compare sample cost per kilometre and total cost of ownership across vehicles. These are local calculations based on the demo dataset. CPK needs completed-trip distance.

### Profile and local data

- Change the appearance between dark, light and system preferences. Review the current role, permissions and activity. For a linked driver, review shifts and use **Log Leave**.
- Use the role switcher to demonstrate another persona, or **Sign Out** to return to login. In a disposable demo session, use **Reset Demo Fleet Data** to reload the seed. Reset replaces that app instance’s local fleet changes.
- If a tab is missing, check the active role. If location is unavailable, use Street Simulation. If a trip fails to start, use an available vehicle or open a seeded active trip. If a stop form isn’t available, check that the correct active vehicle and waypoint are selected.

### Suggested six minute demo

1. **Minute 1.** Select Marcus Vance and show the Dhaka cockpit, simulated telemetry and duty toggle.
2. **Minutes 2–3.** Start a trip through the pre-check or open a seeded active trip. Sign for a delivery, complete the post-check and open trip history.
3. **Minutes 4–5.** Log fuel, demonstrate a sample SOS record and open Notifications. Switch to Mechanic for a work order.
4. **Minute 6.** Switch to Fleet Manager and open Fleet Hub, compliance and costs. Explain that the web console shows an independent workspace until the shared backend is implemented.

## How the mobile prototype works today

- **Frontend.** `mobile/src/app` uses Expo Router for login, tabs and modal screens. React Native and React Native Web render the app. Reanimated and Gesture Handler drive cockpit interaction. Native uses `react-native-maps` and the browser uses an SVG-based corridor view.
- **State and storage.** Zustand stores auth, fleet and theme as `tf-mobile-auth`, `tf-mobile-fleet` and `tf-mobile-theme`. The storage wrapper uses AsyncStorage, with web localStorage or in-memory fallback on storage errors. Photos selected on mobile are represented by local URIs. There is no shared database, media upload or sync engine.
- **Telemetry and business logic.** `use-live-simulation.ts` generates simulated frames and periodically commits local updates. Expo Location supplies an optional foreground watch. Simulation still drives demo fleet behavior. Turn guidance and OBD-II are illustrative. The client implements local role checks, seeded records, alerts and model calculations.
- **Backend and workers.** The browser build is a single-page Expo web output. The codebase has no deployed backend service, Redis, Kafka, worker scheduler, mobile push delivery or hardware ingestion. Foreground location is implemented. Background location, battery behavior, durable offline upload and store distribution are future work.
- **Fleet system assessment.** The combined app demonstrates core operations. The mobile release should prioritize assigned-driver access, device-tested GPS, offline reconciliation, evidence delivery, verified incident routing and consistent dispatch state across devices.

**Repository references** · `mobile/package.json` · `mobile/app.json` · `mobile/src/app` · `mobile/src/hooks/use-live-simulation.ts` · `mobile/src/lib/storage.ts` · `mobile/src/store/fleet-store.ts` · `mobile/src/types/index.ts`

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
