"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    const client = getBrowserSupabaseClient();
    if (!client || !code) {
      setMessage("This sign-in link is incomplete or Supabase is not configured.");
      return;
    }
    void client.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setMessage(error.message);
      else router.replace("/");
    });
  }, [router]);

  return <main className="auth-shell"><section className="card auth-card"><p>{message}</p></section></main>;
}
