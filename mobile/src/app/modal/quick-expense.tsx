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
import { triggerSuccessHaptic } from "@/lib/haptics";
import { getScopedVehicles } from "@/lib/rbac-scope";
import { useAuthStore } from "@/store/auth-store";
import { useFleetStore } from "@/store/fleet-store";
import type { ExpenseCategory } from "@/types";

const CATEGORIES: ExpenseCategory[] = [
  "Tolls",
  "Parking",
  "Fines",
  "Driver allowance",
  "Other",
];

export default function QuickExpenseModalScreen() {
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
  const addExpense = useFleetStore((s) => s.addExpense);

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
  const [category, setCategory] = useState<ExpenseCategory>("Tolls");
  const [amount, setAmount] = useState("15.00");
  const [costCenter, setCostCenter] = useState("Logistics-Expressway");
  const [description, setDescription] = useState(
    "Dhaka Elevated Expressway freight toll pass"
  );
  const [receiptPhoto, setReceiptPhoto] = useState<string | undefined>(
    undefined
  );

  const handlePickReceipt = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setReceiptPhoto(res.assets[0].uri);
      }
    } catch {
      setReceiptPhoto("expense-receipt-sample.jpg");
    }
  };

  const handleSave = () => {
    const numAmount = Math.max(0.5, Number(amount) || 0);
    if (!description.trim()) return;
    addExpense({
      vehicleId,
      date: toIsoDate(),
      category,
      amount: numAmount,
      costCenter: costCenter.trim() || "Operations",
      description: description.trim(),
      receiptPhotoDataUrl: receiptPhoto,
    });
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
        <View>
          <Text style={[styles.title, { color: theme.text }]}>
            Log Operating Expense
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            Tolls, parking fees, fines & driver trip allowances
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
            EXPENSE CATEGORY
          </Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((cat) => {
              const active = cat === category;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.primary : theme.muted,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active ? theme.primaryForeground : theme.text,
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            VEHICLE
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
            AMOUNT ($ USD)
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
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
            COST CENTER
          </Text>
          <TextInput
            value={costCenter}
            onChangeText={setCostCenter}
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
            DESCRIPTION / RECEIPT NOTE
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
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
          label={receiptPhoto ? "✓ Receipt Photo Attached" : "+ Attach Receipt Photo"}
          variant="secondary"
          size="md"
          fullWidth
          icon={<Ionicons name="camera-outline" size={16} color={theme.text} />}
          onPress={handlePickReceipt}
        />

        <Button
          label="Save Operating Expense"
          variant="emerald"
          size="lg"
          fullWidth
          onPress={handleSave}
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
});
