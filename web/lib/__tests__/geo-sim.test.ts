import { describe, expect, it } from "vitest";
import { CITY_ROUTES, INITIAL_VECTOR_GEOFENCES } from "@/lib/city-routes";
import {
  headingToCardinal,
  interpolateRoutePosition,
  isPointInsideVectorGeofence,
  lerpAngle,
} from "@/lib/geo-sim";

describe("geo-sim vector tracking utilities", () => {
  it("interpolates smooth coordinates and covered/remaining polylines along city routes", () => {
    const route = CITY_ROUTES[0];
    const start = interpolateRoutePosition(route.waypoints, 0);
    const mid = interpolateRoutePosition(route.waypoints, 0.5);

    expect(start.x).toBeCloseTo(route.waypoints[0].x, 1);
    expect(start.y).toBeCloseTo(route.waypoints[0].y, 1);
    expect(mid.coveredPoints.length).toBeGreaterThan(1);
    expect(mid.remainingPoints.length).toBeGreaterThan(1);
    expect(mid.headingDeg).toBeGreaterThanOrEqual(0);
    expect(mid.headingDeg).toBeLessThan(360);
  });

  it("converts degrees to 8-point cardinal compass labels and wraps lerpAngle across 360°", () => {
    expect(headingToCardinal(0)).toBe("N");
    expect(headingToCardinal(90)).toBe("E");
    expect(headingToCardinal(180)).toBe("S");
    expect(headingToCardinal(270)).toBe("W");

    const blended = lerpAngle(350, 10, 0.5);
    expect(blended).toBeCloseTo(0, 5);
  });

  it("detects vehicle coordinates inside active vector geofences", () => {
    const hub = INITIAL_VECTOR_GEOFENCES[0];
    expect(isPointInsideVectorGeofence(hub.x, hub.y, hub)).toBe(true);
    expect(
      isPointInsideVectorGeofence(hub.x + hub.radius + 25, hub.y, hub)
    ).toBe(false);
    expect(
      isPointInsideVectorGeofence(hub.x, hub.y, { ...hub, active: false })
    ).toBe(false);
  });
});
