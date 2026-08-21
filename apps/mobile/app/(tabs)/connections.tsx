import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { Card, colors, Eyebrow, uiStyles } from "@/components/ui";

const connections = [
  { id: "safeway", name: "Safeway for U", capability: "Catalog + loyalty offers" },
  { id: "target", name: "Target Circle", capability: "Catalog + loyalty offers" },
  { id: "walmart", name: "Walmart", capability: "Catalog + receipts" },
] as const;

export default function ConnectionsScreen() {
  const { configured, loading, user, signOut } = useAuth();
  return (
    <ScrollView contentContainerStyle={uiStyles.content} style={uiStyles.screen}>
      <View style={styles.intro}>
        <Eyebrow>Secure by design</Eyebrow>
        <Text style={uiStyles.heading}>Connect retailer accounts</Text>
        <Text style={uiStyles.body}>
          Connections use provider-hosted OAuth and encrypted server-side tokens. BasketMatch
          never asks for or stores a retailer password.
        </Text>
      </View>

      <Card>
        <Text style={styles.name}>BasketMatch account</Text>
        <Text style={styles.capability}>
          {user?.email ?? (configured ? "Sign in to sync your data" : "Supabase is not configured")}
        </Text>
        {user ? (
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.accountButton}>
            <Text style={styles.accountButtonText}>Sign out</Text>
          </Pressable>
        ) : (
          <Link asChild href="/auth">
            <Pressable accessibilityRole="button" disabled={!configured || loading} style={styles.accountButton}>
              <Text style={styles.accountButtonText}>Sign in with email</Text>
            </Pressable>
          </Link>
        )}
      </Card>

      <View style={styles.list}>
        {connections.map((connection) => (
          <Card key={connection.id}>
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.name}>{connection.name}</Text>
                <Text style={styles.capability}>{connection.capability}</Text>
                <Text style={styles.pilot}>Typed mock · commercial approval required</Text>
              </View>
              <Pressable
                accessibilityHint="Provider authorization is disabled in the demo"
                accessibilityRole="button"
                disabled
                style={styles.button}
              >
                <Text style={styles.buttonText}>OAuth setup required</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>

      <Card style={styles.note}>
        <Text style={styles.noteTitle}>What gets stored</Text>
        <Text style={styles.noteBody}>
          The database keeps the provider, granted scopes, expiry, and an opaque server-side
          secret reference. The vault—not the app or database row—holds encrypted OAuth tokens.
          Disconnecting revokes access and removes that token material.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 5, paddingHorizontal: 3 },
  list: { gap: 11 },
  row: { gap: 14 },
  copy: { gap: 4 },
  name: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  capability: { color: colors.muted, fontSize: 13 },
  pilot: { color: "#aa7411", fontSize: 12, fontWeight: "700" },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#ecebe6",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  buttonText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  note: { backgroundColor: colors.brand },
  noteTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  noteBody: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 20, marginTop: 7 },
  accountButton: { alignSelf: "flex-start", backgroundColor: colors.brand, borderRadius: 12, marginTop: 12, paddingHorizontal: 14, paddingVertical: 11 },
  accountButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
