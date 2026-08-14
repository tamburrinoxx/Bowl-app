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
    <main className="min-h-screen bg-walnut text-chalk px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <p className="font-score text-scoreboard-amber text-sm mb-2 text-center">
          HOST ACCESS
        </p>
        <h1 className="font-display text-3xl mb-8 text-center">
          {mode === "signup" ? "Create Host Account" : "Sign In"}
        </h1>

        <form
          onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
          className="space-y-4"
        >
          {mode === "signup" && (
            <div>
              <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
            <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
            <label className="font-score text-xs uppercase text-chalk/60 block mb-1">
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
            <p className="text-pindeck-red font-score text-sm border border-pindeck-red/40 rounded p-3">
              {error}
            </p>
          )}

          {message && (
            <p className="text-verified-green font-score text-sm border border-verified-green/40 rounded p-3">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="font-display w-full bg-scoreboard-amber text-walnut text-lg py-3 rounded-md hover:brightness-110 transition disabled:opacity-50"
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
          className="font-score text-xs text-chalk/50 hover:text-chalk block mx-auto mt-6"
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
  "w-full bg-walnut border border-walnut-mid rounded-md px-3 py-2 text-chalk placeholder:text-chalk/30 focus:outline-none focus:ring-2 focus:ring-scoreboard-amber";

open -e ~/Desktop/bowl-app/src/app/host/tournaments/new/page.tsx
