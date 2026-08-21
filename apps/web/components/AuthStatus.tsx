"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function AuthStatus() {
  const { configured, loading, user, signOut } = useAuth();
  if (!configured) return <span className="auth-note">Demo mode</span>;
  if (loading) return <span className="auth-note">Checking session…</span>;
  if (!user) return <Link className="auth-link" href="/login">Sign in</Link>;
  return (
    <button className="auth-link auth-button" onClick={() => void signOut()} type="button">
      Sign out {user.email}
    </button>
  );
}
