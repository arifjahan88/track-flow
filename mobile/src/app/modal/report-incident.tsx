import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { toIsoDate } from "@/lib/format";
import { triggerWarningHaptic } from "@/lib/haptics";
import { getScopedVehicles } from "@/lib/rbac-scope";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { IncidentSeverity } from "@/types";

const SEVERITIES: IncidentSeverity[] = ["minor", "moderate", "major"];

export default function ReportIncidentModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const users = useAuthStore((s) => s.users);
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUser = users.find((u) => u.id === currentUserId);

  const allVehicles = useFleetStore((s) => s.vehicles);
  const drivers = useFleetStore((s) => s.drivers);
  const bookings = useFleetStore((s) => s.bookings);
  const trips = useFleetStore((s) => s.trips);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const addIncident = useFleetStore((s) => s.addIncident);

  const vehicles = useMemo(
    () =>
      getScopedVehicles(currentUser, drivers, allVehicles, bookings, trips),
    [currentUser, drivers, allVehicles, bookings, trips]
  );

  const [vehicleId, setVehicleId] = useState(() => {
    const requested = params.vehicleId || selectedVehicleId;
    if (requested && vehicles.some((v) => v.id === requested)) return requested;
    return vehicles[0]?.id || "veh-1";
  });
  const selectedVehicle =
    vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];

  const [severity, setSeverity] = useState<IncidentSeverity>("moderate");
  const [locationLabel, setLocationLabel] = useState(
    "Hatirjheel East Viaduct / Rampura Bridge"
  );
  const [description, setDescription] = useState("");
  const [thirdPartyName, setThirdPartyName] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("180");
  const [photos, setPhotos] = useState<string[]>([]);

  const handlePickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setPhotos((prev) => [...prev, res.assets[0].uri]);
      }
    } catch {
      setPhotos((prev) => [...prev, `incident-photo-${prev.length + 1}.jpg`]);
    }
  };

  const handleSubmit = () => {
    if (!locationLabel.trim() || !selectedVehicle) return;
    const assignedDriver = drivers.find(
      (d) => d.assignedVehicleId === selectedVehicle.id
    );
    addIncident({
      vehicleId: selectedVehicle.id,
      driverId: assignedDriver?.id,
      occurredAt: toIsoDate(),
      severity,
      status: "open",
      locationLabel: locationLabel.trim(),
      lat: selectedVehicle.lastKnownLocation?.latitude ?? 23.7798,
      lng: selectedVehicle.lastKnownLocation?.longitude ?? 90.4241,
      description:
        description.trim() ||
        "Roadside traffic contact reported from Driver Mobile Cockpit.",
      thirdPartyName: thirdPartyName.trim() || undefined,
      estimatedCost: Number(estimatedCost) || undefined,
      photos,
    });
    triggerWarningHaptic();
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.background }]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: theme.danger }]}>
            SOS · Report Roadside Incident
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Dispatches instant fleet alert with live GPS coordinates
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: theme.muted }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            INCIDENT SEVERITY
          </Text>
          <View style={styles.chipWrap}>
            {SEVERITIES.map((sev) => {
              const active = sev === severity;
              return (
                <Pressable
                  key={sev}
                  onPress={() => setSeverity(sev)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.danger : theme.muted,
                      borderColor: active ? theme.danger : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {sev.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            AFFECTED VEHICLE
          </Text>
          <View style={styles.chipWrap}>
            {vehicles.map((v) => {
              const active = v.id === vehicleId;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleId(v.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? theme.cardElevated
                        : theme.muted,
                      borderColor: active ? theme.borderFocus : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>
                    {v.plate} · {v.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            INCIDENT LOCATION & GPS LOCK
          </Text>
          <TextInput
            value={locationLabel}
            onChangeText={setLocationLabel}
            style={[
              styles.input,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            WHAT HAPPENED?
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe damage, traffic obstruction, or mechanical failure..."
            placeholderTextColor={theme.textMuted}
            style={[
              styles.textArea,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            THIRD-PARTY / OTHER VEHICLE INFO (OPTIONAL)
          </Text>
          <TextInput
            value={thirdPartyName}
            onChangeText={setThirdPartyName}
            placeholder="Name, license plate, or insurance policy"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            ESTIMATED REPAIR COST ($ USD)
          </Text>
          <TextInput
            value={estimatedCost}
            onChangeText={setEstimatedCost}
            keyboardType="numeric"
            style={[
              styles.input,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />
        </View>

        <Button
          label={`+ Attach Damage Photo (${photos.length})`}
          variant="secondary"
          size="md"
          fullWidth
          icon={<Ionicons name="camera-outline" size={16} color={theme.text} />}
          onPress={handlePickPhoto}
        />

        <Button
          label="Broadcast SOS Incident Report"
          variant="danger"
          size="lg"
          fullWidth
          icon={<Ionicons name="warning" size={18} color="#FFFFFF" />}
          onPress={handleSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "800" },
  sub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 16, gap: 14 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "700" },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 72,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
});
