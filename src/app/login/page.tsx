"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

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
      router.push("/host/tournaments");
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
    router.push("/host/tournaments");
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <div className="max-w-lg">
          <Logo className="mb-8 text-3xl" />

          <h1 className="font-display text-ink mb-4 text-5xl leading-[0.95]">
            Tournament night
            <br />
            without the clipboard.
          </h1>
          <p className="text-ink-soft mb-10 text-base">
            Build the format, take the entries, run the brackets, and let every
            bowler follow along from their own phone.
          </p>

          <div className="space-y-px">
            {[
              {
                n: "1",
                title: "Live standings, no app to install",
                body: "Scan the code taped to the pair. Scores, side action and brackets update as they go in.",
              },
              {
                n: "2",
                title: "Every pot worked out for you",
                body: "Brackets, high game, series, eliminator. Who won what, totalled per bowler at the end of the night.",
              },
              {
                n: "3",
                title: "Your average follows you",
                body: "Every tournament you bowl, every leave you throw at. One profile, one Bowl ID.",
              },
            ].map((f, i, arr) => (
              <div
                key={f.n}
                className={`relative border border-white/10 px-5 py-4 ${
                  i === 0 ? "rounded-t-lg" : ""
                } ${i === arr.length - 1 ? "rounded-b-lg" : ""}`}
              >
                <span className="text-ink-soft/50 absolute right-0 top-0 flex h-5 w-5 items-center justify-center border-b border-l border-white/10 text-[11px]">
                  {f.n}
                </span>
                <p className="text-accent mb-1 text-sm font-semibold">{f.title}</p>
                <p className="text-ink-soft text-sm">{f.body}</p>
              </div>
            ))}
          </div>

          <p className="text-ink-soft mt-8 text-xs">
            Built at a bowling centre, for people who actually run these.
          </p>
        </div>

        <div className="w-full max-w-sm glass-panel p-8 lg:justify-self-end">
          <p className="font-score text-accent mb-2 text-[13px] font-semibold uppercase tracking-[0.2em]">
            {mode === "signup" ? "Get started" : "Welcome back"}
          </p>
          <h2 className="font-display text-ink mb-6 text-3xl leading-none">
            {mode === "signup" ? "Create your account" : "Sign in"}
          </h2>

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
            className="pill-button w-full bg-accent text-on-accent text-base py-3.5 hover:brightness-110 disabled:opacity-50"
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
      </div>
    </main>
  );
}

const inputClass =
  "glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60 text-base";
