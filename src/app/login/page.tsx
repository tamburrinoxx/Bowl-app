"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureHostProfile(userId: string, name: string, userEmail: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
        full_name: name || userEmail,
        email: userEmail,
        role: "host",
      });
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setBusy(false);
      return;
    }

    if (data.session && data.user) {
      await ensureHostProfile(data.user.id, fullName, email);
      setBusy(false);
      router.push("/host/tournaments/new");
      return;
    }

    setBusy(false);
    setMessage(
      "Check your email to confirm your account, then come back and sign in."
    );
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }

    if (data.user) {
      await ensureHostProfile(data.user.id, fullName, email);
    }

    setBusy(false);
    router.push("/host/tournaments/new");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm glass-panel p-8">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 text-center uppercase">
          Host Access
        </p>
        <h1 className="font-display text-3xl text-ink mb-8 text-center">
          {mode === "signup" ? "Create Account" : "Welcome Back"}
        </h1>

        <form
          onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
          className="space-y-4"
        >
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                Name
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Maxx Reider"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clubhouseno3.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-2xl p-3">
              {error}
            </p>
          )}

          {message && (
            <p className="text-success text-sm bg-success/10 border border-success/20 rounded-2xl p-3">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="pill-button w-full bg-accent text-white text-base py-3.5 hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
            setMessage(null);
          }}
          className="text-sm text-accent font-medium block mx-auto mt-6"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </main>
  );
}

const inputClass =
  "glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60 text-base";
