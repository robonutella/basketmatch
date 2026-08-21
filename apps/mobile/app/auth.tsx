import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { Card, colors, Eyebrow, uiStyles } from "@/components/ui";

export default function AuthScreen() {
  const { configured, loading, message, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");

  return (
    <View style={[uiStyles.screen, styles.screen]}>
      <Card>
        <Eyebrow>Passwordless authentication</Eyebrow>
        <Text style={uiStyles.heading}>Sign in to BasketMatch</Text>
        <Text style={uiStyles.body}>Use an email magic link to sync lists, calculations, receipts, and redemptions.</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={styles.input}
          value={email}
        />
        <Pressable
          disabled={!configured || loading || !email.trim()}
          onPress={() => void sendMagicLink(email).catch(() => undefined)}
          style={[styles.button, (!configured || loading) && styles.disabled]}
        >
          <Text style={styles.buttonText}>{loading ? "Sending…" : "Email me a magic link"}</Text>
        </Pressable>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {!configured && <Text style={styles.message}>Supabase environment variables are not configured.</Text>}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18 },
  input: { backgroundColor: colors.white, borderColor: "#dcd8cc", borderRadius: 13, borderWidth: 1, marginTop: 18, padding: 14 },
  button: { alignItems: "center", backgroundColor: colors.brand, borderRadius: 13, marginTop: 10, padding: 14 },
  buttonText: { color: colors.white, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 14 },
});
