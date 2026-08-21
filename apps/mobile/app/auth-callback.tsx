import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { uiStyles } from "@/components/ui";

export default function AuthCallbackScreen() {
  const { loading, user, message } = useAuth();
  if (user) return <Redirect href="/(tabs)" />;
  return <View style={[uiStyles.screen, uiStyles.content]}><Text>{loading ? "Completing sign-in…" : message}</Text></View>;
}
