"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Gauge, MapPin, Pause, Play, RotateCcw, Route } from "lucide-react";
import { RouteMap } from "@/components/route-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatSpeed,
} from "@/lib/format";
import { haversineKm, ROUTE_WAYPOINTS } from "@/lib/geo";
import type { GeofenceZone, Trip } from "@/types";

interface DetectedStop {
  index: number;
  startedAt: number;
  durationMs: number;
  lat: number;
  lng: number;
}

function detectTripStops(trip: Trip): DetectedStop[] {
  const pts = trip.points;
  const stops: DetectedStop[] = [];
  let stopStartIdx: number | null = null;

  for (let i = 1; i < pts.length; i++) {
    const distKm = haversineKm(pts[i - 1], pts[i]);
    const dtHours = Math.max(1e-6, (pts[i].t - pts[i - 1].t) / 3_600_000);
    const speedKmh = distKm / dtHours;

    if (speedKmh < 4) {
      if (stopStartIdx === null) stopStartIdx = i - 1;
    } else if (stopStartIdx !== null) {
      const durationMs = pts[i - 1].t - pts[stopStartIdx].t;
      if (durationMs >= 45_000) {
        stops.push({
          index: stopStartIdx,
          startedAt: pts[stopStartIdx].t,
          durationMs,
          lat: pts[stopStartIdx].lat,
          lng: pts[stopStartIdx].lng,
        });
      }
      stopStartIdx = null;
    }
  }
  return stops;
}

interface RoutePlaybackProps {
  trip: Trip;
  geofences?: readonly GeofenceZone[];
}

export function RoutePlayback({ trip, geofences }: RoutePlaybackProps) {
  const totalPts = trip.points.length;
  const [cursor, setCursor] = useState(Math.max(0, totalPts - 1));
  const [playing, setPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 4>(2);

  useEffect(() => {
    if (!playing || totalPts <= 1) return;
    const intervalMs = Math.round(450 / speedMultiplier);
    const timer = window.setInterval(() => {
      setCursor((prev) => {
        if (prev >= totalPts - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [playing, speedMultiplier, totalPts]);

  const visiblePoints = useMemo(
    () => trip.points.slice(0, Math.max(1, cursor + 1)),
    [trip.points, cursor]
  );

  const stops = useMemo(() => detectTripStops(trip), [trip]);

  const currentPoint = trip.points[cursor] ?? trip.points[0];
  const prevPoint = cursor > 0 ? trip.points[cursor - 1] : undefined;

  const currentSpeedKmh = useMemo(() => {
    if (!currentPoint || !prevPoint) return 0;
    const dist = haversineKm(prevPoint, currentPoint);
    const dtHours = (currentPoint.t - prevPoint.t) / 3_600_000;
    if (dtHours <= 0) return 0;
    return Math.min(160, dist / dtHours);
  }, [currentPoint, prevPoint]);

  const durationMs = trip.endedAt
    ? Math.max(
        0,
        new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime()
      )
    : 0;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (cursor >= totalPts - 1) {
      setCursor(0);
    }
    setPlaying(true);
  };

  return (
    <div className="space-y-4">
      <RouteMap
        points={visiblePoints}
        live={playing}
        showPlannedRoute={true}
        activeWaypointIndex={ROUTE_WAYPOINTS.length}
        geofences={geofences}
        className="min-h-[240px] sm:min-h-[340px]"
      />

      {/* Interactive Timeline Scrubber */}
      {totalPts > 1 ? (
        <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={togglePlay}
                className="h-8 rounded-lg px-3"
              >
                {playing ? (
                  <>
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Play
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => {
                  setPlaying(false);
                  setCursor(0);
                }}
                aria-label="Restart playback"
                className="rounded-lg"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              {([1, 2, 4] as const).map((mult) => (
                <Button
                  key={mult}
                  type="button"
                  size="xs"
                  variant={speedMultiplier === mult ? "secondary" : "ghost"}
                  onClick={() => setSpeedMultiplier(mult)}
                  className="rounded-md font-mono"
                >
                  {mult}x
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {currentPoint ? (
                <Badge variant="outline" className="rounded-md font-mono">
                  {formatDateTime(new Date(currentPoint.t).toISOString())}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-md font-mono">
                {formatSpeed(currentSpeedKmh)} km/h
              </Badge>
              <span className="font-mono">
                Pt {cursor + 1}/{totalPts}
              </span>
            </div>
          </div>

          <input
            type="range"
            aria-label="Route playback timeline"
            min={0}
            max={totalPts - 1}
            value={cursor}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
            className="h-2 w-full cursor-pointer accent-primary"
          />
        </div>
      ) : null}

      {/* Trip Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Route className="h-3.5 w-3.5 text-primary" />
            Distance
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {formatKm(trip.distanceKm)} km
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-[var(--brand-blue)]" />
            Duration
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {formatDuration(durationMs)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/35 p-3">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Gauge className="h-3.5 w-3.5 text-[var(--brand-amber)]" />
            Top speed
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            {formatSpeed(trip.maxSpeedKmh)} km/h
          </p>
        </div>
      </div>

      {/* Detected Stops + Checklists + Waypoint POD Summary */}
      {stops.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Detected Stops ({stops.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {stops.map((s) => (
              <button
                key={s.index}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setCursor(s.index);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs hover:border-primary"
              >
                <MapPin className="h-3 w-3 text-[var(--brand-amber)]" />
                <span>{formatDateTime(new Date(s.startedAt).toISOString())}</span>
                <span className="font-mono text-muted-foreground">
                  ({formatDuration(s.durationMs)})
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {trip.waypoints && trip.waypoints.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Waypoints &amp; Proof of Delivery ({trip.waypoints.length})
          </p>
          <div className="mt-2 space-y-2">
            {trip.waypoints.map((wp) => (
              <div
                key={wp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-foreground">{wp.label}</p>
                  <p className="text-muted-foreground">{wp.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  {wp.recipientName ? (
                    <Badge variant="secondary" className="rounded-md">
                      Signed: {wp.recipientName}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-md">
                      Pending
                    </Badge>
                  )}
                  {wp.podSignatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={wp.podSignatureDataUrl}
                      alt="Signature"
                      className="h-8 w-20 rounded border border-border bg-white object-contain"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
