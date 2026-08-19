"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, PatternAverage, OilPattern } from "@/types";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [averages, setAverages] = useState<(PatternAverage & { oil_patterns: OilPattern })[]>(
    []
  );

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [homeCenter, setHomeCenter] = useState("");
  const [usbcId, setUsbcId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    setProfile(profileRow);

    if (profileRow) {
      const { data: avgRows } = await supabase
        .from("pattern_averages")
        .select("*, oil_patterns(*)")
        .eq("bowler_id", user.id);
      setAverages(avgRows ?? []);
    }

    setLoading(false);
  }

  async function ensureBowlerProfile(userId: string, userEmail: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName || userEmail,
        email: userEmail,
        home_center: homeCenter || null,
        usbc_id: usbcId || null,
        role: "bowler",
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
      await ensureBowlerProfile(data.user.id, email);
      setBusy(false);
      loadProfile();
      return;
    }

    setBusy(false);
    setMessage("Check your email to confirm your account, then come back and sign in.");
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
      await ensureBowlerProfile(data.user.id, email);
    }

    setBusy(false);
    loadProfile();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setAverages([]);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ink-soft">Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm glass-panel p-8">
          <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 text-center uppercase">
            Bowler Profile
          </p>
          <h1 className="font-display text-3xl text-ink mb-8 text-center">
            {mode === "signup" ? "Create Your Profile" : "Welcome Back"}
          </h1>

          <form
            onSubmit={mode === "signup" ? handleSignUp : handleSignIn}
            className="space-y-4"
          >
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    Name
                  </label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    Home center
                  </label>
                  <input
                    value={homeCenter}
                    onChange={(e) => setHomeCenter(e.target.value)}
                    placeholder="Clubhouse No. 3"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
                    USBC ID (optional)
                  </label>
                  <input
                    value={usbcId}
                    onChange={(e) => setUsbcId(e.target.value)}
                    placeholder="1234567"
                    className={inputClass}
                  />
                </div>
              </>
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
                placeholder="you@email.com"
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
              {busy ? "Working…" : mode === "signup" ? "Create Profile" : "Sign In"}
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
              ? "Already have a profile? Sign in"
              : "Need a profile? Sign up"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="glass-panel p-8 mb-6 flex items-baseline justify-between">
          <div>
            <p className="font-score text-accent text-xs font-semibold tracking-wide mb-1 uppercase">
              Bowler Profile
            </p>
            <h1 className="font-display text-4xl text-ink">{profile.full_name}</h1>
            {profile.home_center && (
              <p className="text-ink-soft text-sm mt-1">{profile.home_center}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-accent font-medium"
          >
            Sign out
          </button>
        </div>

        <section className="glass-panel p-8">
          <h2 className="font-display text-xl text-ink mb-4">Pattern Averages</h2>
          {averages.length ? (
            <div className="space-y-3">
              {averages.map((avg) => (
                <div
                  key={avg.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-5 py-4"
                >
                  <div>
                    <p className="text-ink font-medium">
                      {avg.oil_patterns?.name ?? "Unknown pattern"}
                    </p>
                    <p className="text-ink-soft text-xs mt-0.5">
                      {avg.games_counted} games
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-score text-accent text-lg font-semibold">
                      {avg.average}
                    </p>
                    {avg.verified && (
                      <p className="text-success text-xs font-medium">verified</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-soft text-sm rounded-2xl bg-white/5 p-5">
              No pattern averages yet. These build up as you bowl in tracked tournaments.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60 text-base";
