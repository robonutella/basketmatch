import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "./config";

let browserClient: SupabaseClient | null | undefined;

export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const config = getPublicSupabaseConfig();
  browserClient = config
    ? createClient(config.url, config.anonKey, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true },
      })
    : null;
  return browserClient;
}
