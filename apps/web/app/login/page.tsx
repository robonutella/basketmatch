"use client";

import { type FormEvent, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getBrowserSupabaseClient();
    if (!client) {
      setMessage("Supabase environment variables are not configured.");
      return;
    }
    setSending(true);
    setMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    setMessage(error ? error.message : "Check your email for the BasketMatch sign-in link.");
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">Passwordless authentication</p>
        <h1>Sign in to BasketMatch</h1>
        <p>Your grocery lists, recommendations, traces, and receipts stay tied to your account.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <button className="button primary" disabled={sending} type="submit">
            {sending ? "Sending…" : "Email me a magic link"}
          </button>
        </form>
        {message && <p aria-live="polite" className="auth-message">{message}</p>}
        <small>Apple and Google can be enabled later through Supabase identities without migrating your BasketMatch data.</small>
      </section>
    </main>
  );
}
