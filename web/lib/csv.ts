import type { Driver, Trip, Vehicle } from "@/types";
import { formatDuration, formatKm, formatSpeed } from "@/lib/format";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tripsToCsv(
  trips: readonly Trip[],
  vehiclesById: ReadonlyMap<string, Vehicle>,
  driversById: ReadonlyMap<string, Driver>
): string {
  const headers = [
    "Trip ID",
    "Date",
    "Vehicle",
    "Plate",
    "Driver",
    "Purpose",
    "Distance (km)",
    "Duration",
    "Top Speed (km/h)",
  ];

  const rows = trips.map((trip) => {
    const vehicle = vehiclesById.get(trip.vehicleId);
    const driver = trip.driverId ? driversById.get(trip.driverId) : undefined;
    const durationMs = trip.endedAt
      ? Math.max(
          0,
          new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime()
        )
      : 0;

    return [
      trip.id,
      trip.startedAt,
      vehicle?.name ?? "Unknown vehicle",
      vehicle?.plate ?? "",
      driver?.name ?? "Unassigned",
      trip.purpose,
      formatKm(trip.distanceKm),
      formatDuration(durationMs),
      formatSpeed(trip.maxSpeedKmh),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
