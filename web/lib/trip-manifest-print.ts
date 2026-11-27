import { formatDateTime, formatKm } from "@/lib/format";
import type { Driver, Trip, Vehicle } from "@/types";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Opens a clean, print-ready Trip & Proof-of-Delivery Manifest in a new window
 * so users can print or Save as PDF directly during enterprise demos.
 */
export function openPrintableTripManifest(
  trip: Trip,
  vehicle?: Vehicle,
  driver?: Driver
): boolean {
  if (typeof window === "undefined") return false;
  const win = window.open("", "_blank", "width=840,height=920");
  if (!win) return false;

  const pre = trip.preTripChecklist;
  const post = trip.postTripChecklist;
  const waypoints = trip.waypoints ?? [];

  const checklistRow = (label: string, ok?: boolean) =>
    `<li><span>${label}</span><strong>${ok ? "PASS" : "CHECK"}</strong></li>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TrackFlow Trip Manifest · ${escapeHtml(trip.id)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; margin: 28px; line-height: 1.45; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0891b2; padding-bottom: 14px; margin-bottom: 20px; }
    .brand { font-size: 20px; font-weight: 800; color: #0e7490; }
    .sub { font-size: 12px; color: #475569; margin-top: 2px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #ecfeff; color: #0e7490; font-size: 11px; font-weight: 700; border: 1px solid #a5f3fc; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 700; }
    .val { font-size: 14px; font-weight: 700; margin-top: 3px; }
    h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0e7490; margin: 18px 0 8px; }
    ul.checks { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 14px; }
    ul.checks li { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 4px 0; font-size: 12px; }
    .pod { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
    .sig { max-height: 90px; border: 1px dashed #94a3b8; border-radius: 6px; padding: 4px; margin-top: 8px; background: #fff; }
    @media print { button.no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TrackFlow · Official Trip &amp; POD Manifest</div>
      <div class="sub">Trip ID: ${escapeHtml(trip.id)} · Generated ${escapeHtml(new Date().toLocaleString())}</div>
    </div>
    <span class="badge">${escapeHtml(trip.status.toUpperCase())}</span>
  </div>

  <div class="grid">
    <div class="box"><div class="label">Purpose</div><div class="val">${escapeHtml(trip.purpose)}</div></div>
    <div class="box"><div class="label">Vehicle</div><div class="val">${escapeHtml(vehicle ? `${vehicle.name} (${vehicle.plate})` : trip.vehicleId)}</div></div>
    <div class="box"><div class="label">Driver</div><div class="val">${escapeHtml(driver?.name ?? "Assigned Driver")}</div></div>
    <div class="box"><div class="label">Started At</div><div class="val">${escapeHtml(formatDateTime(trip.startedAt))}</div></div>
    <div class="box"><div class="label">Completed At</div><div class="val">${escapeHtml(trip.endedAt ? formatDateTime(trip.endedAt) : "In Progress")}</div></div>
    <div class="box"><div class="label">Distance &amp; Max Speed</div><div class="val">${formatKm(trip.distanceKm)} km · ${Math.round(trip.maxSpeedKmh)} km/h</div></div>
  </div>

  ${
    pre
      ? `<h3>Pre-Trip Safety Walkaround (${escapeHtml(formatDateTime(pre.completedAt))})</h3>
         <ul class="checks">
           ${checklistRow("Tires & Pressure", pre.tiresOk)}
           ${checklistRow("Lights & Signals", pre.lightsOk)}
           ${checklistRow("Brakes", pre.brakesOk)}
           ${checklistRow("Fluids & Oil", pre.fluidsOk)}
           ${checklistRow("Exterior & Mirrors", pre.bodyOk)}
         </ul>`
      : ""
  }

  ${
    post
      ? `<h3>Post-Trip Closure Walkaround (${escapeHtml(formatDateTime(post.completedAt))})</h3>
         <ul class="checks">
           ${checklistRow("Tires & Pressure", post.tiresOk)}
           ${checklistRow("Lights & Signals", post.lightsOk)}
           ${checklistRow("Brakes", post.brakesOk)}
           ${checklistRow("Fluids & Oil", post.fluidsOk)}
           ${checklistRow("Exterior & Mirrors", post.bodyOk)}
         </ul>`
      : ""
  }

  <h3>Delivery Waypoints &amp; Proof of Delivery (POD)</h3>
  ${
    waypoints.length === 0
      ? `<p class="sub">No delivery waypoints recorded for this corridor run.</p>`
      : waypoints
          .map(
            (wp, idx) => `<div class="pod">
              <strong>Stop #${idx + 1}: ${escapeHtml(wp.label)}</strong>
              <div class="sub">${escapeHtml(wp.address)}</div>
              <div class="sub" style="margin-top:4px;">Status: ${
                wp.arrivedAt
                  ? `Delivered (${escapeHtml(formatDateTime(wp.arrivedAt))}) · Signed by <strong>${escapeHtml(wp.recipientName ?? "Recipient")}</strong>`
                  : "Pending Arrival"
              }</div>
              ${
                wp.podSignatureDataUrl
                  ? `<img class="sig" src="${wp.podSignatureDataUrl}" alt="POD Signature" />`
                  : ""
              }
            </div>`
          )
          .join("")
  }

  <div style="margin-top:20px;">
    <button class="no-print" onclick="window.print()" style="background:#0891b2;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  return true;
}
