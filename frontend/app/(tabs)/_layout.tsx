import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { usePrefs } from "@/src/context/PrefsContext";

export default function TabsLayout() {
  const { colors } = usePrefs();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pallets"
        options={{
          title: "Pallets",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="calculator" options={{ href: null }} />
    </Tabs>
  );
}
