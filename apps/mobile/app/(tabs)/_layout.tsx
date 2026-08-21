import { Tabs } from "expo-router";

import { colors } from "@/components/ui";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "800" },
        tabBarActiveTintColor: colors.brand2,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My basket", tabBarLabel: "Basket" }} />
      <Tabs.Screen name="offers" options={{ title: "Offer wallet", tabBarLabel: "Offers" }} />
      <Tabs.Screen
        name="connections"
        options={{ title: "Retailer connections", tabBarLabel: "Connections" }}
      />
    </Tabs>
  );
}
