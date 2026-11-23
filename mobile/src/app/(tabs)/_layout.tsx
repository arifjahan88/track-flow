import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/store/auth-store";

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useHydrated();
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const users = useAuthStore((s) => s.users);

  useEffect(() => {
    if (hydrated && !currentUserId) {
      router.replace("/(auth)/login");
    }
  }, [hydrated, currentUserId]);

  const currentUser = users.find((u) => u.id === currentUserId);
  const role = currentUser?.role ?? "driver";
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingTop: 6,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Fonts.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: role === "driver" ? "Drive Map" : "Live Map",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="navigate-circle" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: role === "dispatcher" ? "Dispatch" : "Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: role === "mechanic" ? "Service Bay" : "Field Logs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={role === "mechanic" ? "construct" : "receipt"}
              size={size}
              color={String(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="fleet"
        options={{
          title: "Fleet Hub",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bus" size={size} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={String(color)} />
          ),
        }}
      />
    </Tabs>
  );
}
