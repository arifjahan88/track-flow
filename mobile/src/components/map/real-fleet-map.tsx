import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import MapView, {
  Circle,
  Marker,
  Polyline,
  type Region,
} from "react-native-maps";
import {
  TRACKFLOW_DARK_MAP_STYLE,
  TRACKFLOW_LIGHT_MAP_STYLE,
} from "@/constants/map-style";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  REGION_CENTERS,
  getRouteById,
  getRouteCoordsForRegion,
} from "@/lib/city-routes";
import type {
  CityRegionId,
  LiveVehicleFrame,
  MapCoordinate,
  TripWaypoint,
  VectorGeofence,
  Vehicle,
} from "@/types";

export interface RealFleetMapProps {
  vehicles: Vehicle[];
  frames: Record<string, LiveVehicleFrame>;
  geofences: VectorGeofence[];
  showGeofences: boolean;
  selectedVehicleId: string;
  onSelectVehicle: (vehicleId: string) => void;
  followCamera: boolean;
  cityRegion: CityRegionId;
  activeWaypoints?: TripWaypoint[];
  realDeviceLocation?: MapCoordinate | null;
  fitTrigger?: number;
}

export function RealFleetMap({
  vehicles,
  frames,
  geofences,
  showGeofences,
  selectedVehicleId,
  onSelectVehicle,
  followCamera,
  cityRegion,
  activeWaypoints = [],
  realDeviceLocation,
  fitTrigger = 0,
}: RealFleetMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView | null>(null);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const selectedFrame = selectedVehicle
    ? frames[selectedVehicle.id]
    : undefined;
  const selectedRoute = getRouteById(selectedVehicle?.routeId);
  const fullRouteCoords = getRouteCoordsForRegion(selectedRoute, cityRegion);

  // When cityRegion or fitTrigger changes, animate camera to the region center
  useEffect(() => {
    const center = REGION_CENTERS[cityRegion];
    const nextRegion: Region = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: center.latitudeDelta,
      longitudeDelta: center.longitudeDelta,
    };
    mapRef.current?.animateToRegion(nextRegion, 650);
  }, [cityRegion, fitTrigger]);

  // Smooth camera lock following the selected moving vehicle
  useEffect(() => {
    if (!followCamera || !selectedFrame) return;
    mapRef.current?.animateCamera(
      {
        center: {
          latitude: selectedFrame.latitude,
          longitude: selectedFrame.longitude,
        },
      },
      { duration: 750 }
    );
  }, [
    followCamera,
    selectedFrame?.latitude,
    selectedFrame?.longitude,
    selectedFrame,
  ]);

  const initialCenter = REGION_CENTERS[cityRegion];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          latitudeDelta: initialCenter.latitudeDelta,
          longitudeDelta: initialCenter.longitudeDelta,
        }}
        customMapStyle={
          theme.isDark ? TRACKFLOW_DARK_MAP_STYLE : TRACKFLOW_LIGHT_MAP_STYLE
        }
        userInterfaceStyle={theme.isDark ? "dark" : "light"}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        pitchEnabled
        rotateEnabled
      >
        {/* Geofence Zones */}
        {showGeofences
          ? geofences
              .filter((g) => g.active)
              .map((g) => {
                const lat =
                  cityRegion === "dhaka" ? g.dhakaLatitude : g.latitude;
                const lng =
                  cityRegion === "dhaka" ? g.dhakaLongitude : g.longitude;
                return (
                  <Circle
                    key={g.id}
                    center={{ latitude: lat, longitude: lng }}
                    radius={g.radiusMeters}
                    strokeColor={g.color}
                    strokeWidth={2}
                    fillColor={`${g.color}22`}
                  />
                );
              })
          : null}

        {/* Full Background Corridor Track */}
        {fullRouteCoords.length >= 2 ? (
          <Polyline
            coordinates={fullRouteCoords}
            strokeColor={
              theme.isDark
                ? "rgba(130, 163, 184, 0.25)"
                : "rgba(70, 99, 120, 0.28)"
            }
            strokeWidth={4}
          />
        ) : null}

        {/* Covered Route Path (Solid Glowing Cyan / Route Color) */}
        {selectedFrame && selectedFrame.coveredCoords.length >= 2 ? (
          <Polyline
            coordinates={selectedFrame.coveredCoords}
            strokeColor={selectedRoute.color}
            strokeWidth={5}
          />
        ) : null}

        {/* Remaining Route Path (Dashed Navigation Line) */}
        {selectedFrame && selectedFrame.remainingCoords.length >= 2 ? (
          <Polyline
            coordinates={selectedFrame.remainingCoords}
            strokeColor={theme.primary}
            strokeWidth={4}
            lineDashPattern={[10, 6]}
          />
        ) : null}

        {/* Active Trip Delivery Waypoint Stop Pins */}
        {activeWaypoints.map((wp, idx) => {
          const done = Boolean(wp.arrivedAt);
          return (
            <Marker
              key={wp.id}
              coordinate={{ latitude: wp.lat, longitude: wp.lng }}
              title={wp.label}
              description={wp.address}
            >
              <View
                style={[
                  styles.waypointPin,
                  {
                    backgroundColor: done
                      ? theme.statusLive
                      : theme.primary,
                    borderColor: theme.card,
                  },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : (
                  <Text style={styles.waypointIdx}>{idx + 1}</Text>
                )}
              </View>
            </Marker>
          );
        })}

        {/* Real Device GPS Dot (if available) */}
        {realDeviceLocation ? (
          <Marker
            coordinate={realDeviceLocation}
            title="Your Real Device GPS"
          >
            <View style={styles.realGpsPuck}>
              <View style={styles.realGpsCore} />
            </View>
          </Marker>
        ) : null}

        {/* All Fleet Vehicles with Rotating Heading Arrow & Plate/Speed Badge */}
        {vehicles.map((v) => {
          const frame = frames[v.id];
          const lat =
            frame?.latitude ??
            v.lastKnownLocation?.latitude ??
            initialCenter.latitude;
          const lng =
            frame?.longitude ??
            v.lastKnownLocation?.longitude ??
            initialCenter.longitude;
          const heading =
            frame?.headingDeg ?? v.lastKnownLocation?.heading ?? 0;
          const speed = Math.round(
            frame?.speedKmh ?? v.lastKnownLocation?.speed ?? 0
          );
          const isSelected = v.id === selectedVehicleId;
          const isMoving = v.status === "on_trip";
          const route = getRouteById(v.routeId);

          return (
            <Marker
              key={v.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => onSelectVehicle(v.id)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.markerWrapper}>
                {/* Floating License Plate & Speed Pill */}
                <View
                  style={[
                    styles.markerPill,
                    {
                      backgroundColor: isSelected
                        ? route.color
                        : theme.card,
                      borderColor: isSelected ? "#FFFFFF" : route.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.markerPlate,
                      {
                        color: isSelected ? "#03121A" : theme.text,
                        fontFamily: Fonts?.mono,
                      },
                    ]}
                  >
                    {v.plate}
                  </Text>
                  {isMoving ? (
                    <Text
                      style={[
                        styles.markerSpeed,
                        {
                          color: isSelected
                            ? "#03121A"
                            : theme.primary,
                          fontFamily: Fonts?.mono,
                        },
                      ]}
                    >
                      {speed}km/h
                    </Text>
                  ) : null}
                </View>

                {/* Directional Vehicle Puck */}
                <View
                  style={[
                    styles.puckOuter,
                    {
                      backgroundColor: `${route.color}33`,
                      borderColor: isSelected ? "#FFFFFF" : route.color,
                      transform: [{ scale: isSelected ? 1.12 : 0.96 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.puckCore,
                      {
                        backgroundColor: route.color,
                        transform: [{ rotate: `${Math.round(heading)}deg` }],
                      },
                    ]}
                  >
                    <Ionicons name="navigate" size={14} color="#03121A" />
                  </View>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  markerWrapper: {
    alignItems: "center",
    gap: 3,
  },
  markerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  markerPlate: {
    fontSize: 9,
    fontWeight: "900",
  },
  markerSpeed: {
    fontSize: 9,
    fontWeight: "800",
  },
  puckOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  puckCore: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  waypointPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  waypointIdx: {
    fontSize: 11,
    fontWeight: "900",
    color: "#03121A",
  },
  realGpsPuck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(16, 185, 129, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  realGpsCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
