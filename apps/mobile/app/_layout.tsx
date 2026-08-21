import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BasketProvider } from "@/components/BasketProvider";
import { colors } from "@/components/ui";

export default function RootLayout() {
  return (
    <BasketProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.paper },
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: "800" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plan/[index]" options={{ title: "Calculation trace" }} />
      </Stack>
    </BasketProvider>
  );
}
