import { useState } from "react";
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
import { SignatureCanvas } from "@/components/trips/signature-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { triggerSuccessHaptic } from "@/lib/haptics";
import { useFleetStore } from "@/store/fleet-store";

export default function PodModalScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    waypointId?: string;
    tripId?: string;
  }>();

  const trips = useFleetStore((s) => s.trips);
  const completeWaypointPod = useFleetStore((s) => s.completeWaypointPod);

  const activeTrip =
    trips.find((t) => t.id === params.tripId) ??
    trips.find((t) => t.status !== "done");
  const waypoint =
    activeTrip?.waypoints?.find((w) => w.id === params.waypointId) ??
    activeTrip?.waypoints?.[0];

  const [recipientName, setRecipientName] = useState("");
  const [signatureSvg, setSignatureSvg] = useState<string | undefined>(
    undefined
  );
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleCapturePhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch {
      setPhotoUri("pod-delivery-photo.jpg");
    }
  };

  const handleSavePod = () => {
    if (!recipientName.trim()) {
      setError("Please enter the receiving officer or client name.");
      return;
    }
    if (!waypoint) {
      router.back();
      return;
    }
    completeWaypointPod(
      waypoint.id,
      {
        recipientName: recipientName.trim(),
        podSignatureDataUrl: signatureSvg,
        podPhotoDataUrl: photoUri,
      },
      activeTrip?.id
    );
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
            Proof of Delivery (POD)
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {waypoint?.label ?? "Delivery Waypoint"} ·{" "}
            {waypoint?.address ?? "Corridor Stop"}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: theme.muted }]}
        >
          <Ionicons name="close" size={18} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            RECEIVING OFFICER / CLIENT FULL NAME
          </Text>
          <TextInput
            value={recipientName}
            onChangeText={(v) => {
              setRecipientName(v);
              setError(null);
            }}
            placeholder="e.g. Tanvir Hossain (Warehouse Supervisor)"
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

          <Text
            style={[
              styles.label,
              { color: theme.textSecondary, marginTop: 10 },
            ]}
          >
            DIGITAL FINGER SIGNATURE PAD
          </Text>
          <SignatureCanvas value={signatureSvg} onChange={setSignatureSvg} />

          <View style={styles.photoRow}>
            <Button
              label={photoUri ? "✓ Delivery Photo Attached" : "+ Capture Delivery Photo"}
              size="sm"
              variant="secondary"
              icon={
                <Ionicons
                  name="camera-outline"
                  size={15}
                  color={theme.text}
                />
              }
              onPress={handleCapturePhoto}
            />
            {signatureSvg ? (
              <Badge label="SIGNATURE READY" tone="emerald" />
            ) : null}
          </View>
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
        ) : null}

        <Button
          label="Save POD & Mark Stop Arrived"
          variant="emerald"
          size="lg"
          fullWidth
          onPress={handleSavePod}
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
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
