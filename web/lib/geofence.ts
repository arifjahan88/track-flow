import type { GeofenceZone, LatLng } from "@/types";

/**
 * Ray-casting algorithm to determine whether a geographic coordinate
 * falls inside a closed polygon.
 */
export function isPointInPolygon(
  point: LatLng,
  polygon: readonly LatLng[]
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isAfterHours(
  hour24: number,
  allowedStartHour = 6,
  allowedEndHour = 22
): boolean {
  if (allowedStartHour <= allowedEndHour) {
    return hour24 < allowedStartHour || hour24 >= allowedEndHour;
  }
  return hour24 < allowedStartHour && hour24 >= allowedEndHour;
}

export interface ZoneTransitionEvent {
  zone: GeofenceZone;
  eventType: "entered" | "exited" | "after_hours";
}

export function evaluateGeofenceTransitions(
  prevPoint: LatLng | undefined,
  currPoint: LatLng,
  zones: readonly GeofenceZone[],
  hour24: number
): ZoneTransitionEvent[] {
  const events: ZoneTransitionEvent[] = [];

  for (const zone of zones) {
    if (!zone.active) continue;
    const wasInside = prevPoint
      ? isPointInPolygon(prevPoint, zone.polygon)
      : false;
    const isInside = isPointInPolygon(currPoint, zone.polygon);

    if (!wasInside && isInside) {
      if (
        zone.afterHoursOnly &&
        isAfterHours(hour24, zone.allowedStartHour, zone.allowedEndHour)
      ) {
        events.push({ zone, eventType: "after_hours" });
      } else if (zone.alertOnEntry) {
        events.push({ zone, eventType: "entered" });
      }
    } else if (wasInside && !isInside && zone.alertOnExit) {
      events.push({ zone, eventType: "exited" });
    }
  }

  return events;
}
