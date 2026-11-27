import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";
import type { TripChecklist } from "@/types";

export default function ChecklistModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    phase?: string;
    vehicleId?: string;
    bookingId?: string;
    purpose?: string;
  }>();

  const phase: "pre" | "post" = params.phase === "post" ? "post" : "pre";
  const vehicles = useFleetStore((s) => s.vehicles);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const startTripForVehicle = useFleetStore((s) => s.startTripForVehicle);
  const startAssignedBooking = useFleetStore((s) => s.startAssignedBooking);
  const endActiveTripForVehicle = useFleetStore(
    (s) => s.endActiveTripForVehicle
  );

  const targetVehicleId = params.vehicleId || selectedVehicleId || "veh-1";
  const vehicle = vehicles.find((v) => v.id === targetVehicleId);

  const [tiresOk, setTiresOk] = useState(true);
  const [lightsOk, setLightsOk] = useState(true);
  const [brakesOk, setBrakesOk] = useState(true);
  const [fluidsOk, setFluidsOk] = useState(true);
  const [bodyOk, setBodyOk] = useState(true);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checks = [
    {
      id: "tires",
      label: "Tire pressure & tread depth OK",
      value: tiresOk,
      onChange: setTiresOk,
    },
    {
      id: "lights",
      label: "Headlights, brake lights & indicators OK",
      value: lightsOk,
      onChange: setLightsOk,
    },
    {
      id: "brakes",
      label: "Service & parking brakes responsive",
      value: brakesOk,
      onChange: setBrakesOk,
    },
    {
      id: "fluids",
      label: "Engine oil, coolant & washer fluid levels OK",
      value: fluidsOk,
      onChange: setFluidsOk,
    },
    {
      id: "body",
      label: "Exterior body & mirrors free of new damage",
      value: bodyOk,
      onChange: setBodyOk,
    },
  ];

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
      // Fallback sample photo marker
      setPhotos((prev) => [...prev, `walkaround-photo-${prev.length + 1}.jpg`]);
    }
  };

  const handleConfirm = () => {
    const checklist: TripChecklist = {
      phase,
      completedAt: new Date().toISOString(),
      tiresOk,
      lightsOk,
      brakesOk,
      fluidsOk,
      bodyOk,
      notes: notes.trim() || undefined,
      damagePhotos: photos,
    };

    if (phase === "pre") {
      const res = params.bookingId
        ? startAssignedBooking(params.bookingId, checklist)
        : startTripForVehicle(
            targetVehicleId,
            undefined,
            params.purpose,
            checklist
          );
      if (!res.ok) {
        setError(res.error ?? "Unable to start trip.");
        return;
      }
    } else {
      endActiveTripForVehicle(targetVehicleId, checklist);
    }

    triggerSuccessHaptic();
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
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>
            {phase === "pre"
              ? "Pre-Trip Walkaround Inspection"
              : "Post-Trip Walkaround Inspection"}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {vehicle?.name ?? "Vehicle"} ({vehicle?.plate ?? "FP-8421"})
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
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              5-POINT DIGITAL SAFETY CHECKLIST
            </Text>
            <Badge
              label={phase === "pre" ? "PRE-DISPATCH" : "TRIP CLOSURE"}
              tone={phase === "pre" ? "emerald" : "amber"}
            />
          </View>

          {checks.map((chk) => (
            <View
              key={chk.id}
              style={[
                styles.checkRow,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text style={[styles.checkLabel, { color: theme.text }]}>
                {chk.label}
              </Text>
              <Switch
                value={chk.value}
                onValueChange={chk.onChange}
                trackColor={{
                  false: theme.muted,
                  true: theme.statusLive,
                }}
              />
            </View>
          ))}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            INSPECTOR NOTES & WALKAROUND PHOTOS
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Any defects, fluid top-up, or tire pressure notes..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.textArea,
              {
                backgroundColor: theme.muted,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <View style={styles.photoRow}>
            <Button
              label={`+ Attach Photo (${photos.length})`}
              size="sm"
              variant="secondary"
              icon={
                <Ionicons
                  name="camera-outline"
                  size={15}
                  color={theme.text}
                />
              }
              onPress={handlePickPhoto}
            />
            {photos.length > 0 ? (
              <Badge
                label={`${photos.length} attached`}
                tone="cyan"
              />
            ) : null}
          </View>
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}

        <Button
          label={
            phase === "pre"
              ? "Confirm Walkaround & Start Live Trip"
              : "Save Post-Inspection & Complete Trip"
          }
          variant={phase === "pre" ? "emerald" : "danger"}
          size="lg"
          fullWidth
          onPress={handleConfirm}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  sub: {
    fontSize: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 74,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
