import { NextResponse } from "next/server";
import type { FleetAlert, Trip, TripBooking, Vehicle } from "@/types";

export interface DemoSyncSnapshot {
  bookings: TripBooking[];
  trips: Trip[];
  vehicles: Array<Pick<Vehicle, "id" | "status" | "odometerKm" | "fuelLevelPercent">>;
  alerts: FleetAlert[];
}

interface DemoSyncMemory {
  version: number;
  updatedAt: number;
  source: string;
  snapshot: DemoSyncSnapshot | null;
}

const globalForSync = globalThis as unknown as {
  __trackflowDemoSync?: DemoSyncMemory;
};

function getSyncState(): DemoSyncMemory {
  if (!globalForSync.__trackflowDemoSync) {
    globalForSync.__trackflowDemoSync = {
      version: 0,
      updatedAt: 0,
      source: "init",
      snapshot: null,
    };
  }
  return globalForSync.__trackflowDemoSync;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const state = getSyncState();
  return NextResponse.json(
    {
      version: state.version,
      updatedAt: state.updatedAt,
      source: state.source,
      snapshot: state.snapshot,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      source?: string;
      snapshot?: DemoSyncSnapshot;
    };
    if (
      !body?.snapshot ||
      !Array.isArray(body.snapshot.bookings) ||
      !Array.isArray(body.snapshot.trips)
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid sync snapshot payload." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const state = getSyncState();
    state.version += 1;
    state.updatedAt = Date.now();
    state.source = typeof body.source === "string" ? body.source : "client";
    state.snapshot = body.snapshot;

    return NextResponse.json(
      {
        ok: true,
        version: state.version,
        updatedAt: state.updatedAt,
      },
      { headers: CORS_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to parse sync request." },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
