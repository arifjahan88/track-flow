import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect } from "react-native-svg";
import { Fonts, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  REGION_CENTERS,
  getRouteById,
} from "@/lib/city-routes";
import type { RealFleetMapProps } from "./real-fleet-map";

const WEB_HIGHWAYS = [
  "M 40 315 L 960 315",
  "M 120 140 L 890 140",
  "M 90 485 L 920 485",
  "M 245 40 L 245 585",
  "M 520 30 L 520 595",
  "M 785 45 L 785 575",
  "M 80 560 Q 340 420 520 260 T 940 90",
  "M 110 85 Q 410 220 630 355 T 930 555",
];

export function RealFleetMap({
  vehicles,
  frames,
  geofences,
  showGeofences,
  selectedVehicleId,
  onSelectVehicle,
  cityRegion,
}: RealFleetMapProps) {
  const theme = useTheme();
  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];
  const selectedFrame = selectedVehicle
    ? frames[selectedVehicle.id]
    : undefined;
  const selectedRoute = getRouteById(selectedVehicle?.routeId);

  const toPolyString = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.mapCanvas },
      ]}
    >
      <Svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Street Grid Lines */}
        {Array.from({ length: 20 }).map((_, i) => (
          <Line
            key={`v-${i}`}
            x1={i * 52}
            y1={0}
            x2={i * 52}
            y2={MAP_HEIGHT}
            stroke={
              theme.isDark
                ? "rgba(34, 211, 238, 0.07)"
                : "rgba(8, 145, 178, 0.09)"
            }
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <Line
            key={`h-${i}`}
            x1={0}
            y1={i * 48}
            x2={MAP_WIDTH}
            y2={i * 48}
            stroke={
              theme.isDark
                ? "rgba(34, 211, 238, 0.07)"
                : "rgba(8, 145, 178, 0.09)"
            }
            strokeWidth={1}
          />
        ))}

        {/* Arterial Highways */}
        {WEB_HIGHWAYS.map((d, idx) => (
          <Path
            key={idx}
            d={d}
            stroke={theme.isDark ? "#132A3D" : "#CBE0EC"}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* Geofences */}
        {showGeofences
          ? geofences
              .filter((g) => g.active)
              .map((g) => (
                <Circle
                  key={g.id}
                  cx={g.x}
                  cy={g.y}
                  r={g.radius}
                  stroke={g.color}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  fill={`${g.color}22`}
                />
              ))
          : null}

        {/* Full Corridor Road Bed */}
        <Polyline
          points={toPolyString(selectedRoute.waypoints)}
          fill="none"
          stroke={
            theme.isDark
              ? "rgba(34, 211, 238, 0.16)"
              : "rgba(8, 145, 178, 0.22)"
          }
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Covered Trail */}
        {selectedFrame && selectedFrame.coveredPoints.length >= 2 ? (
          <Polyline
            points={toPolyString(selectedFrame.coveredPoints)}
            fill="none"
            stroke="rgba(8, 145, 178, 0.42)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Remaining Active Road Line (Dual-Layer Casing + Bright Cyan Line) */}
        {selectedFrame && selectedFrame.remainingPoints.length >= 2 ? (
          <>
            <Polyline
              points={toPolyString(selectedFrame.remainingPoints)}
              fill="none"
              stroke="#0E7490"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={toPolyString(selectedFrame.remainingPoints)}
              fill="none"
              stroke={theme.isDark ? "#22D3EE" : "#0891B2"}
              strokeWidth={5.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {/* Vehicle Markers */}
        {vehicles.map((v) => {
          const f = frames[v.id];
          const x = f?.x ?? 250;
          const y = f?.y ?? 310;
          const route = getRouteById(v.routeId);
          const isSelected = v.id === selectedVehicleId;
          return (
            <G key={v.id} x={x} y={y}>
              {isSelected ? (
                <Circle
                  cx={0}
                  cy={0}
                  r={24}
                  fill={`${route.color}33`}
                  stroke={route.color}
                  strokeWidth={1.5}
                />
              ) : null}
              <Circle
                cx={0}
                cy={0}
                r={11}
                fill={route.color}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <Rect
                x={-34}
                y={-32}
                width={68}
                height={16}
                rx={8}
                fill={isSelected ? route.color : theme.card}
                stroke={route.color}
                strokeWidth={1}
              />
            </G>
          );
        })}
      </Svg>

      {/* Bottom-left Region & Quick Vehicle Selector Bar on Web */}
      <View
        style={[
          styles.webOverlayPill,
          {
            backgroundColor: theme.glassBg,
            borderColor: theme.border,
          },
        ]}
      >
        <Text
          style={[
            styles.regionLabel,
            { color: theme.primary, fontFamily: Fonts?.mono },
          ]}
        >
          {REGION_CENTERS[cityRegion].label}
        </Text>
        <View style={styles.chipRow}>
          {vehicles.map((v) => {
            const active = v.id === selectedVehicleId;
            return (
              <Pressable
                key={v.id}
                onPress={() => onSelectVehicle(v.id)}
                style={[
                  styles.vehChip,
                  {
                    backgroundColor: active ? theme.primary : theme.muted,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.vehChipText,
                    {
                      color: active ? theme.primaryForeground : theme.text,
                      fontFamily: Fonts?.mono,
                    },
                  ]}
                >
                  {v.plate}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  webOverlayPill: {
    position: "absolute",
    top: 120,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  regionLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  vehChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  vehChipText: {
    fontSize: 9,
    fontWeight: "800",
  },
});
