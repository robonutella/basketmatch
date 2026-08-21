import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig, getServerSupabaseConfig } from "./config";

export function createServiceSupabaseClient(): SupabaseClient {
  const config = getServerSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserSupabaseClient(accessToken: string): SupabaseClient {
  const config = getPublicSupabaseConfig();
  if (!config) throw new Error("Supabase public configuration is missing.");
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function authenticateRequest(request: Request): Promise<{
  accessToken: string;
  userId: string;
}> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) throw new Response("Authentication required.", { status: 401 });
  const accessToken = match[1];
  const client = createUserSupabaseClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Invalid or expired session.", { status: 401 });
  return { accessToken, userId: data.user.id };
}
