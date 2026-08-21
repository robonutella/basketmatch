import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { AppState, Platform } from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getSupabaseClient } from "@/lib/supabase";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  message: string;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient();
  const [loading, setLoading] = useState(Boolean(client));
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");

  const handleUrl = useCallback(async (url: string | null) => {
    if (!client || !url) return;
    const parsed = Linking.parse(url);
    const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : undefined;
    if (!code) return;
    setLoading(true);
    const { error } = await client.auth.exchangeCodeForSession(code);
    setMessage(error ? error.message : "Signed in successfully.");
    setLoading(false);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    void Linking.getInitialURL().then(handleUrl);
    const authSubscription = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    const linkSubscription = Linking.addEventListener("url", ({ url }) => void handleUrl(url));
    const appStateSubscription = Platform.OS === "web" ? null : AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    if (Platform.OS !== "web" && AppState.currentState === "active") client.auth.startAutoRefresh();
    return () => {
      mounted = false;
      authSubscription.data.subscription.unsubscribe();
      linkSubscription.remove();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") client.auth.stopAutoRefresh();
    };
  }, [client, handleUrl]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(client),
    loading,
    session,
    user: session?.user ?? null,
    message,
    async sendMagicLink(email) {
      if (!client) throw new Error("Supabase environment variables are not configured.");
      setLoading(true);
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: Linking.createURL("auth-callback") },
      });
      setMessage(error ? error.message : "Check your email for the BasketMatch sign-in link.");
      setLoading(false);
      if (error) throw error;
    },
    async signOut() {
      if (client) await client.auth.signOut();
    },
  }), [client, loading, message, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
